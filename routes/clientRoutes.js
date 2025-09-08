const express = require("express");
const router = express.Router();

const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const {
  addClient,
  getAllClients,
  getClientById,
  updateClient,
  deleteClient,
  getClientStats,
  searchClients,
  checkPhoneNumber,
  getClientHistory,
  addVisitToClient,
} = require("../controller/clientController");

// All routes require manager or admin authentication
router.use(authenticate);
router.use(authorizeRoles("manager", "admin"));

// Client CRUD operations
router.post("/add", addClient);
router.get("/all", getAllClients);
router.get("/search", searchClients);
router.get("/stats", getClientStats);
router.get("/check-phone", checkPhoneNumber);

// Specific routes must come before parameterized routes
router.get("/:clientId/history", getClientHistory);
router.post("/:clientId/visit", addVisitToClient);

// Parameterized routes come last
router.get("/:id", getClientById);
router.put("/:id", updateClient);
router.delete("/:id", deleteClient);

module.exports = router;
