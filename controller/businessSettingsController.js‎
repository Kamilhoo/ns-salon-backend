const BusinessSettings = require("../models/BusinessSettings");

exports.getBusinessDay = async (req, res) => {
  try {
    let settings = await BusinessSettings.findOne();
    if (!settings) {
      settings = new BusinessSettings({ currentBusinessDay: new Date() });
      await settings.save();
    }
    res.status(200).json({ success: true, businessDay: settings.currentBusinessDay });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateBusinessDay = async (req, res) => {
  try {
    const { nextBusinessDay } = req.body;
    if (!nextBusinessDay) {
      return res.status(400).json({ success: false, message: "Next business day is required" });
    }

    let settings = await BusinessSettings.findOne();
    if (!settings) {
      settings = new BusinessSettings({ currentBusinessDay: nextBusinessDay });
    } else {
      settings.currentBusinessDay = nextBusinessDay;
    }

    if (req.user && req.user._id) {
      settings.lastUpdatedBy = req.user._id;
      settings.updaterModel = req.user.role === 'admin' ? 'Admin' : 'Manager';
    }
    
    await settings.save();
    res.status(200).json({ 
      success: true, 
      businessDay: settings.currentBusinessDay, 
      message: "Business day updated successfully" 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
