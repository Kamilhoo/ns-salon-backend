const mongoose = require("mongoose");

const businessSettingsSchema = new mongoose.Schema({
  currentBusinessDay: {
    type: Date,
    required: true,
    default: Date.now,
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'updaterModel'
  },
  updaterModel: {
    type: String,
    enum: ['Admin', 'Manager'],
  }
}, { timestamps: true });

module.exports = mongoose.model("BusinessSettings", businessSettingsSchema);
