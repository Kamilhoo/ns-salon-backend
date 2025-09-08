const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authMiddleware");
const {
  getAllPendingApprovals,
  approveDeclineRequest,
  getApprovalStats,
  getRequestDetails,
} = require("../controller/unifiedApprovalController");

// Get All Pending Approvals (Unified Dashboard)
router.get("/pending", authenticate, getAllPendingApprovals);

// Approve/Decline Request (Unified)
router.put(
  "/approve/:requestType/:requestId",
  authenticate,
  approveDeclineRequest
);

// Get Approval Statistics
router.get("/stats", authenticate, getApprovalStats);

// Get Request Details by Type and ID
router.get("/details/:requestType/:requestId", authenticate, getRequestDetails);

module.exports = router;
