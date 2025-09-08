const express = require("express");
const router = express.Router();
const {
  addExpense,
  getAllExpenses,
  getPendingExpenses,
  getManagerPendingExpenses,
  approveDeclineExpense,
  getExpenseById,
  getExpenseStats,
  handleFileUpload,
} = require("../controller/expenseController");
const { authenticate } = require("../middleware/authMiddleware");

// Add Expense (Manager/Admin) - Protected route
router.post("/add", authenticate, handleFileUpload, addExpense);

// Get All Expenses (with filters) - Protected route
router.get("/all", authenticate, getAllExpenses);

// Get Pending Expenses (Admin) - Protected route
router.get("/pending", authenticate, getPendingExpenses);

// Get Manager's Pending Expenses - Protected route
router.get("/manager/pending", authenticate, getManagerPendingExpenses);

// Approve/Decline Expense (Admin) - Protected route
router.put("/:expenseId", authenticate, approveDeclineExpense);

// Get Expense by ID - Protected route
router.get("/:expenseId", authenticate, getExpenseById);

// Get Expense Statistics (Admin) - Protected route
router.get("/stats", authenticate, getExpenseStats);

module.exports = router;
