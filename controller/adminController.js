const Admin = require("../models/Admin");
const AdminAttendance = require("../models/AdminAttendance");
const cloudinary = require("../config/cloudinary");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const os = require("os");
const mongoose = require("mongoose");

// Strong Password Validation Function
function validatePassword(password) {
  const minLength = 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const errors = [];

  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }

  if (!hasUppercase) {
    errors.push("Password must contain at least one uppercase letter (A-Z)");
  }

  if (!hasNumber && !hasSpecialChar) {
    errors.push(
      "Password must contain at least one number (0-9) or special character (!@#$%^&* etc.)"
    );
  }

  return {
    isValid: errors.length === 0,
    errors: errors,
    requirements: [
      "Minimum 8 characters",
      "At least one uppercase letter (A-Z)",
      "At least one number (0-9) OR special character (!@#$%^&* etc.)",
    ],
  };
}

// Multer configuration for serverless compatibility
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, os.tmpdir());
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
  // Use upload.single with "image" field to match frontend
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

// AWS Face Recognition Integration for Admin Management
const {
  enhancedFaceComparison,
  validateImageForFaceRecognition,
  cleanupTempImage,
} = require("../utils/imageUtils");

// Face verification function for admin live pictures
async function verifyAdminLivePicture(livePicturePath) {
  try {
    console.log("🔍 Validating admin live picture for face recognition...");

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
      console.log("❌ No faces detected in admin image");
      return {
        success: false,
        message:
          "No faces detected in the uploaded image. Please ensure a clear face image is provided.",
        error: "NO_FACE_DETECTED",
      };
    }

    if (faceDetection.faceCount > 1) {
      console.log("❌ Multiple faces detected in admin image");
      return {
        success: false,
        message:
          "Multiple faces detected in the image. Please use an image with only one face.",
        error: "MULTIPLE_FACES",
      };
    }

    console.log("✅ Admin live picture validation successful!");
    return {
      success: true,
      message: "Live picture validation passed",
      faceCount: faceDetection.faceCount,
    };
  } catch (error) {
    console.error("❌ Admin live picture validation error:", error);
    return {
      success: false,
      message: "Live picture validation failed",
      error: error.message,
    };
  }
}

// Face verification function for admin attendance using AWS Rekognition
async function verifyAdminFace(storedImageUrl, attendanceImagePath) {
  try {
    console.log("🔍 Starting admin face verification for attendance...");

    // Validate attendance image quality
    const imageValidation =
      validateImageForFaceRecognition(attendanceImagePath);
    if (!imageValidation.valid) {
      console.log("❌ Image validation failed:", imageValidation.message);
      return {
        success: false,
        message: imageValidation.message,
        error: imageValidation.error,
      };
    }

    // Perform enhanced face comparison
    const faceComparison = await enhancedFaceComparison(
      storedImageUrl, // Stored admin image
      attendanceImagePath // Current attendance image
    );

    if (faceComparison.success && faceComparison.isMatch) {
      console.log(
        `✅ Admin face verification successful! Similarity: ${faceComparison.similarity}%, Confidence: ${faceComparison.confidence}`
      );
      return {
        success: true,
        similarity: faceComparison.similarity,
        message: faceComparison.message,
      };
    } else {
      console.log(
        `❌ Admin face verification failed. Similarity: ${faceComparison.similarity}%`
      );
      return {
        success: false,
        similarity: faceComparison.similarity,
        message: faceComparison.message,
        error: faceComparison.error,
      };
    }
  } catch (error) {
    console.error("❌ Admin face verification error:", error);
    return {
      success: false,
      similarity: 0,
      message: "Face verification process failed",
      error: error.message,
    };
  }
}

