const express = require('express');
const router = express.Router();
const { addDeal, editDeal, deleteDeal, getAllDeals, handleFileUpload } = require('../controller/dealController');

// Add deal
router.post('/add', handleFileUpload, addDeal);
// Edit deal
router.put('/:id', handleFileUpload, editDeal);
// Delete deal
router.delete('/:id', deleteDeal);
// Get all deals
router.get('/all', getAllDeals);

module.exports = router;

