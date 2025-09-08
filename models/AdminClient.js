const mongoose = require("mongoose");

const adminClientSchema = new mongoose.Schema({
  clientId: {
    type: String,
    required: true,
    unique: true,
    default: function () {
      const year = new Date().getFullYear();
      return `ACLT${year}${Math.floor(Math.random() * 9000) + 1000}`;
    },
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
});

// Remove duplicate index declarations since unique: true already creates indexes
// adminClientSchema.index({ clientId: 1 });
// adminClientSchema.index({ phoneNumber: 1 });
adminClientSchema.index({ name: 1 }); // Keep this one as it's not unique

module.exports = mongoose.model("AdminClient", adminClientSchema);
