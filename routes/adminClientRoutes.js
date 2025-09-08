const express = require("express");
const router = express.Router();

const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const {
  addAdminClient,
  getAllAdminClients,
  getAdminClientById,
  updateAdminClient,
  deleteAdminClient,
  getAdminClientStats,
  searchAdminClients,
  assignManagerToClient,
} = require("../controller/adminClientController");

// All routes require admin authentication
router.use(authenticate);
router.use(authorizeRoles("admin"));

// Admin Client CRUD operations
router.post("/add", addAdminClient);
router.get("/all", getAllAdminClients);
router.get("/search", searchAdminClients);
router.get("/stats", getAdminClientStats);
router.get("/:id", getAdminClientById);
router.put("/:id", updateAdminClient);
router.delete("/:id", deleteAdminClient);

// Special operations
router.put("/:id/assign-manager", assignManagerToClient);

module.exports = router;
