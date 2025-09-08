const mongoose = require("mongoose");

const adminAttendanceSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true,
  },
  adminCustomId: { type: String }, // Store custom admin ID like "ADM001" for reference
  adminName: { type: String, required: true },
  adminEmail: { type: String, required: true },
  date: { type: Date, default: Date.now },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  checkInImage: { type: String }, // Cloudinary URL for check-in picture
  checkOutImage: { type: String }, // Cloudinary URL for check-out picture
  status: {
    type: String,
    enum: ["present", "absent"],
    default: "absent",
  },
  attendanceType: {
    type: String,
    enum: ["checkin", "checkout"],
    required: true,
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Compound index to ensure one attendance record per admin per day
adminAttendanceSchema.index({ adminId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("AdminAttendance", adminAttendanceSchema);
