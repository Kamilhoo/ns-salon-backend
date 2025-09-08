const express = require("express");
const router = express.Router();
const {
  employeeCheckIn,
  employeeCheckOut,
  manualAttendanceRequest,
  getPendingManualRequests,
  approveDeclineManualRequest,
  getAllAttendanceRecords,
  markAbsentEmployees,
  handleFileUpload,
} = require("../controller/attendanceController");

// Import authentication middleware
const { authenticateToken } = require("../middleware/authMiddleware");

// Employee Check-In with live picture (requires authentication)
router.post("/checkin", authenticateToken, handleFileUpload, employeeCheckIn);

// Employee Check-Out with live picture (requires authentication)
router.post("/checkout", authenticateToken, handleFileUpload, employeeCheckOut);

// Manual Attendance Request (for late employees) - no auth required
router.post("/manual-request", manualAttendanceRequest);

// Get Pending Manual Requests (Admin) - requires authentication
router.get("/pending-requests", authenticateToken, getPendingManualRequests);

// Approve/Decline Manual Request (Admin) - requires authentication
router.put(
  "/approve-request/:requestId",
  authenticateToken,
  approveDeclineManualRequest
);

// Get All Attendance Records (with filters) - requires authentication
router.get("/all", authenticateToken, getAllAttendanceRecords);

// Mark Absent Employees (Admin - Daily Task) - requires authentication
router.post("/mark-absent", authenticateToken, markAbsentEmployees);

module.exports = router;
