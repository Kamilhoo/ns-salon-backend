// notificationController.js
const Notification = require("../models/Notification");
const Admin = require("../models/Admin");
const Manager = require("../models/Manager");
const Employee = require("../models/Employee");

// ========== HELPER FUNCTION ==========
/**
 * Send notification to ALL admins (both credential and face auth)
 * @param {Object} notificationData - Notification data without recipientId
 * @returns {Promise<boolean>} Success status
 */
async function notifyAllAdmins(notificationData) {
  try {
    const notifications = [];

    // 1️⃣ Get credential admin from Admin collection
    const credentialAdmin = await Admin.findOne().sort({ createdAt: -1 });
    if (credentialAdmin) {
      notifications.push({
        ...notificationData,
        recipientId: credentialAdmin._id,
        recipientType: "admin",
        recipientModel: "Admin",
      });
      console.log(
        "✅ [notifyAllAdmins] Added credential admin:",
        credentialAdmin._id
      );
    }

    // (removed misplaced 'both' handling; this belongs in createNotification)

    // 2️⃣ Get ALL face auth admins from Employee collection
    const faceAuthAdmins = await Employee.find({
      role: "admin",
      isActive: true,
    });

    if (faceAuthAdmins && faceAuthAdmins.length > 0) {
      faceAuthAdmins.forEach((admin) => {
        notifications.push({
          ...notificationData,
          recipientId: admin._id,
          recipientType: "admin",
          recipientModel: "Employee",
        });
      });
      console.log(
        `✅ [notifyAllAdmins] Added ${faceAuthAdmins.length} face auth admin(s)`
      );
    }

    // Create all notifications at once
    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(
        `✅ [notifyAllAdmins] Total ${notifications.length} notification(s) created successfully`
      );
      return true;
    } else {
      console.warn("⚠️ [notifyAllAdmins] No admin found to send notification");
      return false;
    }
  } catch (error) {
    console.error("❌ [notifyAllAdmins] Error creating notifications:", error);
    return false;
  }
}
// ========== END HELPER FUNCTION ==========

