const mongoose = require('mongoose');

const manualAttendanceRequestSchema = new mongoose.Schema({
  employeeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },
  employeeName: { type: String, required: true },
  requestType: { 
    type: String, 
    enum: ['checkin', 'checkout'], 
    required: true 
  },
  requestedTime: { type: String, required: true },
  note: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'declined'], 
    default: 'pending' 
  },
  adminNotes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ManualAttendanceRequest', manualAttendanceRequestSchema); 