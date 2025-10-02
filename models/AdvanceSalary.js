const mongoose = require('mongoose');

const advanceSalarySchema = new mongoose.Schema({
  employeeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Employee', 
    required: true 
  },
  employeeName: { type: String, required: true },
  employeeLivePicture: { type: String, required: true }, // Cloudinary URL
  amount: { type: Number, required: true },
  image: { type: String, required: true }, // Cloudinary URL for additional proof
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Manager', required: true },
  submittedByName: { type: String, required: true }, // Manager name
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'declined'], 
    default: 'pending' 
  },
  adminNotes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AdvanceSalary', advanceSalarySchema); 