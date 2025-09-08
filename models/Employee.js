const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema({
  employeeId: {
    type: String,
    required: true,
    unique: true,
    default: function () {
      // Generate employee ID with format: EMP + 3 digit sequence
      // Note: This will be overridden by the controller with proper sequential logic
      return `EMP001`;
    },
  },
  name: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
  },
  idCardNumber: {
    type: String,
    required: true,
    unique: true,
  },
  monthlySalary: {
    type: Number,
    required: true,
  },
  role: {
    type: String,
    enum: ["employee", "manager", "admin"],
    default: "employee",
    required: true,
  },
  livePicture: {
    type: String, // Cloudinary URL for attendance matching
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Employee", employeeSchema);
