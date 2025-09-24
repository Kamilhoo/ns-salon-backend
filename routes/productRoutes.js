const express = require("express");
const router = express.Router();
const {
  addProduct,
  getAllProducts,
  getProductById,
  deleteProduct,
  updateProduct,
  handleFileUpload,
  changeProductStatus, // Import the new handler
} = require("../controller/productController");

const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// Add product with file upload (admin only)
router.post(
  "/add",
  authenticate,
  authorizeRoles("admin"),
  handleFileUpload,
  addProduct
);

// Get all products (public)
router.get("/all", getAllProducts);

// Get product by ID (public)
router.get("/:id", getProductById);

// Update product (admin only)
router.put(
  "/:id",
  authenticate,
  authorizeRoles("admin"),
  handleFileUpload,
  updateProduct
);

// Change product status (admin only)
router.put(
  "/:id/status",
  authenticate,
  authorizeRoles("admin"),
  changeProductStatus
);

// Delete product (admin only)
router.delete("/:id", authenticate, authorizeRoles("admin"), deleteProduct);

module.exports = router;
