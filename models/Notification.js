const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  // Notification Details
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: [
      "advance_booking_reminder", // 24-hour booking reminder
      "attendance_request", // Manager attendance request
      "expense_request", // Manager expense request
      "advance_salary_request", // Manager advance salary request
      "system_alert", // System notifications
      "general" // General notifications
    ],
    required: true
  },
  
  // Recipients
  recipientType: {
    type: String,
    enum: ["admin", "manager", "both"],
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: "recipientModel"
  },
  recipientModel: {
    type: String,
    enum: ["Admin", "Manager", "User"],
    required: true
  },
  
  // Related Data
  relatedEntityType: {
    type: String,
    enum: ["advance_booking", "attendance", "expense", "advance_salary", "none"],
    default: "none"
  },
  relatedEntityId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  
  // Notification Status
  isRead: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Scheduling (for advance booking reminders)
  scheduledFor: {
    type: Date,
    default: null
  },
  sentAt: {
    type: Date,
    default: null
  },
  
  // Priority
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium"
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
notificationSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Indexes for better performance
notificationSchema.index({ recipientId: 1, isRead: 1 });
notificationSchema.index({ type: 1, isActive: 1 });
notificationSchema.index({ scheduledFor: 1, isActive: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