// Add Admin
exports.addAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      confirmPassword,
      phoneNumber,
      idCardNumber,
      monthlySalary,
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        message: "Name is required",
      });
    }

    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
        requirements: [
          "Minimum 8 characters",
          "At least one uppercase letter (A-Z)",
          "At least one number (0-9) OR special character (!@#$%^&* etc.)",
        ],
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        message: "Password does not meet requirements",
        errors: passwordValidation.errors,
        requirements: passwordValidation.requirements,
      });
    }

    if (!confirmPassword) {
      return res.status(400).json({
        message: "Please confirm your password",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        message: "Password and confirm password do not match",
      });
    }

    // Check if email already exists
    const existingEmailAdmin = await Admin.findOne({ email: email });
    if (existingEmailAdmin) {
      return res.status(400).json({
        message: "Email already registered. Please use a different email.",
      });
    }

    // Validate required fields
    if (!phoneNumber) {
      return res.status(400).json({
        message: "Phone number is required",
      });
    }

    if (!idCardNumber) {
      return res.status(400).json({
        message: "ID card number is required",
      });
    }

    if (!monthlySalary) {
      return res.status(400).json({
        message: "Monthly salary is required",
      });
    }

    // Check if admin already exists with same phone number or ID card number
    const existingAdmin = await Admin.findOne({
      $or: [{ phoneNumber: phoneNumber }, { idCardNumber: idCardNumber }],
    });
    if (existingAdmin) {
      return res.status(400).json({
        message:
          "Admin already exists with this phone number or ID card number",
      });
    }

    let livePictureUrl = "";
    if (req.file) {
      // Validate live picture using AWS face recognition
      const faceValidation = await verifyAdminLivePicture(req.file.path);
      if (!faceValidation.success) {
        // Clean up temporary file
        cleanupTempImage(req.file.path);

        return res.status(400).json({
          message: faceValidation.message,
          error: faceValidation.error,
        });
      }

      console.log(
        "✅ Live picture validation passed, uploading to Cloudinary..."
      );

      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "salon-admins",
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
      });
      livePictureUrl = result.secure_url;

      // Clean up temporary file after successful upload
      cleanupTempImage(req.file.path);
    }

    // Generate sequential admin ID
    const lastAdmin = await Admin.findOne().sort({ adminId: -1 });
    const adminNumber = lastAdmin
      ? parseInt(lastAdmin.adminId.replace("ADM", "")) + 1
      : 1;
    const adminId = `ADM${adminNumber.toString().padStart(3, "0")}`;

    // Hash password (required)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const admin = new Admin({
      adminId,
      name,
      email,
      password: hashedPassword,
      phoneNumber,
      idCardNumber,
      monthlySalary,
      livePicture: livePictureUrl,
    });

    await admin.save();
    res.status(201).json({
      message: "Admin added successfully",
      admin: {
        id: admin._id,
        adminId: admin.adminId,
        name: admin.name,
        email: admin.email,
        phoneNumber: admin.phoneNumber,
        idCardNumber: admin.idCardNumber,
        monthlySalary: admin.monthlySalary,
        hasPassword: true, // Password is always set now
      },
    });
  } catch (err) {
    console.error("Add Admin Error:", err);
    res.status(400).json({
      message: "Add admin error",
      error: err.message,
    });
  }
};

// Get All Admins
exports.getAllAdmins = async (req, res) => {
  try {
    const admins = await Admin.find().sort({ createdAt: -1 });
    res.status(200).json(admins);
  } catch (err) {
    console.error("Get All Admins Error:", err);
    res.status(500).json({
      message: "Error fetching admins",
      error: err.message,
    });
  }
};

