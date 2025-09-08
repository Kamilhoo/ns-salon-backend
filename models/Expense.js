const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, required: true },
  image: {
    type: String,
    required: false,
    default: "https://via.placeholder.com/400x300?text=No+Image",
  },
  status: {
    type: String,
    enum: ["pending", "approved", "declined"],
    default: "pending",
  },
  remarks: { type: String, default: "" },
  userRole: { type: String, enum: ["admin", "manager"], default: "manager" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Expense", expenseSchema);
