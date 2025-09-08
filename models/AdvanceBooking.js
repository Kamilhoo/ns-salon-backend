const mongoose = require("mongoose");

const advanceBookingSchema = new mongoose.Schema({
  clientId: { type: String, required: true, unique: true },
  clientName: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  advancePayment: { type: Number, required: true },
  description: { type: String, required: true },
  phoneNumber: { type: String, required: true },
  image: {
    type: String,
    required: false,
    default: "https://via.placeholder.com/300x300?text=No+Image",
  },
  reminderDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ["pending", "confirmed", "completed", "cancelled"],
    default: "confirmed",
  },
  reminderSent: { type: Boolean, default: false },
  reminderSentAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AdvanceBooking", advanceBookingSchema);
