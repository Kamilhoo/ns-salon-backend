const mongoose = require('mongoose');

const subServiceSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  time: { type: String, required: true },
  description: String,
  image: String
});

const serviceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  image: String,
  subServices: [subServiceSchema]
});

module.exports = mongoose.model('Service', serviceSchema);
