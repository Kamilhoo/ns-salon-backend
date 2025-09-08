const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  role: {
    type: String,
    enum: ["employee", "admin", "manager"],
    default: "employee",
  },
  // Face authentication fields
  faceImageUrl: { type: String, required: true }, // Cloudinary URL
  faceRegistered: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },

  // Fields for employee and manager roles
  employeeId: { type: String, required: false, sparse: true },
  phoneNumber: { type: Number, required: false, sparse: true },
  idCardNumber: { type: Number, required: false, sparse: true },
  monthlySalary: { type: String, required: false, sparse: true },

  // The user (admin/manager) who created this account
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
});

module.exports = mongoose.model("User", userSchema);
