const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  addAdvanceBooking,
  getAllAdvanceBookings,
  getUpcomingReminders,
  markReminderSent,
  updateBookingStatus,
  getBookingById,
  getBookingStats,
  deleteBooking,
  updateBooking,
  handleFileUpload,
} = require("../controller/advanceBookingController");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

// Add Advance Booking (Admin)
router.post("/add", upload.single("image"), addAdvanceBooking);

// Get Booking Statistics (MUST BE BEFORE /:bookingId)
router.get("/stats", getBookingStats);

// Get All Advance Bookings (with filters)
router.get("/all", getAllAdvanceBookings);

// Get Upcoming Reminders (24 hours before booking)
router.get("/reminders", getUpcomingReminders);

// Mark Reminder as Sent
router.put("/reminder/:bookingId", markReminderSent);

// Update Booking Status
router.put("/status/:bookingId", updateBookingStatus);

// Update Booking (Admin)
router.put("/:bookingId", upload.single("image"), updateBooking);

// Delete Booking (Admin)
router.delete("/:bookingId", deleteBooking);

// Get Booking by ID (MUST BE LAST)
router.get("/:bookingId", getBookingById);

module.exports = router;
