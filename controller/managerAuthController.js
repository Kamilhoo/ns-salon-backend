require("dotenv").config();
const Manager = require("../models/Manager");
const jwt = require("jsonwebtoken");
const cloudinary = require("../config/cloudinary");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage: storage }).any();

const handleFileUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      console.error("Multer Error:", err);
      return res
        .status(400)
        .json({ message: "File upload error", error: err.message });
    }
    next();
  });
};

// Add Manager (Admin function)
exports.addManager = async (req, res) => {
  try {
    const { name, email, phoneNumber, password } = req.body;

    // Check if manager already exists with same email or phone
    const existingManager = await Manager.findOne({
      $or: [{ email: email }, { phoneNumber: phoneNumber }],
    });

    if (existingManager) {
      return res.status(400).json({
        message: "Manager already exists with this email or phone number",
      });
    }

    let livePictureUrl = "";
    if (req.files && req.files.length > 0) {
      const file = req.files.find((f) => f.fieldname === "livePicture");
      if (file) {
        // Validate live picture using AWS face recognition
        const {
          validateImageForFaceRecognition,
          detectFaces,
          cleanupTempImage,
        } = require("../utils/imageUtils");

        console.log(
          "🔍 Validating manager live picture for face recognition..."
        );

        // Validate image quality for face recognition
        const imageValidation = validateImageForFaceRecognition(file.path);
        if (!imageValidation.valid) {
          // Clean up temporary file
          cleanupTempImage(file.path);

          return res.status(400).json({
            message: imageValidation.message,
            error: imageValidation.error,
          });
        }

        // Detect faces in the uploaded image
        const { detectFaces: awsDetectFaces } = require("../config/aws");
        const imageBuffer = require("fs").readFileSync(file.path);
        const faceDetection = await awsDetectFaces(imageBuffer);

        if (!faceDetection.success) {
          console.log("❌ No faces detected in manager image");
          cleanupTempImage(file.path);

          return res.status(400).json({
            message:
              "No faces detected in the uploaded image. Please ensure a clear face image is provided.",
            error: "NO_FACE_DETECTED",
          });
        }

        if (faceDetection.faceCount > 1) {
          console.log("❌ Multiple faces detected in manager image");
          cleanupTempImage(file.path);

          return res.status(400).json({
            message:
              "Multiple faces detected in the image. Please use an image with only one face.",
            error: "MULTIPLE_FACES",
          });
        }

        console.log("✅ Manager live picture validation successful!");

        const result = await cloudinary.uploader.upload(file.path, {
          folder: "salon-managers",
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
        });
        livePictureUrl = result.secure_url;

        // Clean up temporary file after successful upload
        cleanupTempImage(file.path);
      }
    }

    if (!livePictureUrl) {
      return res.status(400).json({
        message: "Live picture is required for manager authentication",
      });
    }

    // Generate sequential manager ID
    const lastManager = await Manager.findOne().sort({ managerId: -1 });
    const mgrNumber = lastManager
      ? parseInt(lastManager.managerId.replace("MGR", "")) + 1
      : 1;
    const managerId = `MGR${mgrNumber.toString().padStart(3, "0")}`;

    const manager = new Manager({
      managerId,
      name,
      email,
      phoneNumber,
      password,
      livePicture: livePictureUrl,
    });

    await manager.save();
    res.status(201).json({
      message: "Manager added successfully",
      manager: {
        managerId: manager.managerId,
        name: manager.name,
        email: manager.email,
        phoneNumber: manager.phoneNumber,
        role: manager.role,
        isActive: manager.isActive,
        createdAt: manager.createdAt,
      },
    });
  } catch (err) {
    console.error("Add Manager Error:", err);
    res.status(400).json({
      message: "Add manager error",
      error: err.message,
    });
  }
};

