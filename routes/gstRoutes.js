const express = require("express");
const router = express.Router();
const {
  getGSTConfig,
  updateGSTConfig,
  getGSTForBilling,
  calculateGST,
} = require("../controller/gstController");

// Import authentication middleware
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

// Admin routes (require admin authentication)
router.get("/admin/config", authenticate, authorizeRoles("admin"), getGSTConfig);
router.put("/admin/config", authenticate, authorizeRoles("admin"), updateGSTConfig);

// Manager routes (for billing - require manager authentication)
router.get("/billing", authenticate, authorizeRoles("manager"), getGSTForBilling);
router.post("/calculate", authenticate, authorizeRoles("manager"), calculateGST);

module.exports = router;
