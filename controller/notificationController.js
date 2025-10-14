const Notification = require("../models/Notification");
const Admin = require("../models/Admin");
const Manager = require("../models/Manager");

// Get notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, isRead } = req.query;

    console.log("🔔 [Notifications] Getting notifications for user:", req.user);
    console.log("🔔 [Notifications] User ID extraction:", {
      adminId: req.user.adminId,
      managerId: req.user.managerId,
      _id: req.user._id,
    });

    let userId = req.user.adminId || req.user.managerId || req.user._id;
    const userRole = req.user.role;

    // Safe fallback for face-auth admins missing adminId
    if (!userId && userRole === "admin" && req.user._id) {
      console.log(
        "🔧 [Notifications] Fallback: using _id as adminId for face-auth admin"
      );
      userId = req.user._id;
    }

    console.log("🔔 [Notifications] Final user ID:", userId);
    console.log("🔔 [Notifications] User role:", userRole);

    // Build filter
    const filter = {
      recipientId: userId,
      isActive: true,
    };

    if (type) {
      filter.type = type;
    }

    if (isRead !== undefined) {
      filter.isRead = isRead === "true";
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get notifications
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalNotifications = await Notification.countDocuments(filter);
    const unreadCount = await Notification.countDocuments({
      ...filter,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      message: "Notifications retrieved successfully",
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalNotifications / parseInt(limit)),
          totalNotifications,
          unreadCount,
          hasNext: skip + notifications.length < totalNotifications,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error getting notifications:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving notifications",
      error: error.message,
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    let userId = req.user.adminId || req.user.managerId || req.user._id;
    if (!userId && req.user.role === "admin" && req.user._id) {
      userId = req.user._id;
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notification.isRead = true;
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking notification as read",
      error: error.message,
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    let userId = req.user.adminId || req.user.managerId || req.user._id;
    if (!userId && req.user.role === "admin" && req.user._id) {
      userId = req.user._id;
    }

    await Notification.updateMany(
      {
        recipientId: userId,
        isRead: false,
        isActive: true,
      },
      {
        isRead: true,
      }
    );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      message: "Error marking all notifications as read",
      error: error.message,
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    let userId = req.user.adminId || req.user.managerId || req.user._id;
    if (!userId && req.user.role === "admin" && req.user._id) {
      userId = req.user._id;
    }

    const notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    notification.isActive = false;
    await notification.save();

    res.status(200).json({
      success: true,
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting notification",
      error: error.message,
    });
  }
};

// Get notification count (for navbar badge)
exports.getNotificationCount = async (req, res) => {
  try {
    let userId = req.user.adminId || req.user.managerId || req.user._id;
    if (!userId && req.user.role === "admin" && req.user._id) {
      userId = req.user._id;
    }

    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
      isActive: true,
    });

    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error("Error getting notification count:", error);
    res.status(500).json({
      success: false,
      message: "Error getting notification count",
      error: error.message,
    });
  }
};

// Get upcoming advance booking reminders (for alarm icon)
exports.getUpcomingReminders = async (req, res) => {
  try {
    const userId = req.user.adminId || req.user.managerId || req.user._id;
    const now = new Date();
    const next24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const reminders = await Notification.find({
      recipientId: userId,
      type: "advance_booking_reminder",
      scheduledFor: {
        $gte: now,
        $lte: next24Hours,
      },
      isActive: true,
    }).sort({ scheduledFor: 1 });

    res.status(200).json({
      success: true,
      message: "Upcoming reminders retrieved successfully",
      reminders,
    });
  } catch (error) {
    console.error("Error getting upcoming reminders:", error);
    res.status(500).json({
      success: false,
      message: "Error getting upcoming reminders",
      error: error.message,
    });
  }
};

// Create notification (admin only)
exports.createNotification = async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      recipientType,
      recipientId,
      priority = "medium",
    } = req.body;

    // Validate required fields
    if (!title || !message || !type || !recipientType) {
      return res.status(400).json({
        success: false,
        message: "Title, message, type, and recipientType are required",
      });
    }

    const notification = new Notification({
      title,
      message,
      type,
      recipientType,
      recipientId: recipientId || null,
      recipientModel: recipientType === "admin" ? "Admin" : "Manager",
      priority,
    });

    await notification.save();

    res.status(201).json({
      success: true,
      message: "Notification created successfully",
      notification,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    res.status(500).json({
      success: false,
      message: "Error creating notification",
      error: error.message,
    });
  }
};
