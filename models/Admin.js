const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  adminId: {
    type: String,
    required: true,
    unique: true,
    default: function () {
      // Generate admin ID with format: ADM + 3 digit sequence
      // Note: This will be overridden by the controller with proper sequential logic
      return `ADM001`;
    },
  },
  name: { type: String, required: true },
  email: { type: String, required: true }, // Email is compulsory
  password: { type: String, required: true }, // Password is compulsory
  phoneNumber: { type: String, required: true, unique: true },
  idCardNumber: { type: String, required: true, unique: true },
  monthlySalary: { type: Number, required: true },
  livePicture: { type: String }, // Cloudinary URL for attendance matching (optional for admin)
  role: { type: String, default: "admin" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Admin", adminSchema);
