require('dotenv').config();
const Deal = require('../models/Deal');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});
const upload = multer({ storage: storage }).any();

const handleFileUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: 'File upload error', error: err.message });
    }
    next();
  });
};

exports.addDeal = async (req, res) => {
  try {
    const { name, price, description } = req.body;
    let imageUrl = '';
    if (req.files && req.files.length > 0) {
      const file = req.files.find(f => f.fieldname === 'image');
      if (file) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'salon-deals',
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
        });
        imageUrl = result.secure_url;
      }
    }
    const deal = new Deal({ name, price, description, image: imageUrl });
    await deal.save();
    res.status(201).json({ message: 'Deal added', deal });
  } catch (err) {
    res.status(400).json({ message: 'Add deal error', error: err.message });
  }
};

exports.editDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, description } = req.body;
    let update = { name, price, description };
    if (req.files && req.files.length > 0) {
      const file = req.files.find(f => f.fieldname === 'image');
      if (file) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'salon-deals',
          resource_type: 'auto',
          use_filename: true,
          unique_filename: true,
        });
        update.image = result.secure_url;
      }
    }
    const deal = await Deal.findByIdAndUpdate(id, update, { new: true });
    if (!deal) return res.status(404).json({ message: 'Deal not found' });
    res.json({ message: 'Deal updated', deal });
  } catch (err) {
    res.status(400).json({ message: 'Edit deal error', error: err.message });
  }
};

exports.deleteDeal = async (req, res) => {
  try {
    const { id } = req.params;
    const deal = await Deal.findByIdAndDelete(id);
    if (!deal) return res.status(404).json({ message: 'Deal not found' });
    res.json({ message: 'Deal deleted' });
  } catch (err) {
    res.status(400).json({ message: 'Delete deal error', error: err.message });
  }
};

exports.getAllDeals = async (req, res) => {
  try {
    const deals = await Deal.find({}, 'name price description image');
    res.json(deals);
  } catch (err) {
    res.status(500).json({ message: 'Get deals error', error: err.message });
  }
};

exports.handleFileUpload = handleFileUpload;