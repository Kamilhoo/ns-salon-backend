const express = require("express");
const router = express.Router();
const {
  addAdmin,
  getAllAdmins,
  adminAttendance,
  getAllAdminAttendance,
  getAllCombinedAttendance,
  getAdminAttendanceById,
  markAbsentAdmins,
  handleFileUpload,
} = require("../controller/adminController");

// Import authentication middleware
const { authenticateToken } = require("../middleware/authMiddleware");

// Import unified user controller for role-based user creation
const {
  addEmployee,
  handleFileUpload: handleUnifiedFileUpload,
} = require("../controller/unifiedUserController");

// Add Admin (live picture optional) - supports both form-data and JSON (requires authentication)
router.post(
  "/add",
  authenticateToken,
  (req, res, next) => {
    // If content-type is JSON, skip file upload middleware
    if (
      req.headers["content-type"] &&
      req.headers["content-type"].includes("application/json")
    ) {
      return addAdmin(req, res, next);
    }
    // Otherwise use file upload middleware
    handleFileUpload(req, res, next);
  },
  addAdmin
);

// Get All Admins (requires authentication)
router.get("/all", authenticateToken, getAllAdmins);

// Admin Attendance (Check-In/Check-Out) - with live picture support (requires authentication)
router.post(
  "/attendance",
  authenticateToken,
  handleFileUpload,
  adminAttendance
);

// Get All Admin Attendance Records (with filters) (requires authentication)
router.get("/attendance/all", authenticateToken, getAllAdminAttendance);

// Get All Combined Attendance Records (Admin + Employee/Manager) (requires authentication)
router.get("/attendance/combined", authenticateToken, getAllCombinedAttendance);

// Get Admin Attendance by ID (requires authentication)
router.get("/attendance/:adminId", authenticateToken, getAdminAttendanceById);

// Mark Absent Admins (Daily Task) (requires authentication)
router.post("/mark-absent", authenticateToken, markAbsentAdmins);

// Admin Login with Email/Password (no authentication required)
router.post("/login", require("../controller/adminController").adminLogin);

// Note: Step-by-step user registration routes removed as functions don't exist
// Use /add-user route for complete user registration

// Add User (Admin/Manager/Employee) - Legacy unified API (keeping for backward compatibility) (requires authentication)
router.post(
  "/add-user",
  authenticateToken,
  (req, res, next) => {
    // If content-type is JSON, skip file upload middleware
    if (
      req.headers["content-type"] &&
      req.headers["content-type"].includes("application/json")
    ) {
      return addEmployee(req, res, next);
    }
    // Otherwise use file upload middleware
    handleUnifiedFileUpload(req, res, next);
  },
  addEmployee
);

module.exports = router;
