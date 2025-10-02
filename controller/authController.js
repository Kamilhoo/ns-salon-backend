const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cloudinary = require("../config/cloudinary");
const faceService = require("../services/faceService");
const fs = require("fs");

exports.register = async (req, res) => {
  try {
    const {
      username,
      role,
      employeeId = null,
      phoneNumber = null,
      idCardNumber = null,
      monthlySalary = null,
      createdBy = null,
    } = req.body;

    if (role !== "admin" && !createdBy) {
      return res.status(400).json({
        message: "createdBy is required when role is manager or employee",
      });
    }

    // Check if createdBy user exists and has admin role
    if (role !== "admin" && createdBy) {
      const creatorUser = await User.findById(createdBy);
      if (!creatorUser) {
        // Clean up file before returning error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          message: "Creator user not found",
        });
      }
      if (creatorUser.role !== "admin") {
        // Clean up file before returning error
        if (req.file && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({
          message: "Only admin can add new users",
        });
      }
    }

    // Check if file is uploaded
    if (!req.file) {
      return res.status(400).json({
        message: "Face image is required for face authentication",
      });
    }

    // Validate face image FIRST
    const faceValidation = await faceService.validateFaceImage(req.file.path);
    if (!faceValidation.valid) {
      // Clean up file after validation fails
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        message: faceValidation.message,
      });
    }

    // Check if this face is already registered
    const matchResult = await faceService.findUserByFace(req.file.path);

    if (matchResult.success) {
      // Clean up file after face match check
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({
        // Changed from 401 to 400
        message: "Face already registered",
      });
    }

    // IMPORTANT: Don't delete file yet! We need it for Cloudinary upload
    // Upload to Cloudinary BEFORE deleting the local file
    let cloudinaryResult;
    try {
      cloudinaryResult = await cloudinary.uploader.upload(req.file.path, {
        folder: "user-faces",
        resource_type: "auto",
      });
    } catch (cloudinaryError) {
      console.error("Cloudinary upload error:", cloudinaryError);
      // Clean up file after cloudinary error
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({
        message: "Image upload failed",
        error: cloudinaryError.message,
      });
    }

    // NOW we can safely delete the local file after successful Cloudinary upload
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log("Local file cleaned up after successful upload");
    }

    // Prepare user data
    let userData = {
      username,
      role,
      employeeId,
      phoneNumber,
      idCardNumber,
      monthlySalary,
      createdBy,
      faceImageUrl: cloudinaryResult.secure_url,
      faceRegistered: true,
    };

    // Create and save user
    const user = new User(userData);
    await user.save();

    res.status(201).json({
      message: "User registered successfully",
      user,
    });
  } catch (err) {
    console.log("Registration error:", err);
    // Clean up file on any error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log("File cleaned up due to error");
    }
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Updated Login Function
exports.login = async (req, res) => {
  try {
    let user = null;

    // Face-based login
    if (!req.file) {
      return res.status(400).json({
        message: "Face image is required for face login",
      });
    }

    // Validate face
    const faceValidation = await faceService.validateFaceImage(req.file.path);
    if (!faceValidation.valid) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({
        message: faceValidation.message,
      });
    }

    // Find user by face
    const matchResult = await faceService.findUserByFace(req.file.path);
    fs.unlinkSync(req.file.path);

    if (!matchResult.success) {
      return res.status(401).json({
        message: "Face not recognized",
      });
    }

    user = matchResult.user;

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user,
    });
  } catch (err) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error("Login error:", err);
    res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};

// Face Login for Admin (Generate JWT token after face verification)
exports.adminFaceLogin = async (req, res) => {
  try {
    const { adminId, name, faceVerified } = req.body;

    if (!adminId || !name || !faceVerified) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields for face login",
      });
    }

    // Find admin by ID (check both User and Admin collections)
    let admin = await User.findById(adminId);
    if (!admin) {
      // Try Admin collection
      const Admin = require("../models/Admin");
      admin = await Admin.findById(adminId);
    }

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    // Check if admin is active
    if (admin.isActive === false) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact administrator.",
      });
    }

    // Generate JWT token
    console.log("🔑 [Face Login] Creating JWT token for admin:", {
      adminId: admin._id,
      email: admin.email || admin.username,
      role: admin.role || "admin",
    });

    const token = jwt.sign(
      {
        adminId: admin._id,
        email: admin.email || admin.username,
        role: admin.role || "admin",
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log("✅ [Face Login] JWT token created successfully");

    res.status(200).json({
      success: true,
      message: "Face login successful",
      data: {
        token,
        admin: {
          adminId: admin.adminId || admin._id,
          name: admin.name || admin.username,
          email: admin.email || admin.username,
          role: admin.role || "admin",
          lastLogin: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Admin Face Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get current logged-in user details
exports.getCurrentUser = async (req, res) => {
  try {
    // req.user is set by the authentication middleware
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    // Determine user type and fetch full details if needed
    let userData = null;
    let userType = req.user.role;

    if (req.user.adminId) {
      // Admin
      const Admin = require("../models/Admin");
      userData = await Admin.findById(req.user.adminId).select("-password");
      userType = "admin";
    } else if (req.user.managerId) {
      // Manager
      const Manager = require("../models/Manager");
      userData = await Manager.findById(req.user.managerId).select("-password");
      userType = "manager";
    } else if (req.user.employeeId) {
      // Employee
      const Employee = require("../models/Employee");
      userData = await Employee.findById(req.user.employeeId);
      userType = "employee";
    } else if (req.user.userId) {
      // General User
      const User = require("../models/User");
      userData = await User.findById(req.user.userId).select("-password");
      userType = userData?.role || "user";
    } else if (req.user._id) {
      // Fallback for User model
      const User = require("../models/User");
      userData = await User.findById(req.user._id).select("-password");
      userType = userData?.role || "user";
    }

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Current user details fetched successfully",
      data: userData,
      userType,
    });
  } catch (error) {
    console.error("Error fetching current user details:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching current user details",
      error: error.message,
    });
  }
};
