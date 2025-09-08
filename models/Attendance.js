const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },
  employeeName: { type: String, required: true },
  date: { type: Date, default: Date.now },
  checkInTime: { type: Date },
  checkOutTime: { type: Date },
  checkInImage: { type: String }, // Cloudinary URL for check-in picture
  checkOutImage: { type: String }, // Cloudinary URL for check-out picture
  status: { 
    type: String, 
    enum: ['present', 'absent', 'late'], 
    default: 'absent' 
  },
  isManualRequest: { type: Boolean, default: false },
  manualRequestData: {
    requestType: { type: String, enum: ['checkin', 'checkout'] },
    requestedTime: String,
    note: String,
    status: { type: String, enum: ['pending', 'approved', 'declined'], default: 'pending' },
    adminNotes: String
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Compound index to ensure one attendance record per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema); 