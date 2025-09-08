const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  specialist: { type: String, required: true },
  duration: { type: String, required: true },
  service: { type: String, required: true }
});

module.exports = mongoose.model('Bill', billSchema);
