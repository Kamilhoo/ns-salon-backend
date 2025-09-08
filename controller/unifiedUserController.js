require("dotenv").config();
const Employee = require("../models/Employee");
const cloudinary = require("../config/cloudinary");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage }).any();

// AWS Face Recognition Integration for Employee Management
const {
  enhancedFaceComparison,
  validateImageForFaceRecognition,
  cleanupTempImage,
} = require("../utils/imageUtils");

const handleFileUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      console.error("Multer Error:", err);
      return res
        .status(400)
        .json({ message: "File upload error", error: err.message });
    }
    next();
  });
};

// Face verification function for employee live pictures
async function verifyEmployeeLivePicture(livePicturePath) {
  try {
    console.log("🔍 Validating employee live picture for face recognition...");

    // Validate image quality for face recognition
    const imageValidation = validateImageForFaceRecognition(livePicturePath);
    if (!imageValidation.valid) {
      console.log("❌ Image validation failed:", imageValidation.message);
      return {
        success: false,
        message: imageValidation.message,
        error: imageValidation.error,
      };
    }

    // Detect faces in the uploaded image
    const { detectFaces } = require("../config/aws");
    const imageBuffer = require("fs").readFileSync(livePicturePath);
    const faceDetection = await detectFaces(imageBuffer);

    if (!faceDetection.success) {
      console.log("❌ No faces detected in employee image");
      return {
        success: false,
        message:
          "No faces detected in the uploaded image. Please ensure a clear face image is provided.",
        error: "NO_FACE_DETECTED",
      };
    }

    if (faceDetection.faceCount > 1) {
      console.log("❌ Multiple faces detected in employee image");
      return {
        success: false,
        message:
          "Multiple faces detected in the image. Please use an image with only one face.",
        error: "MULTIPLE_FACES",
      };
    }

    console.log("✅ Employee live picture validation successful!");
    return {
      success: true,
      message: "Live picture validation passed",
      faceCount: faceDetection.faceCount,
    };
  } catch (error) {
    console.error("❌ Employee live picture validation error:", error);
    return {
      success: false,
      message: "Live picture validation failed",
      error: error.message,
    };
  }
}

// Add Employee or Manager
exports.addEmployee = async (req, res) => {
  try {
    const { name, phoneNumber, idCardNumber, monthlySalary, role } = req.body;

    // Validate role
    if (role && !["employee", "manager", "admin"].includes(role)) {
      return res.status(400).json({
        message: 'Role must be either "employee", "manager", or "admin"',
      });
    }

    // Check if employee already exists with same phone or ID card
    const existingEmployee = await Employee.findOne({
      $or: [{ phoneNumber: phoneNumber }, { idCardNumber: idCardNumber }],
    });

    if (existingEmployee) {
      return res.status(400).json({
        message:
          "Employee already exists with this phone number or ID card number",
      });
    }

    let livePictureUrl = "";
    if (req.files && req.files.length > 0) {
      const file = req.files.find((f) => f.fieldname === "livePicture");
      if (file) {
        // Validate live picture using AWS face recognition
        const faceValidation = await verifyEmployeeLivePicture(file.path);
        if (!faceValidation.success) {
          // Clean up temporary file
          cleanupTempImage(file.path);

          return res.status(400).json({
            message: faceValidation.message,
            error: faceValidation.error,
          });
        }

        console.log(
          "✅ Live picture validation passed, uploading to Cloudinary..."
        );

        const result = await cloudinary.uploader.upload(file.path, {
          folder: "salon-employees",
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
        });
        livePictureUrl = result.secure_url;

        // Clean up temporary file after successful upload
        cleanupTempImage(file.path);
      }
    }

    if (!livePictureUrl) {
      return res.status(400).json({
        message: "Live picture is required for attendance matching",
      });
    }

    // Generate proper employee ID based on role
    let employeeId;
    if (role === "admin") {
      // Get the next admin number
      const lastAdmin = await Employee.findOne({ role: "admin" }).sort({
        employeeId: -1,
      });
      const adminNumber = lastAdmin
        ? parseInt(lastAdmin.employeeId.replace("ADM", "")) + 1
        : 1;
      employeeId = `ADM${adminNumber.toString().padStart(3, "0")}`;
    } else if (role === "manager") {
      // Get the next manager number
      const lastManager = await Employee.findOne({ role: "manager" }).sort({
        employeeId: -1,
      });
      const mgrNumber = lastManager
        ? parseInt(lastManager.employeeId.replace("MGR", "")) + 1
        : 1;
      employeeId = `MGR${mgrNumber.toString().padStart(3, "0")}`;
    } else {
      // Get the next employee number
      const lastEmployee = await Employee.findOne({
        role: "employee",
      }).sort({ employeeId: -1 });
      const empNumber = lastEmployee
        ? parseInt(lastEmployee.employeeId.replace("EMP", "")) + 1
        : 1;
      employeeId = `EMP${empNumber.toString().padStart(3, "0")}`;
    }

    const employee = new Employee({
      employeeId,
      name,
      phoneNumber,
      idCardNumber,
      monthlySalary,
      role: role || "employee", // Default to employee if not specified
      livePicture: livePictureUrl,
    });

    await employee.save();

    const roleText =
      role === "admin" ? "Admin" : role === "manager" ? "Manager" : "Employee";
    res.status(201).json({
      message: `${roleText} added successfully`,
      employeeId: employee.employeeId,
      employee,
    });
  } catch (err) {
    console.error("Add Employee Error:", err);
    res.status(400).json({
      message: "Add employee error",
      error: err.message,
    });
  }
};

