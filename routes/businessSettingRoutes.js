const express = require("express");
const router = express.Router();
const businessSettingController = require("../controller/businessSettingController");
const { authenticate } = require("../middleware/authMiddleware");

router.get("/business-day", businessSettingController.getBusinessDay);
router.post("/business-day", authenticate, businessSettingController.updateBusinessDay);

module.exports = router;