// ========== HELPER FUNCTION: notify all MANAGERS ==========
async function notifyAllManagers(notificationData) {
  try {
    const notifications = [];

    // 1️⃣ Get credential manager(s) from Manager collection
    const managers = await Manager.find({});
    if (managers && managers.length > 0) {
      managers.forEach((mgr) => {
        notifications.push({
          ...notificationData,
          recipientId: mgr._id,
          recipientType: "manager",
          recipientModel: "Manager",
        });
      });
      console.log(`✅ [notifyAllManagers] Added ${managers.length} manager(s)`);
    }

    // 2️⃣ Get face auth managers from Employee collection
    const faceAuthManagers = await Employee.find({ role: "manager", isActive: true });
    if (faceAuthManagers && faceAuthManagers.length > 0) {
      faceAuthManagers.forEach((m) => {
        notifications.push({
          ...notificationData,
          recipientId: m._id,
          recipientType: "manager",
          recipientModel: "Employee",
        });
      });
      console.log(
        `✅ [notifyAllManagers] Added ${faceAuthManagers.length} face auth manager(s)`
      );
    }

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
      console.log(
        `✅ [notifyAllManagers] Total ${notifications.length} notification(s) created successfully`
      );
      return true;
    } else {
      console.warn("⚠️ [notifyAllManagers] No manager found to send notification");
      return false;
    }
  } catch (error) {
    console.error("❌ [notifyAllManagers] Error creating notifications:", error);
    return false;
  }
}
// ========== END HELPER FUNCTION ==========

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

    const userId = req.user.adminId || req.user.managerId || req.user._id;
    const userRole = req.user.role;

    console.log("🔔 [Notifications] Final user ID:", userId);
    console.log("🔔 [Notifications] User role:", userRole);

    // Build filter: include direct, role-wide, and 'both' notifications
    const now = new Date();
    let filter = {
      isActive: true,
      $and: [
        {
          $or: [
            { scheduledFor: { $exists: false } },
            { scheduledFor: null },
            { scheduledFor: { $lte: now } },
            { sentAt: { $ne: null } },
          ],
        },
      ],
    };
    if (userRole === "admin") {
      filter.$or = [
        { recipientId: userId },
        { recipientType: "admin" },
        { recipientType: "both" },
      ];
    } else if (userRole === "manager") {
      filter.$or = [
        { recipientId: userId },
        { recipientType: "manager" },
        { recipientType: "both" },
      ];
    } else {
      // Fallback: only direct notifications
      filter.recipientId = userId;
    }

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
    const userId = req.user.adminId || req.user.managerId || req.user._id;
    const userRole = req.user.role;

    // First try to mark the user's own notification
    let notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId,
      isActive: true,
    });

    // If not found and user is admin, allow marking admin-wide notification
    if (!notification && userRole === "admin") {
      notification = await Notification.findOne({
        _id: notificationId,
        recipientType: "admin",
        isActive: true,
      });
    }

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
    const userId = req.user.adminId || req.user.managerId || req.user._id;
    const userRole = req.user.role;

    // Base query for this user
    const baseQuery = {
      isRead: false,
      isActive: true,
    };

    // If admin, include admin-wide notifications
    const query =
      userRole === "admin"
        ? { ...baseQuery, $or: [{ recipientId: userId }, { recipientType: "admin" }] }
        : { ...baseQuery, recipientId: userId };

    await Notification.updateMany(query, { isRead: true });

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
    const userId = req.user.adminId || req.user.managerId || req.user._id;
    const userRole = req.user.role;

    // First try to find user's own notification
    let notification = await Notification.findOne({
      _id: notificationId,
      recipientId: userId,
      isActive: true,
    });

    // If not found and user is admin, allow deleting admin-wide notification
    if (!notification && userRole === "admin") {
      notification = await Notification.findOne({
        _id: notificationId,
        recipientType: "admin",
        isActive: true,
      });
    }

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
    const userId = req.user.adminId || req.user.managerId || req.user._id;

    const now = new Date();
    const unreadCount = await Notification.countDocuments({
      recipientId: userId,
      isRead: false,
      isActive: true,
      $or: [
        { scheduledFor: { $exists: false } },
        { scheduledFor: null },
        { scheduledFor: { $lte: now } },
        { sentAt: { $ne: null } },
      ],
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
      relatedId,
      relatedModel,
    } = req.body;

    // Validate required fields
    if (!title || !message || !type || !recipientType) {
      return res.status(400).json({
        success: false,
        message: "Title, message, type, and recipientType are required",
      });
    }

    // ✅ Broadcasts when no specific recipientId is provided
    if (recipientType === "admin" && !recipientId) {
      const success = await notifyAllAdmins({
        title,
        message,
        type,
        priority,
        relatedId: relatedId || null,
        relatedModel: relatedModel || null,
      });

      if (success) {
        return res.status(201).json({
          success: true,
          message: "Notifications sent to all admins successfully",
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to send notifications to admins",
        });
      }
    }

    if (recipientType === "manager" && !recipientId) {
      const success = await notifyAllManagers({
        title,
        message,
        type,
        priority,
        relatedId: relatedId || null,
        relatedModel: relatedModel || null,
      });

      if (success) {
        return res.status(201).json({
          success: true,
          message: "Notifications sent to all managers successfully",
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to send notifications to managers",
        });
      }
    }

    if (recipientType === "both" && !recipientId) {
      const [adminSuccess, managerSuccess] = await Promise.all([
        notifyAllAdmins({
          title,
          message,
          type,
          priority,
          relatedId: relatedId || null,
          relatedModel: relatedModel || null,
        }),
        notifyAllManagers({
          title,
          message,
          type,
          priority,
          relatedId: relatedId || null,
          relatedModel: relatedModel || null,
        }),
      ]);

      if (adminSuccess || managerSuccess) {
        return res.status(201).json({
          success: true,
          message: "Notifications sent to admins and managers successfully",
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to send notifications to admins/managers",
        });
      }
    }

    // ✅ If specific recipientId provided, create single notification
    const notification = new Notification({
      title,
      message,
      type,
      recipientType,
      recipientId: recipientId,
      recipientModel: recipientType === "admin" ? "Admin" : "Manager",
      priority,
      relatedId: relatedId || null,
      relatedModel: relatedModel || null,
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

// ✅ EXPORT THE HELPER FUNCTIONS (for use in other controllers)
exports.notifyAllAdmins = notifyAllAdmins;
exports.notifyAllManagers = notifyAllManagers;
