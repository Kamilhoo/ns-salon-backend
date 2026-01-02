const mongoose = require('mongoose');

const dealSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: String,
  image: String,
  // Flag to control visibility on employee side
  isHiddenFromEmployee: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model('Deal', dealSchema);