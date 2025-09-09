const mongoose = require("mongoose");

const gstConfigSchema = new mongoose.Schema({
  gstPercentage: {
    type: Number,
    required: true,
    default: 7,
    min: 0,
    max: 100
  },
  isActive: {
    type: Boolean,
    default: true
  },
  appliedTo: {
    type: String,
    enum: ["all", "services", "products", "deals"],
    default: "all"
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true
  },
  updatedByName: {
    type: String,
    required: true
  },
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
gstConfigSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Ensure only one GST configuration exists
gstConfigSchema.index({}, { unique: true });

module.exports = mongoose.model("GSTConfig", gstConfigSchema);