// Admin Attendance Check-In/Check-Out
exports.adminAttendance = async (req, res) => {
  try {
    const { adminId, attendanceType } = req.body;

    if (!adminId || !attendanceType) {
      return res.status(400).json({
        message: "Admin ID and attendance type are required",
      });
    }

    if (!["checkin", "checkout"].includes(attendanceType)) {
      return res.status(400).json({
        message: "Attendance type must be either checkin or checkout",
      });
    }

    // Find admin with flexible ID lookup
    let admin = null;

    // Try to find by MongoDB _id first
    if (mongoose.Types.ObjectId.isValid(adminId)) {
      admin = await Admin.findById(adminId);
    }

    // If not found by _id, try to find by adminId field
    if (!admin) {
      admin = await Admin.findOne({ adminId: adminId });
    }

    // If still not found, try to find by email (from auth token)
    if (!admin && req.user && req.user.email) {
      admin = await Admin.findOne({ email: req.user.email });
    }

    if (!admin) {
      console.log("❌ [Admin Attendance] Admin not found for ID:", adminId);
      console.log("❌ [Admin Attendance] Auth user:", req.user);

      // Debug: List all admins in database
      const allAdmins = await Admin.find({}).select("_id adminId name email");
      console.log("📋 [Admin Attendance] All admins in database:", allAdmins);

      return res.status(404).json({
        message:
          "Admin not found. Please ensure you are registered as an admin.",
        debug: {
          searchedId: adminId,
          availableAdmins: allAdmins.map((adm) => ({
            _id: adm._id,
            adminId: adm.adminId,
            name: adm.name,
            email: adm.email,
          })),
        },
      });
    }

    console.log("✅ [Admin Attendance] Admin found:", {
      _id: admin._id,
      adminId: admin.adminId,
      name: admin.name,
      email: admin.email,
      hasLivePicture: !!admin.livePicture,
    });

    // Verify face using AWS Rekognition (if image is uploaded)
    if (req.file) {
      console.log("🔍 Starting admin face verification...");

      // Check if admin has a stored face image
      if (!admin.livePicture) {
        return res.status(400).json({
          message:
            "Admin face not registered. Please register your face first.",
          error: "No stored face image found for admin",
        });
      }

      const faceVerification = await verifyAdminFace(
        admin.livePicture,
        req.file.path
      );

      if (!faceVerification.success) {
        // Clean up temporary image
        try {
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
            console.log("🗑️ Cleaned up temp file after failed verification");
          }
        } catch (cleanupError) {
          console.log("⚠️ Could not cleanup temp file:", cleanupError.message);
        }

        return res.status(400).json({
          message: faceVerification.message,
          similarity: faceVerification.similarity,
          error: faceVerification.error,
        });
      }

      console.log(
        `✅ Admin face verification successful! Similarity: ${faceVerification.similarity}%`
      );
    }

    // Handle optional image upload for admin
    let attendanceImageUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "admin-attendance",
        resource_type: "auto",
      });
      attendanceImageUrl = result.secure_url;

      // Delete local file
      fs.unlinkSync(req.file.path);
    }

    // Check if attendance already exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await AdminAttendance.findOne({
      adminId: admin._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    // Validate attendance logic
    if (attendanceType === "checkin") {
      if (attendance && attendance.checkInTime) {
        return res.status(400).json({
          message: "Check-in already recorded for today",
        });
      }
    } else if (attendanceType === "checkout") {
      if (!attendance || !attendance.checkInTime) {
        return res.status(400).json({
          message: "No check-in record found for today",
        });
      }
      if (attendance.checkOutTime) {
        return res.status(400).json({
          message: "Check-out already recorded for today",
        });
      }
    }

    // Create or update attendance
    if (!attendance) {
      attendance = new AdminAttendance({
        adminId: admin._id,
        adminName: admin.name,
        adminEmail: admin.email,
        date: today,
        status: "present",
        attendanceType: attendanceType,
      });
    }

    // Update based on attendance type
    if (attendanceType === "checkin") {
      attendance.checkInTime = new Date();
      if (attendanceImageUrl) {
        attendance.checkInImage = attendanceImageUrl;
      }
      attendance.status = "present";
    } else if (attendanceType === "checkout") {
      attendance.checkOutTime = new Date();
      if (attendanceImageUrl) {
        attendance.checkOutImage = attendanceImageUrl;
      }
    }

    attendance.updatedAt = new Date();
    await attendance.save();

    res.status(200).json({
      message: `${
        attendanceType === "checkin" ? "Check-in" : "Check-out"
      } successful`,
      attendance: {
        id: attendance._id,
        adminName: attendance.adminName,
        adminEmail: attendance.adminEmail,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        status: attendance.status,
        attendanceType: attendanceType,
      },
    });
  } catch (err) {
    console.error("Admin Attendance Error:", err);
    res.status(500).json({
      message: "Error during admin attendance",
      error: err.message,
    });
  }
};

