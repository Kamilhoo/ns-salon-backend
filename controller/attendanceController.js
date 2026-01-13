require("dotenv").config();
const cloudinary = require("../config/cloudinary");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const ManualAttendanceRequest = require("../models/ManualAttendanceRequest");
const Notification = require("../models/Notification");
const Admin = require("../models/Admin");
const AdminAttendance = require("../models/AdminAttendance"); // Added for adminAttendanceCustom
const { notifyAllAdmins } = require("./notificationController");

// Use os.tmpdir() for temporary files (better for serverless)
const uploadsDir = os.tmpdir();

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
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

const handleFileUpload = (req, res, next) => {
  upload.single("livePicture")(req, res, (err) => {
    if (err) {
      console.error("Multer Error:", err);

      // Handle specific file size error
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "File size too large",
          error: "File size should be less than 50MB",
        });
      }

      return res.status(400).json({
        message: "File upload error",
        error: err.message,
      });
    }
    console.log("📋 Parsed body:", req.body);
    console.log("📁 File:", req.file);

    // Check if file was uploaded successfully
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded or file upload failed",
        error: "File not found in request",
      });
    }

    // Verify file exists
    if (!fs.existsSync(req.file.path)) {
      return res.status(400).json({
        message: "Uploaded file not found on server",
        error: `File path: ${req.file.path} does not exist`,
      });
    }

    // Check file size (additional validation)
    const fileSizeInMB = req.file.size / (1024 * 1024);
    console.log(`📏 File size: ${fileSizeInMB.toFixed(2)} MB`);

    if (fileSizeInMB > 50) {
      // Clean up the file
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.log(
          "⚠️ Could not cleanup oversized file:",
          cleanupError.message
        );
      }

      return res.status(400).json({
        message: "File size too large",
        error: "File size should be less than 50MB",
      });
    }

    next();
  });
};

// AWS Face Recognition Integration for Employee Attendance
const {
  enhancedFaceComparison,
  validateImageForFaceRecognition,
  cleanupTempImage,
} = require("../utils/imageUtils");

// Face verification function using AWS Rekognition
async function verifyEmployeeFace(storedImageUrl, attendanceImagePath) {
  try {
    console.log("🔍 Starting employee face verification for attendance...");
    console.log("📁 Attendance image path:", attendanceImagePath);

    // Check if file exists
    if (!fs.existsSync(attendanceImagePath)) {
      console.log("❌ Attendance image file not found:", attendanceImagePath);
      return {
        success: false,
        message: "Attendance image file not found",
        error: `File not found: ${attendanceImagePath}`,
      };
    }

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

    // Download stored image from Cloudinary for comparison
    // For now, we'll use the stored image URL directly
    // In production, you might want to download the image first

    // Perform enhanced face comparison
    const faceComparison = await enhancedFaceComparison(
      storedImageUrl, // Stored employee image
      attendanceImagePath // Current attendance image
    );

    if (faceComparison.success && faceComparison.isMatch) {
      console.log(
        `✅ Employee face verification successful! Similarity: ${faceComparison.similarity}%, Confidence: ${faceComparison.confidence}`
      );
      return {
        success: true,
        similarity: faceComparison.similarity,
        message: faceComparison.message,
      };
    } else {
      console.log(
        `❌ Employee face verification failed. Similarity: ${faceComparison.similarity}%`
      );
      return {
        success: false,
        similarity: faceComparison.similarity,
        message: faceComparison.message,
        error: faceComparison.error,
      };
    }
  } catch (error) {
    console.error("❌ Face verification error:", error);
    return {
      success: false,
      similarity: 0,
      message: "Face verification process failed",
      error: error.message,
    };
  }
}

// Delete a single attendance record (employee/manager/admin)
async function deleteAttendanceRecord(req, res) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Attendance ID is required" });
    }

    // Try deleting from primary Attendance collection first
    const deletedAttendance = await Attendance.findByIdAndDelete(id);

    // Also attempt to delete from AdminAttendance in case the ID belongs there
    const deletedAdminAttendance = await AdminAttendance.findByIdAndDelete(id);

    if (!deletedAttendance && !deletedAdminAttendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    return res.json({
      message: "Attendance record deleted successfully",
      deletedFrom: {
        attendance: !!deletedAttendance,
        adminAttendance: !!deletedAdminAttendance,
      },
    });
  } catch (error) {
    console.error("❌ Delete attendance error:", error);
    return res.status(500).json({
      message: "Failed to delete attendance record",
      error: error.message,
    });
  }
}