// Get All Employees (with role filter)
exports.getAllEmployees = async (req, res) => {
  try {
    const { role } = req.query;
    let filter = {};

    // Filter by role if specified
    if (role && ["employee", "manager", "admin"].includes(role)) {
      filter.role = role;
    }

    const employees = await Employee.find(filter)
      .sort({ createdAt: -1 })
      .select(
        "employeeId name phoneNumber idCardNumber monthlySalary role createdAt livePicture"
      );

    // Ensure all employees have the required fields with default values
    const employeesWithDefaults = employees.map((emp) => ({
      ...emp.toObject(),
      idCardNumber: emp.idCardNumber || "NOT_PROVIDED",
      monthlySalary: emp.monthlySalary || 0,
    }));

    if (!employeesWithDefaults || employeesWithDefaults.length === 0) {
      return res.status(200).json({
        message: "No employees found",
        data: [],
        total: 0,
        grouped: {
          admins: [],
          managers: [],
          employees: [],
        },
      });
    }

    // Group employees by role (optional)
    const groupedEmployees = {
      admins: employeesWithDefaults.filter((emp) => emp.role === "admin"),
      managers: employeesWithDefaults.filter((emp) => emp.role === "manager"),
      employees: employeesWithDefaults.filter((emp) => emp.role === "employee"),
    };

    // ✅ Return both array + grouped
    res.status(200).json({
      message: "Employees retrieved successfully",
      data: employeesWithDefaults, // simple array for frontend with default values
      total: employeesWithDefaults.length,
      grouped: groupedEmployees, // grouped version if needed
    });
  } catch (err) {
    console.error("Get All Employees Error:", err);
    res.status(500).json({
      message: "Error fetching employees",
      error: err.message,
    });
  }
};

// Get Employees by Role
exports.getEmployeesByRole = async (req, res) => {
  try {
    const { role } = req.params;

    if (!["employee", "manager", "admin"].includes(role)) {
      return res.status(400).json({
        message: 'Invalid role. Must be "employee", "manager", or "admin"',
      });
    }

    const employees = await Employee.find({ role })
      .sort({ createdAt: -1 })
      .select(
        "employeeId name phoneNumber idCardNumber monthlySalary role createdAt"
      );

    const roleText =
      role === "admin"
        ? "Admins"
        : role === "manager"
        ? "Managers"
        : "Employees";
    res.status(200).json({
      message: `${roleText} retrieved successfully`,
      data: employees,
      total: employees.length,
    });
  } catch (err) {
    console.error("Get Employees by Role Error:", err);
    res.status(500).json({
      message: "Error fetching employees by role",
      error: err.message,
    });
  }
};