// Get All Admin Attendance Records
exports.getAllAdminAttendance = async (req, res) => {
  try {
    const { date, adminId, status } = req.query;

    let filter = {};

    if (date) {
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      filter.date = {
        $gte: selectedDate,
        $lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    if (adminId) {
      filter.adminId = adminId;
    }

    if (status) {
      filter.status = status;
    }

    const attendanceRecords = await AdminAttendance.find(filter)
      .populate("adminId", "name adminId email")
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json(attendanceRecords);
  } catch (err) {
    console.error("Get All Admin Attendance Records Error:", err);
    res.status(500).json({
      message: "Error fetching admin attendance records",
      error: err.message,
    });
  }
};

// Get Admin Attendance by ID
exports.getAdminAttendanceById = async (req, res) => {
  try {
    const { adminId } = req.params;

    const attendanceRecords = await AdminAttendance.find({ adminId })
      .populate("adminId", "name adminId email")
      .sort({ date: -1 });

    if (!attendanceRecords.length) {
      return res.status(404).json({
        message: "No attendance records found for this admin",
      });
    }

    res.status(200).json(attendanceRecords);
  } catch (err) {
    console.error("Get Admin Attendance Error:", err);
    res.status(500).json({
      message: "Error fetching admin attendance",
      error: err.message,
    });
  }
};

// Mark Absent Admins (Daily Task)
exports.markAbsentAdmins = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all admins
    const admins = await Admin.find();

    // Get today's attendance records
    const todayAttendance = await AdminAttendance.find({
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    const presentAdminIds = todayAttendance.map((att) =>
      att.adminId.toString()
    );

    // Mark absent admins
    const absentAdmins = [];
    for (const admin of admins) {
      if (!presentAdminIds.includes(admin._id.toString())) {
        // Check if attendance record already exists
        let attendance = await AdminAttendance.findOne({
          adminId: admin._id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        if (!attendance) {
          attendance = new AdminAttendance({
            adminId: admin._id,
            adminName: admin.name,
            adminEmail: admin.email,
            date: today,
            status: "absent",
          });
          await attendance.save();
        }

        absentAdmins.push({
          adminId: admin.adminId,
          name: admin.name,
          email: admin.email,
        });
      }
    }

    res.status(200).json({
      message: "Absent admins marked successfully",
      absentCount: absentAdmins.length,
      absentAdmins,
    });
  } catch (err) {
    console.error("Mark Absent Admins Error:", err);
    res.status(500).json({
      message: "Error marking absent admins",
      error: err.message,
    });
  }
};

// Admin Login with Email/Password
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email) {
      return res.status(400).json({
        message: "Email is required",
      });
    }

    if (!password) {
      return res.status(400).json({
        message: "Password is required",
      });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email });
    if (!admin) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const jwt = require("jsonwebtoken");
    const token = jwt.sign(
      {
        adminId: admin._id,
        adminDbId: admin.adminId,
        email: admin.email,
        role: "admin",
        name: admin.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Admin login successful",
      token,
      admin: {
        id: admin._id,
        adminId: admin.adminId,
        name: admin.name,
        email: admin.email,
        role: "admin",
      },
      redirectTo: "/admin-panel",
    });
  } catch (error) {
    console.error("Admin Login Error:", error);
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

exports.handleFileUpload = handleFileUpload;

// Get All Attendance Records (Combined Admin + Employee/Manager)
exports.getAllCombinedAttendance = async (req, res) => {
  try {
    const { date, status } = req.query;

    let filter = {};

    if (date) {
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      filter.date = {
        $gte: selectedDate,
        $lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    if (status) {
      filter.status = status;
    }

    // Fetch admin attendance records
    const adminAttendanceRecords = await AdminAttendance.find(filter)
      .populate("adminId", "name adminId email role")
      .sort({ date: -1, createdAt: -1 });

    // Fetch employee attendance records
    const Attendance = require("../models/Attendance");
    const employeeAttendanceRecords = await Attendance.find(filter)
      .populate("employeeId", "name employeeId role")
      .sort({ date: -1, createdAt: -1 });

    // Combine both arrays
    const combinedAttendance = [
      ...adminAttendanceRecords,
      ...employeeAttendanceRecords,
    ];

    // Sort by date
    combinedAttendance.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Debug: Log sample records to understand the data structure
    if (adminAttendanceRecords.length > 0) {
      console.log("🔍 [Debug] Sample admin record:", {
        _id: adminAttendanceRecords[0]._id,
        adminId: adminAttendanceRecords[0].adminId,
        adminName: adminAttendanceRecords[0].adminName,
        adminCustomId: adminAttendanceRecords[0].adminCustomId,
        date: adminAttendanceRecords[0].date,
        checkInTime: adminAttendanceRecords[0].checkInTime,
        checkOutTime: adminAttendanceRecords[0].checkOutTime,
      });
    }

    if (employeeAttendanceRecords.length > 0) {
      console.log("🔍 [Debug] Sample employee record:", {
        _id: employeeAttendanceRecords[0]._id,
        employeeId: employeeAttendanceRecords[0].employeeId,
        employeeName: employeeAttendanceRecords[0].employeeName,
        date: employeeAttendanceRecords[0].date,
        checkInTime: employeeAttendanceRecords[0].checkInTime,
        checkOutTime: employeeAttendanceRecords[0].checkOutTime,
      });
    }

    console.log(
      `✅ [Combined Attendance] Admin records: ${adminAttendanceRecords.length}, Employee records: ${employeeAttendanceRecords.length}, Total: ${combinedAttendance.length}`
    );

    res.status(200).json(combinedAttendance);
  } catch (err) {
    console.error("Get All Combined Attendance Records Error:", err);
    res.status(500).json({
      message: "Error fetching combined attendance records",
      error: err.message,
    });
  }
};
