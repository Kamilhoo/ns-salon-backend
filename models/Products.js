const mongoose = require("mongoose");

const subProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  time: { type: String, required: true },
  description: String,
  image: String,
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: String,
  subProducts: [subProductSchema],
  status: { type: String, enum: ["show", "hide"], default: "show" }, // Added status field
});

module.exports = mongoose.model("Product", productSchema);