// Employee Check-In
exports.employeeCheckIn = async (req, res) => {
  try {
    const { employeeId } = req.body;

    console.log("🚀 [Employee Check-In] Starting check-in process...");
    console.log("📋 [Employee Check-In] Request body:", req.body);
    console.log("📁 [Employee Check-In] File present:", !!req.file);

    if (!employeeId) {
      console.log("❌ [Employee Check-In] Missing employee ID");
      return res.status(400).json({
        message: "Employee ID is required",
      });
    }

    if (!req.file) {
      console.log("❌ [Employee Check-In] Missing live picture");
      return res.status(400).json({
        message: "Live picture is required for check-in",
      });
    }

    // Find employee by employeeId (string field)
    console.log(
      "🔍 [Employee Check-In] Looking for employee with ID:",
      employeeId
    );
    console.log("🔍 [Employee Check-In] Employee ID type:", typeof employeeId);

    const employee = await Employee.findOne({ employeeId: employeeId });
    console.log(
      "🔍 [Employee Check-In] Employee found:",
      employee ? `Yes: ${employee.name}` : "No"
    );

    if (!employee) {
      // Debug: Let's see what employees exist
      const allEmployees = await Employee.find({}).select(
        "employeeId name role"
      );
      console.log(
        "📋 [Employee Check-In] All employees in database:",
        allEmployees.map((emp) => ({
          employeeId: emp.employeeId,
          name: emp.name,
          role: emp.role,
        }))
      );

      return res.status(404).json({
        message: "Employee not found",
        debug: {
          searchedId: employeeId,
          availableEmployees: allEmployees.map((emp) => emp.employeeId),
        },
      });
    }

    console.log("✅ [Employee Check-In] Employee found:", employee.name);

    // Verify face using AWS Rekognition (before uploading to Cloudinary)
    console.log("🔍 Starting face verification...");
    const faceVerification = await verifyEmployeeFace(
      employee.livePicture,
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
      `✅ Face verification successful! Similarity: ${faceVerification.similarity}%`
    );

    // Upload attendance image to Cloudinary
    console.log("☁️ Uploading to Cloudinary:", req.file.path);
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "attendance",
      resource_type: "auto",
    });

    console.log("✅ Cloudinary upload successful:", result.secure_url);

    // Delete local file after successful upload
    try {
      fs.unlinkSync(req.file.path);
      console.log("🗑️ Local file deleted:", req.file.path);
    } catch (deleteError) {
      console.log("⚠️ Could not delete local file:", deleteError.message);
    }

    // Check if attendance already exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (attendance && attendance.checkInTime) {
      return res.status(400).json({
        message: "Check-in already recorded for today",
      });
    }

    // Create or update attendance
    if (!attendance) {
      attendance = new Attendance({
        employeeId: employee._id,
        employeeName: employee.name,
        date: today,
        checkInTime: new Date(),
        checkInImage: result.secure_url,
        status: "present",
      });
    } else {
      attendance.checkInTime = new Date();
      attendance.checkInImage = result.secure_url;
      attendance.status = "present";
    }

    await attendance.save();

    res.status(200).json({
      message: "Check-in successful",
      attendance: {
        id: attendance._id,
        employeeName: attendance.employeeName,
        checkInTime: attendance.checkInTime,
        status: attendance.status,
      },
    });
  } catch (err) {
    console.error("Check-In Error:", err);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("🗑️ Cleaned up temp file after error");
      } catch (cleanupError) {
        console.log("⚠️ Could not cleanup temp file:", cleanupError.message);
      }
    }

    res.status(500).json({
      message: "Error during check-in",
      error: err.message,
    });
  }
};

