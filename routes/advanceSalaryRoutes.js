const express = require("express");
const router = express.Router();
const {
  addAdvanceSalaryRequest,
  getAllAdvanceSalaryRequests,
  getPendingAdvanceSalaryRequests,
  approveDeclineAdvanceSalary,
  getAdvanceSalaryById,
  getAdvanceSalaryStats,
  handleFileUpload,
} = require("../controller/advanceSalaryController");
const { authenticate } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(authenticate);

// Add Advance Salary Request (Manager)
router.post("/add", handleFileUpload, addAdvanceSalaryRequest);

// Get All Advance Salary Requests (with filters)
router.get("/all", getAllAdvanceSalaryRequests);

// Get Pending Advance Salary Requests (Admin)
router.get("/pending", getPendingAdvanceSalaryRequests);

// Get Advance Salary Statistics (MUST BE BEFORE /:requestId)
router.get("/stats", getAdvanceSalaryStats);

// Approve/Decline Advance Salary Request (Admin)
router.put("/approve/:requestId", approveDeclineAdvanceSalary);

// Get Advance Salary Request by ID
router.get("/:requestId", getAdvanceSalaryById);

module.exports = router;
