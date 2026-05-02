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
    console.log("📅 [BusinessSettings] Update request received:", { 
      nextBusinessDay, 
      user: req.user ? { _id: req.user._id, role: req.user.role } : 'No user' 
    });

    if (!nextBusinessDay) {
      console.log("❌ [BusinessSettings] Missing nextBusinessDay in request body");
      return res.status(400).json({ success: false, message: "Next business day is required" });
    }

    let settings = await BusinessSettings.findOne();
    if (!settings) {
      console.log("ℹ️ [BusinessSettings] No settings found, creating new record");
      settings = new BusinessSettings({ currentBusinessDay: nextBusinessDay });
    } else {
      console.log("ℹ️ [BusinessSettings] Updating existing settings record");
      settings.currentBusinessDay = nextBusinessDay;
    }

    if (req.user && req.user._id) {
      settings.lastUpdatedBy = req.user._id;
      settings.updaterModel = req.user.role === 'admin' ? 'Admin' : 'Manager';
      console.log(`ℹ️ [BusinessSettings] Updated by ${settings.updaterModel}: ${settings.lastUpdatedBy}`);
    } else {
      console.log("⚠️ [BusinessSettings] No user info found in request");
    }
    
    await settings.save();
    console.log("✅ [BusinessSettings] Business day updated successfully to:", settings.currentBusinessDay);
    
    res.status(200).json({ 
      success: true, 
      businessDay: settings.currentBusinessDay, 
      message: "Business day updated successfully" 
    });
  } catch (error) {
    console.error("❌ [BusinessSettings] Error updating business day:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