// Admin manual attendance recording for any employee/manager
exports.adminRecordEmployeeAttendance = async (req, res) => {
  try {
    const { employeeId, employeeName, type, date, time } = req.body;

    if (!employeeId || !employeeName || !type || !date) {
      return res.status(400).json({
        message:
          "All fields are required: employeeId, employeeName, type, date",
      });
    }

    if (!["checkin", "checkout"].includes(type)) {
      return res.status(400).json({
        message: "type must be either checkin or checkout",
      });
    }

    // Find employee (manager/employee/admin) by their string employeeId
    const employee = await Employee.findOne({ employeeId });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    // Normalize date to start of the day for attendance record (build using local Y/M/D)
    // Expecting date from frontend as "YYYY-MM-DD" (without timezone) so avoid new Date(string) UTC parsing
    let attendanceDate;
    try {
      const [y, m, d] = String(date).split("-").map(Number);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        // Construct local date at midnight
        attendanceDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      } else {
        // Fallback to previous behavior if parsing fails
        attendanceDate = new Date(date);
        attendanceDate.setHours(0, 0, 0, 0);
      }
    } catch (e) {
      attendanceDate = new Date(date);
      attendanceDate.setHours(0, 0, 0, 0);
    }

    // Build a Date object that combines the selected date with the admin-selected time in local time
    let selectedDateTime = null;
    if (time) {
      try {
        // Frontend sends time as "HH:mm" (e.g. "16:00" for 4 PM)
        const [hours, minutes] = time.split(":").map(Number);
        if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
          // Use the same Y/M/D as attendanceDate but with provided clock time
          selectedDateTime = new Date(
            attendanceDate.getFullYear(),
            attendanceDate.getMonth(),
            attendanceDate.getDate(),
            hours,
            minutes,
            0,
            0
          );
        }
      } catch (e) {
        console.warn(
          "⚠️ Failed to parse admin-selected time, falling back to current time",
          time,
          e.message
        );
      }
    }

    let attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: {
        $gte: attendanceDate,
        $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (type === "checkin") {
      if (attendance && attendance.checkInTime) {
        return res.status(400).json({
          message: "Check-in already recorded for this date",
        });
      }
    } else if (type === "checkout") {
      if (!attendance || !attendance.checkInTime) {
        return res.status(400).json({
          message: "No check-in record found for this date",
        });
      }
      if (attendance.checkOutTime) {
        return res.status(400).json({
          message: "Check-out already recorded for this date",
        });
      }
    }

    // Create attendance record if it does not exist yet
    if (!attendance) {
      attendance = new Attendance({
        employeeId: employee._id,
        employeeName,
        date: attendanceDate,
        status: "present",
      });
    }

    // Apply check-in / check-out
    if (type === "checkin") {
      // Use admin-selected time if provided, otherwise current time
      attendance.checkInTime = selectedDateTime || new Date();
      attendance.status = "present";
    } else if (type === "checkout") {
      // Use admin-selected time if provided, otherwise current time
      attendance.checkOutTime = selectedDateTime || new Date();
    }

    attendance.updatedAt = new Date();
    await attendance.save();

    res.status(200).json({
      message: `${type === "checkin" ? "Check-in" : "Check-out"} recorded successfully`,
      attendance: {
        id: attendance._id,
        employeeName: attendance.employeeName,
        employeeId: employee.employeeId,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        status: attendance.status,
        date: attendance.date,
        // Echo back the exact admin-selected clock time string for UI display
        time: time || null,
      },
    });
  } catch (err) {
    console.error("Admin manual attendance error:", err);
    res.status(500).json({
      message: "Error recording manual attendance",
      error: err.message,
    });
  }
};

// Employee Check-Out
exports.employeeCheckOut = async (req, res) => {
  try {
    const { employeeId } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        message: "Employee ID is required",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Live picture is required for check-out",
      });
    }

    // Find employee by employeeId (string field)
    const employee = await Employee.findOne({ employeeId: employeeId });
    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    // Verify face using AWS Rekognition (before uploading to Cloudinary)
    console.log("🔍 Starting face verification...");
    const faceVerification = await verifyEmployeeFace(
      employee.livePicture,
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
      `✅ Face verification successful! Similarity: ${faceVerification.similarity}%`
    );

    // Upload attendance image to Cloudinary
    console.log("☁️ Uploading to Cloudinary:", req.file.path);
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "attendance",
      resource_type: "auto",
    });

    console.log("✅ Cloudinary upload successful:", result.secure_url);

    // Delete local file after successful upload
    try {
      fs.unlinkSync(req.file.path);
      console.log("🗑️ Local file deleted:", req.file.path);
    } catch (deleteError) {
      console.log("⚠️ Could not delete local file:", deleteError.message);
    }

    // Find today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employeeId: employee._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (!attendance) {
      return res.status(400).json({
        message: "No check-in record found for today",
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        message: "Check-out already recorded for today",
      });
    }

    // Update attendance with check-out
    attendance.checkOutTime = new Date();
    attendance.checkOutImage = result.secure_url;
    attendance.updatedAt = new Date();

    await attendance.save();

    res.status(200).json({
      message: "Check-out successful",
      attendance: {
        id: attendance._id,
        employeeName: attendance.employeeName,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        status: attendance.status,
      },
    });
  } catch (err) {
    console.error("Check-Out Error:", err);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("🗑️ Cleaned up temp file after error");
      } catch (cleanupError) {
        console.log("⚠️ Could not cleanup temp file:", cleanupError.message);
      }
    }

    res.status(500).json({
      message: "Error during check-out",
      error: err.message,
    });
  }
};

