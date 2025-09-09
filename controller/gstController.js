const GSTConfig = require("../models/GSTConfig");
const Admin = require("../models/Admin");

// Get current GST configuration
exports.getGSTConfig = async (req, res) => {
  try {
    let gstConfig = await GSTConfig.findOne();

    // If no GST config exists, create default one
    if (!gstConfig) {
      const admin = await Admin.findOne({ role: "admin" });
      if (!admin) {
        return res.status(404).json({
          success: false,
          message: "No admin found to create default GST configuration",
        });
      }

      gstConfig = new GSTConfig({
        gstPercentage: 7,
        isActive: true,
        appliedTo: "all",
        updatedBy: admin._id,
        updatedByName: admin.name || admin.email,
      });

      await gstConfig.save();
    }

    res.status(200).json({
      success: true,
      message: "GST configuration retrieved successfully",
      gstConfig: {
        _id: gstConfig._id,
        gstPercentage: gstConfig.gstPercentage,
        isActive: gstConfig.isActive,
        appliedTo: gstConfig.appliedTo,
        updatedBy: gstConfig.updatedBy,
        updatedByName: gstConfig.updatedByName,
        createdAt: gstConfig.createdAt,
        updatedAt: gstConfig.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error getting GST config:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving GST configuration",
      error: error.message,
    });
  }
};

// Update GST configuration
exports.updateGSTConfig = async (req, res) => {
  try {
    const { gstPercentage, isActive, appliedTo } = req.body;
    const adminId = req.user.adminId || req.user._id;

    // Validate GST percentage
    if (
      gstPercentage !== undefined &&
      (gstPercentage < 0 || gstPercentage > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "GST percentage must be between 0 and 100",
      });
    }

    // Get admin details
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Find existing GST config or create new one
    let gstConfig = await GSTConfig.findOne();

    if (!gstConfig) {
      gstConfig = new GSTConfig({
        updatedBy: adminId,
        updatedByName: admin.name || admin.email,
      });
    }

    // Update fields
    if (gstPercentage !== undefined) gstConfig.gstPercentage = gstPercentage;
    if (isActive !== undefined) gstConfig.isActive = isActive;
    if (appliedTo !== undefined) gstConfig.appliedTo = appliedTo;

    gstConfig.updatedBy = adminId;
    gstConfig.updatedByName = admin.name || admin.email;

    await gstConfig.save();

    res.status(200).json({
      success: true,
      message: "GST configuration updated successfully",
      gstConfig: {
        _id: gstConfig._id,
        gstPercentage: gstConfig.gstPercentage,
        isActive: gstConfig.isActive,
        appliedTo: gstConfig.appliedTo,
        updatedBy: gstConfig.updatedBy,
        updatedByName: gstConfig.updatedByName,
        createdAt: gstConfig.createdAt,
        updatedAt: gstConfig.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating GST config:", error);
    res.status(500).json({
      success: false,
      message: "Error updating GST configuration",
      error: error.message,
    });
  }
};

// Get GST configuration for billing (used by manager)
exports.getGSTForBilling = async (req, res) => {
  try {
    const gstConfig = await GSTConfig.findOne();

    if (!gstConfig) {
      return res.status(200).json({
        success: true,
        gstPercentage: 0,
        isActive: false,
        message: "No GST configuration found, using 0%",
      });
    }

    res.status(200).json({
      success: true,
      gstPercentage: gstConfig.isActive ? gstConfig.gstPercentage : 0,
      isActive: gstConfig.isActive,
      appliedTo: gstConfig.appliedTo,
    });
  } catch (error) {
    console.error("Error getting GST for billing:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving GST configuration for billing",
      error: error.message,
    });
  }
};

// Calculate GST amount
exports.calculateGST = async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || amount < 0) {
      return res.status(400).json({
        success: false,
        message: "Valid amount is required",
      });
    }

    const gstConfig = await GSTConfig.findOne();

    if (!gstConfig || !gstConfig.isActive) {
      return res.status(200).json({
        success: true,
        amountBeforeGST: amount,
        gstPercentage: 0,
        gstAmount: 0,
        finalAmount: amount,
      });
    }

    const gstAmount = (amount * gstConfig.gstPercentage) / 100;
    const finalAmount = amount + gstAmount;

    res.status(200).json({
      success: true,
      amountBeforeGST: amount,
      gstPercentage: gstConfig.gstPercentage,
      gstAmount: parseFloat(gstAmount.toFixed(2)),
      finalAmount: parseFloat(finalAmount.toFixed(2)),
    });
  } catch (error) {
    console.error("Error calculating GST:", error);
    res.status(500).json({
      success: false,
      message: "Error calculating GST",
      error: error.message,
    });
  }
};
