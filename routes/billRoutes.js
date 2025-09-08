const express = require("express");
const router = express.Router();

const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const {
  createBill,
  getClientBillingHistory,
  getBillById,
  updateBillPayment,
  searchBillsByClient,
  getManagerBillingStats,
  cancelBill,
} = require("../controller/billController");

// All routes require manager authentication
router.use(authenticate);
router.use(authorizeRoles("manager"));

// Bill CRUD operations
router.post("/create", createBill);
router.get("/client/:clientId/history", getClientBillingHistory);
router.get("/:billId", getBillById);
router.put("/:billId/payment", updateBillPayment);
router.put("/:billId/cancel", cancelBill);

// Search and analytics
router.get("/search/client", searchBillsByClient);
router.get("/stats", getManagerBillingStats);

module.exports = router;
