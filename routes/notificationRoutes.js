const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationCount,
  getUpcomingReminders,
  createNotification,
} = require("../controller/notificationController");

// Import authentication middleware
const { authenticate, authorizeRoles } = require("../middleware/authMiddleware");

// All routes require authentication
router.use(authenticate);

// Get notifications for current user
router.get("/", getNotifications);

// Get notification count (for navbar badge)
router.get("/count", getNotificationCount);

// Get upcoming advance booking reminders (for alarm icon)
router.get("/reminders", getUpcomingReminders);

// Mark notification as read
router.put("/:notificationId/read", markAsRead);

// Mark all notifications as read
router.put("/mark-all-read", markAllAsRead);

// Delete notification
router.delete("/:notificationId", deleteNotification);

// Create notification (admin only)
router.post("/create", authorizeRoles("admin"), createNotification);

module.exports = router;
