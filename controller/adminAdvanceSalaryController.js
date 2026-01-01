require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const AdvanceSalary = require("../models/AdvanceSalary");
const Employee = require("../models/Employee");

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

const handleFileUpload = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      console.error("Multer Error:", err);
      return res.status(400).json({
        message: "File upload error",
        error: err.message,
      });
    }
    console.log("📋 Parsed body:", req.body);
    console.log("📁 File:", req.file);
    next();
  });
};

// Add Advance Salary (Admin can record for any employee/manager)
exports.addAdminAdvanceSalary = async (req, res) => {
  try {
    const { amount, employeeId } = req.body || {};

    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({
        message: "Amount is required",
      });
    }

    if (!employeeId || typeof employeeId !== "string") {
      return res.status(400).json({
        message: "Employee ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Image is required",
      });
    }

    // Upload image to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "admin-advance-salary",
      resource_type: "auto",
    });

    // Delete local file
    fs.unlinkSync(req.file.path);

    // Resolve target employee (manager/employee/admin) by their string employeeId
    const targetEmployee = await Employee.findOne({ employeeId: employeeId });

    if (!targetEmployee) {
      return res.status(404).json({
        message: "Employee not found for provided employeeId",
      });
    }

    // Create advance salary with all required fields
    const advanceSalary = new AdvanceSalary({
      employeeId: targetEmployee._id,
      employeeName: targetEmployee.name,
      employeeLivePicture:
        targetEmployee.livePicture ||
        "https://via.placeholder.com/300x300?text=Employee",
      amount: parseFloat(amount),
      image: result.secure_url,
      submittedBy: req.user._id, // Admin is submitting
      submittedByName: req.user.name || "Admin", // Admin name
      status: "approved", // Admin-recorded advance salary is auto-approved
      adminNotes: "Direct admin-recorded advance salary",
    });

    await advanceSalary.save();

    res.status(201).json({
      message: "Advance salary added successfully",
      advanceSalary: {
        id: advanceSalary._id,
        amount: advanceSalary.amount,
        image: advanceSalary.image,
        createdAt: advanceSalary.createdAt,
      },
    });
  } catch (err) {
    console.error("Add Admin Advance Salary Error:", err);
    res.status(500).json({
      message: "Error adding advance salary",
      error: err.message,
    });
  }
};

// Get All Admin Advance Salary Records
exports.getAllAdminAdvanceSalary = async (req, res) => {
  try {
    // Get all advance salary records (both admin and manager approved)
    const advanceSalaryRecords = await AdvanceSalary.find(
      {},
      "employeeId employeeName amount image createdAt status"
    ).sort({ createdAt: -1 });

    console.log(
      "📊 [Admin AdvanceSalary] Found records:",
      advanceSalaryRecords.length
    );

    res.status(200).json({
      success: true,
      data: advanceSalaryRecords,
      message: "Advance salary records fetched successfully",
    });
  } catch (err) {
    console.error("Get All Admin Advance Salary Error:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching admin advance salary records",
      error: err.message,
    });
  }
};

// Get Admin Advance Salary Statistics
exports.getAdminAdvanceSalaryStats = async (req, res) => {
  try {
    const totalRecords = await AdvanceSalary.countDocuments({});

    const amounts = await AdvanceSalary.aggregate([
      { $group: { _id: null, totalAmount: { $sum: "$amount" } } },
    ]);

    const totalAmount = amounts.length > 0 ? amounts[0].totalAmount : 0;

    res.status(200).json({
      totalRecords,
      totalAmount,
    });
  } catch (err) {
    console.error("Get Admin Advance Salary Stats Error:", err);
    res.status(500).json({
      message: "Error fetching admin advance salary statistics",
      error: err.message,
    });
  }
};

// Get Admin Advance Salary by ID
exports.getAdminAdvanceSalaryById = async (req, res) => {
  try {
    const { recordId } = req.params;

    const advanceSalary = await AdvanceSalary.findById(recordId).select(
      "amount image createdAt"
    );

    if (!advanceSalary) {
      return res.status(404).json({
        message: "Advance salary record not found",
      });
    }

    res.status(200).json(advanceSalary);
  } catch (err) {
    console.error("Get Admin Advance Salary by ID Error:", err);
    res.status(500).json({
      message: "Error fetching advance salary record",
      error: err.message,
    });
  }
};

exports.handleFileUpload = handleFileUpload;