// Manual Attendance Request
exports.manualAttendanceRequest = async (req, res) => {
  try {
    const { employeeId, employeeName, requestType, requestedTime, note } =
      req.body;

    if (
      !employeeId ||
      !employeeName ||
      !requestType ||
      !requestedTime ||
      !note
    ) {
      return res.status(400).json({
        message:
          "All fields are required: employeeId, employeeName, requestType, requestedTime, note",
      });
    }

    // Validate request type
    if (!["checkin", "checkout"].includes(requestType)) {
      return res.status(400).json({
        message: "Request type must be either checkin or checkout",
      });
    }

    // Check if employee exists
    const employee = await Employee.findOne({ employeeId: employeeId });
    if (!employee) {
      return res.status(404).json({
        message: "Employee not found",
      });
    }

    // Create manual attendance request
    const manualRequest = new ManualAttendanceRequest({
      employeeId: employee._id,
      employeeName,
      requestType,
      requestedTime,
      note,
    });

    await manualRequest.save();

    // Notify ALL admins (credential + face-auth)
    try {
      await notifyAllAdmins({
        title: "Manual Attendance Request",
        message: `${employeeName} (${employeeId}) has submitted a manual ${requestType} request for ${requestedTime}`,
        type: "attendance_request",
        priority: "medium",
        relatedEntityType: "attendance",
        relatedEntityId: manualRequest._id,
      });
    } catch (notificationError) {
      console.error(
        "Error creating attendance notification:",
        notificationError
      );
    }

    res.status(201).json({
      message: "Manual attendance request submitted successfully",
      request: {
        id: manualRequest._id,
        employeeName: manualRequest.employeeName,
        requestType: manualRequest.requestType,
        requestedTime: manualRequest.requestedTime,
        status: manualRequest.status,
      },
    });
  } catch (err) {
    console.error("Manual Attendance Request Error:", err);
    res.status(500).json({
      message: "Error submitting manual attendance request",
      error: err.message,
    });
  }
};

// Get Pending Manual Requests (Admin)
exports.getPendingManualRequests = async (req, res) => {
  try {
    const pendingRequests = await ManualAttendanceRequest.find({
      status: "pending",
    }).sort({ createdAt: -1 });

    res.status(200).json(pendingRequests);
  } catch (err) {
    console.error("Get Pending Requests Error:", err);
    res.status(500).json({
      message: "Error fetching pending requests",
      error: err.message,
    });
  }
};

// Approve/Decline Manual Request (Admin)
exports.approveDeclineManualRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, adminNotes } = req.body;

    if (!["approved", "declined"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either approved or declined",
      });
    }

    const request = await ManualAttendanceRequest.findById(requestId);
    if (!request) {
      return res.status(404).json({
        message: "Manual attendance request not found",
      });
    }

    if (request.status !== "pending") {
      return res.status(400).json({
        message: "This request has already been processed",
      });
    }

    // Update request status
    request.status = status;
    request.adminNotes = adminNotes || "";
    request.updatedAt = new Date();

    await request.save();

    // If approved, create or update attendance record
    if (status === "approved") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let attendance = await Attendance.findOne({
        employeeId: request.employeeId,
        date: {
          $gte: today,
          $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
      });

      if (!attendance) {
        attendance = new Attendance({
          employeeId: request.employeeId,
          employeeName: request.employeeName,
          date: today,
          status: "present",
          isManualRequest: true,
          manualRequestData: {
            requestType: request.requestType,
            requestedTime: request.requestedTime,
            note: request.note,
            status: "approved",
            adminNotes: adminNotes,
          },
        });
      } else {
        attendance.isManualRequest = true;
        attendance.manualRequestData = {
          requestType: request.requestType,
          requestedTime: request.requestedTime,
          note: request.note,
          status: "approved",
          adminNotes: adminNotes,
        };
      }

      // Set check-in or check-out time based on request type
      if (request.requestType === "checkin") {
        attendance.checkInTime = new Date(request.requestedTime);
      } else if (request.requestType === "checkout") {
        attendance.checkOutTime = new Date(request.requestedTime);
      }

      await attendance.save();
    }

    res.status(200).json({
      message: `Manual attendance request ${status} successfully`,
      request: {
        id: request._id,
        employeeName: request.employeeName,
        requestType: request.requestType,
        status: request.status,
        adminNotes: request.adminNotes,
      },
    });
  } catch (err) {
    console.error("Approve/Decline Manual Request Error:", err);
    res.status(500).json({
      message: "Error processing manual request",
      error: err.message,
    });
  }
};

