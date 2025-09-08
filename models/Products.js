const mongoose = require('mongoose');

const subProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  time: { type: String, required: true },
  description: String,
  image: String
});

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: String,
  subProducts: [subProductSchema]
});

module.exports = mongoose.model('Product', productSchema); 