// Get Employee by ID
exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findById(id).select(
      "employeeId name phoneNumber idCardNumber monthlySalary role livePicture createdAt"
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Ensure employee has the required fields with default values
    const employeeWithDefaults = {
      ...employee.toObject(),
      idCardNumber: employee.idCardNumber || "NOT_PROVIDED",
      monthlySalary: employee.monthlySalary || 0,
    };

    res.status(200).json({
      message: "Employee retrieved successfully",
      data: employeeWithDefaults,
    });
  } catch (err) {
    console.error("Get Employee Error:", err);
    res.status(500).json({
      message: "Error fetching employee",
      error: err.message,
    });
  }
};

// Update Employee
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber, idCardNumber, monthlySalary, role } = req.body;

    // Validate role if provided
    if (role && !["employee", "manager"].includes(role)) {
      return res.status(400).json({
        message: 'Role must be either "employee" or "manager"',
      });
    }

    let update = { name, phoneNumber, idCardNumber, monthlySalary };
    if (role) {
      update.role = role;
    }

    // Check if phone number or ID card number already exists for other employees
    const existingEmployee = await Employee.findOne({
      $and: [
        { _id: { $ne: id } },
        {
          $or: [{ phoneNumber: phoneNumber }, { idCardNumber: idCardNumber }],
        },
      ],
    });

    if (existingEmployee) {
      return res.status(400).json({
        message:
          "Phone number or ID card number already exists for another employee",
      });
    }

    // Handle live picture update
    if (req.files && req.files.length > 0) {
      const file = req.files.find((f) => f.fieldname === "livePicture");
      if (file) {
        // Validate live picture using AWS face recognition
        const faceValidation = await verifyEmployeeLivePicture(file.path);
        if (!faceValidation.success) {
          // Clean up temporary file
          cleanupTempImage(file.path);

          return res.status(400).json({
            message: faceValidation.message,
            error: faceValidation.error,
          });
        }

        console.log(
          "✅ Live picture validation passed, uploading to Cloudinary..."
        );

        const result = await cloudinary.uploader.upload(file.path, {
          folder: "salon-employees",
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
        });
        update.livePicture = result.secure_url;

        // Clean up temporary file after successful upload
        cleanupTempImage(file.path);
      }
    }

    const employee = await Employee.findByIdAndUpdate(id, update, {
      new: true,
    }).select(
      "employeeId name phoneNumber idCardNumber monthlySalary role livePicture createdAt"
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const roleText = employee.role === "manager" ? "Manager" : "Employee";
    res.status(200).json({
      message: `${roleText} updated successfully`,
      data: employee,
    });
  } catch (err) {
    console.error("Update Employee Error:", err);
    res.status(400).json({
      message: "Update employee error",
      error: err.message,
    });
  }
};

// Delete Employee
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const employee = await Employee.findByIdAndDelete(id).select(
      "employeeId name phoneNumber role"
    );

    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    const roleText = employee.role === "manager" ? "Manager" : "Employee";
    res.status(200).json({
      message: `${roleText} deleted successfully`,
      data: { deletedEmployee: employee },
    });
  } catch (err) {
    console.error("Delete Employee Error:", err);
    res.status(400).json({
      message: "Delete employee error",
      error: err.message,
    });
  }
};

// Get Employee Statistics
exports.getEmployeeStats = async (req, res) => {
  try {
    const [totalEmployees, managers, employees] = await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ role: "manager" }),
      Employee.countDocuments({ role: "employee" }),
    ]);

    const stats = {
      totalEmployees,
      managers,
      employees,
      managerPercentage:
        totalEmployees > 0 ? ((managers / totalEmployees) * 100).toFixed(2) : 0,
      employeePercentage:
        totalEmployees > 0
          ? ((employees / totalEmployees) * 100).toFixed(2)
          : 0,
    };

    res.status(200).json({
      message: "Employee statistics retrieved successfully",
      data: stats,
    });
  } catch (err) {
    console.error("Get Employee Stats Error:", err);
    res.status(500).json({
      message: "Error fetching employee statistics",
      error: err.message,
    });
  }
};

exports.handleFileUpload = handleFileUpload;
