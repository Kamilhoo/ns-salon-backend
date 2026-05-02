const express = require("express");
const router = express.Router();
const businessSettingsController = require("../controller/businessSettingsController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/business-day", businessSettingsController.getBusinessDay);
router.post("/business-day", authenticate, businessSettingsController.updateBusinessDay);

module.exports = router;
