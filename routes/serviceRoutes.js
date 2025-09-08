const express = require("express");
const router = express.Router();

const {
  authenticate,
  authorizeRoles,
} = require("../middleware/authMiddleware");
const multer = require("multer");
const {
  getAllServices,
  addService,
  getServiceById,
  deleteService,
  updateService,
} = require("../controller/serviceController");

// Configure multer with proper storage and error handling
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// Use .any() to accept files with any field name (handles dynamic subServiceImage fields)
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Optional: Add file type validation
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
}).any();

// Custom middleware to handle multer errors
const handleFileUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      console.error("Multer Error:", err);
      return res.status(400).json({
        message: "File upload error",
        error: err.message,
      });
    }
    next();
  });
};

router.get("/", getAllServices);

// Get service by ID
router.get("/:id", getServiceById);

router.post(
  "/admin/add",
  authenticate,
  authorizeRoles("admin"),
  handleFileUpload, // Use our custom middleware instead of direct multer
  addService
);

// Update service (admin only)
router.put(
  "/admin/:id",
  authenticate,
  authorizeRoles("admin"),
  handleFileUpload,
  updateService
);

// Delete service (admin only)
router.delete(
  "/admin/:id",
  authenticate,
  authorizeRoles("admin"),
  deleteService
);

module.exports = router;