// Manager Login with Live Picture Verification
exports.managerLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find manager by email
    const manager = await Manager.findOne({ email });
    if (!manager) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if account is locked
    if (manager.isLocked()) {
      return res.status(423).json({
        success: false,
        message:
          "Account is temporarily locked due to multiple failed login attempts. Please try again later.",
      });
    }

    // Check if manager is active
    if (!manager.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact administrator.",
      });
    }

    // Verify password
    const isPasswordValid = await manager.comparePassword(password);
    if (!isPasswordValid) {
      await manager.incLoginAttempts();
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Check if live picture is provided
    if (!req.files || !req.files.livePicture) {
      return res.status(400).json({
        success: false,
        message: "Live picture is required for authentication",
      });
    }

    // Upload and verify live picture
    const loginPicture = req.files.find((f) => f.fieldname === "livePicture");
    if (!loginPicture) {
      return res.status(400).json({
        success: false,
        message: "Live picture is required for authentication",
      });
    }

    // Upload login picture to Cloudinary
    const loginPictureResult = await cloudinary.uploader.upload(
      loginPicture.path,
      {
        folder: "salon-managers-login",
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
      }
    );

    // Enhanced AWS Face Recognition Integration
    const {
      enhancedFaceComparison,
      validateImageForFaceRecognition,
      cleanupTempImage,
    } = require("../utils/imageUtils");

    // Validate login image quality
    const imageValidation = validateImageForFaceRecognition(loginPicture.path);
    if (!imageValidation.valid) {
      return res.status(400).json({
        success: false,
        message: imageValidation.message,
        error: imageValidation.error,
      });
    }

    // Get stored image path from Cloudinary URL
    // For now, we'll use the stored image URL directly
    // In production, you might want to download the image first

    // Perform enhanced face comparison
    const faceComparison = await enhancedFaceComparison(
      manager.livePicture, // This should be the stored image path
      loginPicture.path
    );

    if (!faceComparison.success || !faceComparison.isMatch) {
      // Clean up temporary image
      cleanupTempImage(loginPicture.path);

      return res.status(401).json({
        success: false,
        message: faceComparison.message,
        similarity: faceComparison.similarity,
        error: faceComparison.error,
      });
    }

    console.log(
      `Face verification successful! Similarity: ${faceComparison.similarity}%, Confidence: ${faceComparison.confidence}`
    );

    // Clean up temporary image after successful verification
    cleanupTempImage(loginPicture.path);

    // Reset login attempts on successful login
    await manager.resetLoginAttempts();

    // Generate JWT token
    const token = jwt.sign(
      {
        managerId: manager._id,
        email: manager.email,
        role: manager.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        token,
        manager: {
          managerId: manager.managerId,
          name: manager.name,
          email: manager.email,
          phoneNumber: manager.phoneNumber,
          role: manager.role,
          lastLogin: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Manager Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Face Login for Manager (Generate JWT token after face verification)
exports.managerFaceLogin = async (req, res) => {
  try {
    console.log("🔑 [Manager Face Login] Request received:", req.body);
    const { managerId, name, faceVerified } = req.body;

    if (!managerId || !name || !faceVerified) {
      console.log("❌ [Manager Face Login] Missing required fields:", {
        managerId,
        name,
        faceVerified,
      });
      return res.status(400).json({
        success: false,
        message: "Missing required fields for face login",
      });
    }

    // Find manager by ID
    console.log(
      "🔍 [Manager Face Login] Searching for manager with ID:",
      managerId
    );
    console.log("🔍 [Manager Face Login] ID type:", typeof managerId);

    // Try to find manager by _id first
    let manager = await Manager.findById(managerId);

    // If not found, try to find by managerId field
    if (!manager) {
      console.log(
        "🔍 [Manager Face Login] Not found by _id, trying managerId field..."
      );
      manager = await Manager.findOne({ managerId: managerId });
    }

    // If still not found, try Admin collection
    if (!manager) {
      try {
        const Admin = require("../models/Admin");
        manager = await Admin.findById(managerId);
      } catch (e) {
        console.log("Admin model not found or error loading Admin model", e);
      }
    }

    // If still not found, try User collection for admin role
    if (!manager) {
      try {
        const User = require("../models/User");
        manager = await User.findOne({ _id: managerId, role: "admin" });
      } catch (e) {
        console.log("User model not found or error loading User model", e);
      }
    }

    // If still not found, try Employee collection for admin role
    if (!manager) {
      try {
        const Employee = require("../models/Employee");
        manager = await Employee.findOne({ _id: managerId, role: "admin" });
        if (manager) {
          // For Employee-admin, adapt the response fields
          // Generate JWT token
          const token = jwt.sign(
            {
              managerId: manager._id,
              email: manager.email || null,
              role: manager.role,
            },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
          );
          return res.status(200).json({
            success: true,
            message: "Face login successful (Employee-admin)",
            data: {
              token,
              manager: {
                managerId: manager.employeeId || manager._id,
                name: manager.name,
                email: manager.email || null,
                phoneNumber: manager.phoneNumber || null,
                role: manager.role,
                lastLogin: new Date(),
              },
            },
          });
        }
      } catch (e) {
        console.log(
          "Employee model not found or error loading Employee model",
          e
        );
      }
    }

    if (!manager) {
      console.log(
        "❌ [Manager Face Login] Manager not found with ID:",
        managerId
      );
      return res.status(404).json({
        success: false,
        message: "Manager not found",
      });
    }
    console.log("✅ [Manager Face Login] Manager found:", manager.name);

    // Check if manager is active (skip for Admin/User/Employee-admin if not present)
    if (typeof manager.isActive !== "undefined" && !manager.isActive) {
      return res.status(401).json({
        success: false,
        message: "Account is deactivated. Please contact administrator.",
      });
    }

    // Generate JWT token
    console.log(
      "🔑 [Manager Face Login] Generating JWT token for manager:",
      manager.name
    );
    const token = jwt.sign(
      {
        managerId: manager._id,
        email: manager.email,
        role: manager.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log("✅ [Manager Face Login] JWT token generated successfully");
    res.status(200).json({
      success: true,
      message: "Face login successful",
      data: {
        token,
        manager: {
          managerId:
            manager.managerId ||
            manager.adminId ||
            manager.employeeId ||
            manager._id,
          name: manager.name,
          email: manager.email || null,
          phoneNumber: manager.phoneNumber || null,
          role: manager.role,
          lastLogin: new Date(),
        },
      },
    });
  } catch (error) {
    console.error("Manager Login Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get Manager Profile
exports.getManagerProfile = async (req, res) => {
  try {
    const managerId = req.managerId; // From JWT token

    const manager = await Manager.findById(managerId).select("-password");
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Manager not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Manager profile retrieved successfully",
      data: manager,
    });
  } catch (error) {
    console.error("Get Manager Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update Manager Profile
exports.updateManagerProfile = async (req, res) => {
  try {
    const managerId = req.managerId;
    const { name, phoneNumber } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    updateData.updatedAt = new Date();

    // Handle live picture update
    if (req.files && req.files.length > 0) {
      const file = req.files.find((f) => f.fieldname === "livePicture");
      if (file) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "salon-managers",
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
        });
        updateData.livePicture = result.secure_url;
      }
    }

    const manager = await Manager.findByIdAndUpdate(managerId, updateData, {
      new: true,
    }).select("-password");

    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Manager not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: manager,
    });
  } catch (error) {
    console.error("Update Manager Profile Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Change Manager Password
exports.changeManagerPassword = async (req, res) => {
  try {
    const managerId = req.managerId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    const manager = await Manager.findById(managerId);
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Manager not found",
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await manager.comparePassword(
      currentPassword
    );
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Update password
    manager.password = newPassword;
    manager.updatedAt = new Date();
    await manager.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change Manager Password Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get All Managers (Admin function)
exports.getAllManagers = async (req, res) => {
  try {
    const managers = await Manager.find()
      .select("-password")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Managers retrieved successfully",
      data: managers,
      total: managers.length,
    });
  } catch (error) {
    console.error("Get All Managers Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get Manager by ID (Admin function)
exports.getManagerById = async (req, res) => {
  try {
    const { id } = req.params;

    const manager = await Manager.findById(id).select("-password");
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Manager not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Manager retrieved successfully",
      data: manager,
    });
  } catch (error) {
    console.error("Get Manager by ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update Manager (Admin function)
exports.updateManager = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phoneNumber, isActive } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;
    if (typeof isActive === "boolean") updateData.isActive = isActive;
    updateData.updatedAt = new Date();

    // Handle live picture update
    if (req.files && req.files.length > 0) {
      const file = req.files.find((f) => f.fieldname === "livePicture");
      if (file) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: "salon-managers",
          resource_type: "auto",
          use_filename: true,
          unique_filename: true,
        });
        updateData.livePicture = result.secure_url;
      }
    }

    const manager = await Manager.findByIdAndUpdate(id, updateData, {
      new: true,
    }).select("-password");

    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Manager not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Manager updated successfully",
      data: manager,
    });
  } catch (error) {
    console.error("Update Manager Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete Manager (Admin function)
exports.deleteManager = async (req, res) => {
  try {
    const { id } = req.params;

    const manager = await Manager.findByIdAndDelete(id);
    if (!manager) {
      return res.status(404).json({
        success: false,
        message: "Manager not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Manager deleted successfully",
      data: { deletedManager: manager },
    });
  } catch (error) {
    console.error("Delete Manager Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Manager Logout
exports.managerLogout = async (req, res) => {
  try {
    // In a real implementation, you might want to blacklist the token
    // For now, we'll just return a success message
    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    console.error("Manager Logout Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Manager Face Recognition Login
exports.login = async (req, res) => {
  try {
    // Face Recognition Login for Manager
    if (!req.file) {
      return res.status(400).json({
        message: "Face image is required for manager login",
      });
    }

    // Import face recognition utilities
    const {
      enhancedFaceComparison,
      validateImageForFaceRecognition,
      cleanupTempImage,
    } = require("../utils/imageUtils");

    // Validate image quality
    const imageValidation = validateImageForFaceRecognition(req.file.path);
    if (!imageValidation.valid) {
      cleanupTempImage(req.file.path);
      return res.status(400).json({
        message: imageValidation.message,
        error: imageValidation.error,
      });
    }

    // Get all managers to compare faces (limit to active managers only)
    const managers = await Manager.find({
      livePicture: { $exists: true, $ne: "" },
      isActive: true, // Only check active managers
    }).limit(10); // Limit to 10 managers for faster processing

    if (managers.length === 0) {
      cleanupTempImage(req.file.path);
      return res.status(404).json({
        message: "No active managers found with registered faces",
      });
    }

    let matchedManager = null;
    let highestSimilarity = 0;

    // Compare with each manager's face (with early exit on high match)
    for (const manager of managers) {
      try {
        const faceComparison = await enhancedFaceComparison(
          manager.livePicture, // Stored manager image URL
          req.file.path // Current login image
        );

        if (
          faceComparison.success &&
          faceComparison.isMatch &&
          faceComparison.similarity > highestSimilarity
        ) {
          matchedManager = manager;
          highestSimilarity = faceComparison.similarity;
          
          // Early exit if we get a very high match (95%+)
          if (faceComparison.similarity >= 95) {
            console.log(
              `High confidence match found: ${faceComparison.similarity}%`
            );
            break;
          }
        }
      } catch (comparisonError) {
        console.error(
          `Face comparison error for manager ${manager.managerId}:`,
          comparisonError
        );
        continue;
      }
    }

    // Clean up temporary file
    cleanupTempImage(req.file.path);

    if (!matchedManager) {
      return res.status(401).json({
        message:
          "Face not recognized. Please ensure you are a registered manager.",
        error: "FACE_NOT_RECOGNIZED",
      });
    }

    // Generate JWT token for manager
    const token = jwt.sign(
      {
        managerId: matchedManager._id,
        managerDbId: matchedManager.managerId,
        email: matchedManager.email,
        role: "manager",
        name: matchedManager.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      message: "Manager face recognition login successful",
      token,
      manager: {
        id: matchedManager._id,
        managerId: matchedManager.managerId,
        name: matchedManager.name,
        email: matchedManager.email,
        role: "manager",
      },
      faceMatch: {
        similarity: highestSimilarity,
        confidence: "high",
      },
      redirectTo: "/manager-panel",
    });
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      cleanupTempImage(req.file.path);
    }

    console.error("Manager Face Login Error:", error);
    res.status(500).json({
      message: "Face recognition login failed",
      error: error.message,
    });
  }
};

// Get all users for face recognition (managers and admins)
exports.getFaceRecognitionUsers = async (req, res) => {
  try {
    console.log("🔍 Getting users for face recognition...");

    // First, let's check all managers regardless of livePicture
    const allManagers = await Manager.find({}).select(
      "_id name email role livePicture managerId isActive idCardNumber monthlySalary"
    );
    console.log(`📊 Total managers in database: ${allManagers.length}`);

    allManagers.forEach((manager, index) => {
      console.log(`👤 Manager ${index + 1}:`, {
        id: manager._id,
        name: manager.name,
        hasLivePicture: !!manager.livePicture,
        livePictureLength: manager.livePicture?.length || 0,
        isActive: manager.isActive,
      });
    });

    // Get all managers with live pictures (check both Manager and Employee collections)
    const managers = await Manager.find({
      livePicture: { $exists: true, $ne: null, $ne: "" },
      // Remove isActive check as it might not exist or be false
    }).select(
      "_id name email role livePicture managerId idCardNumber monthlySalary"
    );

    // Also get managers from Employee collection
    const Employee = require("../models/Employee");
    const employeeManagers = await Employee.find({
      role: "manager",
      livePicture: { $exists: true, $ne: null, $ne: "" },
    }).select(
      "_id name email role livePicture employeeId idCardNumber monthlySalary"
    );

    // Combine both manager sources
    const allManagersWithFaces = [
      ...managers.map((manager) => ({
        ...manager.toObject(),
        name: manager.name,
        livePicture: manager.livePicture,
        managerId: manager.managerId || manager._id,
      })),
      ...employeeManagers.map((emp) => ({
        ...emp.toObject(),
        name: emp.name,
        livePicture: emp.livePicture,
        managerId: emp.employeeId || emp._id,
        role: "manager",
      })),
    ];

    // Get all admins with live pictures (check both Admin and User collections)
    const Admin = require("../models/Admin");
    const User = require("../models/User");

    const allAdmins = await Admin.find({}).select(
      "_id name email role livePicture adminId idCardNumber monthlySalary"
    );
    const allUsers = await User.find({ role: "admin" }).select(
      "_id username email role faceImageUrl"
    );

    console.log(`📊 Total admins in Admin collection: ${allAdmins.length}`);
    console.log(`📊 Total users with admin role: ${allUsers.length}`);

    allAdmins.forEach((admin, index) => {
      console.log(`👤 Admin ${index + 1}:`, {
        id: admin._id,
        name: admin.name,
        hasLivePicture: !!admin.livePicture,
        livePictureLength: admin.livePicture?.length || 0,
      });
    });

    allUsers.forEach((user, index) => {
      console.log(`👤 User Admin ${index + 1}:`, {
        id: user._id,
        name: user.username,
        hasFaceImageUrl: !!user.faceImageUrl,
        faceImageUrlLength: user.faceImageUrl?.length || 0,
      });
    });

    const admins = await Admin.find({
      livePicture: { $exists: true, $ne: null, $ne: "" },
      // Admin model doesn't have isActive field
    }).select(
      "_id name email role livePicture adminId idCardNumber monthlySalary"
    );

    // Also get admins from User collection with faceImageUrl
    const userAdmins = await User.find({
      role: "admin",
      faceImageUrl: { $exists: true, $ne: null, $ne: "" },
    }).select("_id username email role faceImageUrl");

    // Also get admins from Employee collection
    const employeeAdmins = await Employee.find({
      role: "admin",
      livePicture: { $exists: true, $ne: null, $ne: "" },
    }).select(
      "_id name email role livePicture employeeId idCardNumber monthlySalary"
    );

    // Combine all admin sources
    const allAdminsWithFaces = [
      ...admins.map((admin) => ({
        ...admin.toObject(),
        name: admin.name, // Admin collection uses 'name'
        livePicture: admin.livePicture, // Keep original field name
        adminId: admin.adminId || admin._id,
      })),
      ...userAdmins.map((user) => ({
        ...user.toObject(),
        name: user.username, // User collection uses 'username'
        livePicture: user.faceImageUrl, // Map faceImageUrl to livePicture for consistency
        adminId: user._id, // Use _id as adminId for User collection
        role: "admin",
      })),
      ...employeeAdmins.map((emp) => ({
        ...emp.toObject(),
        name: emp.name,
        livePicture: emp.livePicture,
        adminId: emp.employeeId || emp._id,
        role: "admin",
      })),
    ];

    console.log(
      `✅ Found ${allManagersWithFaces.length} managers and ${allAdminsWithFaces.length} admins with face data`
    );

    // Log the actual data for debugging
    if (allManagersWithFaces.length > 0) {
      console.log("👤 Sample manager data:", {
        id: allManagersWithFaces[0]._id,
        name: allManagersWithFaces[0].name,
        hasLivePicture: !!allManagersWithFaces[0].livePicture,
        livePictureLength: allManagersWithFaces[0].livePicture?.length || 0,
      });
    }

    if (allAdminsWithFaces.length > 0) {
      console.log("👤 Sample admin data:", {
        id: allAdminsWithFaces[0]._id,
        name: allAdminsWithFaces[0].name,
        hasLivePicture: !!allAdminsWithFaces[0].livePicture,
        livePictureLength: allAdminsWithFaces[0].livePicture?.length || 0,
      });
    }

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully for face recognition",
      data: [...allManagersWithFaces, ...allAdminsWithFaces],
    });
  } catch (error) {
    console.error("❌ Error getting face recognition users:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get users for face recognition",
      error: error.message,
    });
  }
};

// Compare faces for login
exports.compareFacesForLogin = async (req, res) => {
  try {
    console.log("🔍 Starting face comparison for login...");
    console.log("🔍 Request files:", req.files);
    console.log("🔍 Request file:", req.file);
    console.log("🔍 Request body:", req.body);

    // Check for file in both req.file and req.files
    const sourceImageFile =
      req.file ||
      (req.files && req.files.find((f) => f.fieldname === "sourceImage"));

    if (!sourceImageFile || !req.body.targetImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: sourceImage and targetImageUrl",
        debug: {
          hasFile: !!sourceImageFile,
          hasTargetUrl: !!req.body.targetImageUrl,
          files: req.files,
          file: req.file,
          body: req.body,
        },
      });
    }

    // Use the existing face comparison utility
    const { enhancedFaceComparison } = require("../utils/imageUtils");

    // Compare faces
    const comparisonResult = await enhancedFaceComparison(
      req.body.targetImageUrl, // stored image URL
      sourceImageFile.path // uploaded image path
    );

    console.log("✅ Face comparison completed:", comparisonResult);

    if (comparisonResult.success && comparisonResult.isMatch) {
      res.status(200).json({
        success: true,
        match: true,
        confidence: comparisonResult.similarity,
        message: comparisonResult.message,
      });
    } else {
      res.status(200).json({
        success: true,
        match: false,
        confidence: comparisonResult.similarity || 0,
        message: comparisonResult.message,
      });
    }
  } catch (error) {
    console.error("❌ Face comparison error:", error);
    res.status(500).json({
      success: false,
      message: "Face comparison failed",
      error: error.message,
    });
  }
};

// Test endpoint to check database contents
exports.testFaceRecognitionData = async (req, res) => {
  try {
    console.log("🧪 Testing face recognition data...");

    // Check all managers
    const allManagers = await Manager.find({}).select(
      "_id name email role livePicture managerId isActive idCardNumber monthlySalary"
    );
    console.log(`📊 Total managers: ${allManagers.length}`);

    // Check all admins
    const Admin = require("../models/Admin");
    const allAdmins = await Admin.find({}).select(
      "_id name email role livePicture adminId idCardNumber monthlySalary"
    );
    console.log(`📊 Total admins: ${allAdmins.length}`);

    // Check User collection as well (in case admins are stored there)
    const User = require("../models/User");
    const allUsers = await User.find({ role: "admin" }).select(
      "_id username email role faceImageUrl"
    );
    console.log(`📊 Total users with admin role: ${allUsers.length}`);

    // Check Employee collection for managers and admins
    const Employee = require("../models/Employee");
    const allEmployees = await Employee.find({}).select(
      "_id name email role livePicture employeeId idCardNumber monthlySalary"
    );
    console.log(`📊 Total employees: ${allEmployees.length}`);

    const employeeManagers = allEmployees.filter(
      (emp) => emp.role === "manager"
    );
    const employeeAdmins = allEmployees.filter((emp) => emp.role === "admin");
    console.log(
      `📊 Employee collection - Managers: ${employeeManagers.length}, Admins: ${employeeAdmins.length}`
    );

    res.status(200).json({
      success: true,
      message: "Database contents checked",
      data: {
        managers: allManagers.map((m) => ({
          id: m._id,
          name: m.name,
          hasLivePicture: !!m.livePicture,
          livePictureLength: m.livePicture?.length || 0,
          isActive: m.isActive,
        })),
        admins: allAdmins.map((a) => ({
          id: a._id,
          name: a.name,
          hasLivePicture: !!a.livePicture,
          livePictureLength: a.livePicture?.length || 0,
        })),
        users: allUsers.map((u) => ({
          id: u._id,
          name: u.username,
          hasFaceImageUrl: !!u.faceImageUrl,
          faceImageUrlLength: u.faceImageUrl?.length || 0,
        })),
        employees: allEmployees.map((e) => ({
          id: e._id,
          name: e.name,
          role: e.role,
          hasLivePicture: !!e.livePicture,
          livePictureLength: e.livePicture?.length || 0,
        })),
      },
    });
  } catch (error) {
    console.error("❌ Test endpoint error:", error);
    res.status(500).json({
      success: false,
      message: "Test failed",
      error: error.message,
    });
  }
};

// Manager Attendance Check-In/Check-Out with Face Recognition
exports.managerAttendance = async (req, res) => {
  try {
    const { managerId, attendanceType } = req.body;

    console.log("🚀 [Manager Attendance] Starting attendance process...");
    console.log("📋 [Manager Attendance] Request body:", req.body);
    console.log("📁 [Manager Attendance] File present:", !!req.file);

    if (!managerId || !attendanceType) {
      return res.status(400).json({
        message: "Manager ID and attendance type are required",
      });
    }

    if (!["checkin", "checkout"].includes(attendanceType)) {
      return res.status(400).json({
        message: "Attendance type must be either checkin or checkout",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        message: "Live picture is required for attendance",
      });
    }

    // Find manager by managerId (string field)
    console.log(
      "🔍 [Manager Attendance] Looking for manager with ID:",
      managerId
    );
    const manager = await Manager.findOne({ managerId: managerId });

    if (!manager) {
      // Debug: List all managers in database
      const allManagers = await Manager.find({}).select("managerId name email");
      console.log(
        "📋 [Manager Attendance] All managers in database:",
        allManagers
      );

      return res.status(404).json({
        message: "Manager not found",
        debug: {
          searchedId: managerId,
          availableManagers: allManagers.map((mgr) => mgr.managerId),
        },
      });
    }

    console.log("✅ [Manager Attendance] Manager found:", manager.name);

    // Verify face using AWS Rekognition
    console.log("🔍 Starting manager face verification...");
    const {
      enhancedFaceComparison,
      validateImageForFaceRecognition,
      cleanupTempImage,
    } = require("../utils/imageUtils");

    // Validate attendance image quality
    const imageValidation = validateImageForFaceRecognition(req.file.path);
    if (!imageValidation.valid) {
      cleanupTempImage(req.file.path);
      return res.status(400).json({
        message: imageValidation.message,
        error: imageValidation.error,
      });
    }

    // Perform enhanced face comparison
    const faceComparison = await enhancedFaceComparison(
      manager.livePicture, // Stored manager image
      req.file.path // Current attendance image
    );

    if (!faceComparison.success || !faceComparison.isMatch) {
      // Clean up temporary image
      cleanupTempImage(req.file.path);

      return res.status(400).json({
        message: faceComparison.message,
        similarity: faceComparison.similarity,
        error: faceComparison.error,
      });
    }

    console.log(
      `✅ Manager face verification successful! Similarity: ${faceComparison.similarity}%`
    );

    // Upload attendance image to Cloudinary
    console.log("☁️ Uploading to Cloudinary:", req.file.path);
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "manager-attendance",
      resource_type: "auto",
    });

    console.log("✅ Cloudinary upload successful:", result.secure_url);

    // Clean up temporary file after successful upload
    cleanupTempImage(req.file.path);

    // Check if attendance already exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // For now, we'll use the Employee model to store manager attendance
    // since the Attendance model references Employee
    const Employee = require("../models/Employee");
    const Attendance = require("../models/Attendance");

    // Find or create employee record for this manager
    let employeeRecord = await Employee.findOne({
      $or: [
        { employeeId: managerId },
        { name: manager.name, phoneNumber: manager.phoneNumber },
      ],
    });

    if (!employeeRecord) {
      // Create employee record for manager if it doesn't exist
      employeeRecord = new Employee({
        employeeId: managerId,
        name: manager.name,
        phoneNumber: manager.phoneNumber,
        idCardNumber: manager.idCardNumber,
        monthlySalary: manager.monthlySalary,
        role: "manager",
        livePicture: manager.livePicture,
      });
      await employeeRecord.save();
      console.log("✅ Created employee record for manager:", manager.name);
    }

    let attendance = await Attendance.findOne({
      employeeId: employeeRecord._id,
      date: {
        $gte: today,
        $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
      },
    });

    // Validate attendance logic
    if (attendanceType === "checkin") {
      if (attendance && attendance.checkInTime) {
        return res.status(400).json({
          message: "Check-in already recorded for today",
        });
      }
    } else if (attendanceType === "checkout") {
      if (!attendance || !attendance.checkInTime) {
        return res.status(400).json({
          message: "No check-in record found for today",
        });
      }
      if (attendance.checkOutTime) {
        return res.status(400).json({
          message: "Check-out already recorded for today",
        });
      }
    }

    // Create or update attendance
    if (!attendance) {
      attendance = new Attendance({
        employeeId: employeeRecord._id,
        employeeName: manager.name,
        date: today,
        status: "present",
      });
    }

    // Update based on attendance type
    if (attendanceType === "checkin") {
      attendance.checkInTime = new Date();
      attendance.checkInImage = result.secure_url;
      attendance.status = "present";
    } else if (attendanceType === "checkout") {
      attendance.checkOutTime = new Date();
      attendance.checkOutImage = result.secure_url;
    }

    attendance.updatedAt = new Date();
    await attendance.save();

    res.status(200).json({
      message: `${
        attendanceType === "checkin" ? "Check-in" : "Check-out"
      } successful`,
      attendance: {
        id: attendance._id,
        managerName: attendance.employeeName,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        status: attendance.status,
        attendanceType: attendanceType,
      },
    });
  } catch (err) {
    console.error("Manager Attendance Error:", err);

    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log("🗑️ Cleaned up temp file after error");
      } catch (cleanupError) {
        console.log("⚠️ Could not cleanup temp file:", cleanupError.message);
      }
    }

    res.status(500).json({
      message: "Error during manager attendance",
      error: err.message,
    });
  }
};

exports.handleFileUpload = handleFileUpload;