// Get All Attendance Records
exports.getAllAttendanceRecords = async (req, res) => {
  try {
    const { date, employeeId, status } = req.query;

    let filter = {};

    if (date) {
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);
      filter.date = {
        $gte: selectedDate,
        $lt: new Date(selectedDate.getTime() + 24 * 60 * 60 * 1000),
      };
    }

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    if (status) {
      filter.status = status;
    }

    const attendanceRecords = await Attendance.find(filter)
      .populate("employeeId", "name employeeId role") // Include role in population
      .sort({ date: -1, createdAt: -1 });

    res.status(200).json(attendanceRecords);
  } catch (err) {
    console.error("Get All Attendance Records Error:", err);
    res.status(500).json({
      message: "Error fetching attendance records",
      error: err.message,
    });
  }
};

// Mark Absent Employees (Admin - Daily Task)
exports.markAbsentEmployees = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all employees
    const employees = await Employee.find();

    // Get today's attendance records
    const todayAttendance = await Attendance.find({
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    const presentEmployeeIds = todayAttendance.map((att) =>
      att.employeeId.toString()
    );

    // Mark absent employees
    const absentEmployees = [];
    for (const employee of employees) {
      if (!presentEmployeeIds.includes(employee._id.toString())) {
        // Check if attendance record already exists
        let attendance = await Attendance.findOne({
          employeeId: employee._id,
          date: {
            $gte: today,
            $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
          },
        });

        if (!attendance) {
          attendance = new Attendance({
            employeeId: employee._id,
            employeeName: employee.name,
            date: today,
            status: "absent",
          });
          await attendance.save();
        }

        absentEmployees.push({
          employeeId: employee.employeeId,
          name: employee.name,
        });
      }
    }

    res.status(200).json({
      message: "Absent employees marked successfully",
      absentCount: absentEmployees.length,
      absentEmployees,
    });
  } catch (err) {
    console.error("Mark Absent Employees Error:", err);
    res.status(500).json({
      message: "Error marking absent employees",
      error: err.message,
    });
  }
};

// Admin Attendance (for /admin/attendance endpoint)
exports.adminAttendanceCustom = async (req, res) => {
  try {
    const { employId, employeName, slectType, date } = req.body;

    if (!employId || !employeName || !slectType || !date) {
      return res.status(400).json({
        message: "All fields are required: employId, employeName, slectType, date",
      });
    }

    if (!["checkin", "checkout"].includes(slectType)) {
      return res.status(400).json({
        message: "slectType must be either checkin or checkout",
      });
    }

    // Find admin by employId (string field)
    const admin = await Employee.findOne({ employeeId: employId });
    if (!admin) {
      return res.status(404).json({
        message: "Admin not found",
      });
    }

    // Find or create attendance for the given date
    const attendanceDate = new Date(date);
    attendanceDate.setHours(0, 0, 0, 0);
    let attendance = await AdminAttendance.findOne({
      adminId: admin._id,
      date: {
        $gte: attendanceDate,
        $lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    if (slectType === "checkin") {
      if (attendance && attendance.checkInTime) {
        return res.status(400).json({
          message: "Check-in already recorded for this date",
        });
      }
    } else if (slectType === "checkout") {
      if (!attendance || !attendance.checkInTime) {
        return res.status(400).json({
          message: "No check-in record found for this date",
        });
      }
      if (attendance.checkOutTime) {
        return res.status(400).json({
          message: "Check-out already recorded for this date",
        });
      }
    }

    if (!attendance) {
      attendance = new AdminAttendance({
        adminId: admin._id,
        adminName: employeName,
        adminEmail: "fawad@gmail.com",
        date: attendanceDate,
        status: "present",
        attendanceType: slectType,
      });
    }

    if (slectType === "checkin") {
      attendance.checkInTime = new Date();
      attendance.status = "present";
    } else if (slectType === "checkout") {
      attendance.checkOutTime = new Date();
    }

    attendance.updatedAt = new Date();
    await attendance.save();

    res.status(200).json({
      message: `${slectType === "checkin" ? "Check-in" : "Check-out"} successful`,
      attendance: {
        id: attendance._id,
        adminName: attendance.adminName,
        adminEmail: attendance.adminEmail,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        status: attendance.status,
        attendanceType: slectType,
        date: attendance.date,
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

exports.handleFileUpload = handleFileUpload;
exports.deleteAttendanceRecord = deleteAttendanceRecord;
//completed it now 