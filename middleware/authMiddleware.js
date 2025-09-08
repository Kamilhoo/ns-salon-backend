const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const Employee = require("../models/Employee");
const Manager = require("../models/Manager");

// Enhanced authentication middleware that supports both JWT and face auth tokens
const authenticateToken = async (req, res, next) => {
  try {
    console.log("🔑 [Auth Middleware] Starting authentication...");
    console.log("🔑 [Auth Middleware] Headers:", req.headers);

    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    if (!token) {
      console.log("❌ [Auth Middleware] No token provided");
      return res.status(401).json({
        message: "Access token required",
      });
    }

    console.log(
      "🔑 [Auth Middleware] Token received:",
      token.substring(0, 20) + "..."
    );

    // Check if it's a JWT token
    if (token.startsWith("eyJ")) {
      console.log("🔑 [Auth Middleware] Processing JWT token...");

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("✅ [Auth Middleware] JWT token valid:", decoded);

        // Check if it's a manager token
        if (decoded.managerId) {
          console.log("🔑 [Auth Middleware] Manager token detected");
          const manager = await Manager.findById(decoded.managerId);
          if (!manager) {
            return res.status(401).json({
              message: "Invalid token. Manager not found.",
            });
          }

          if (!manager.isActive) {
            return res.status(401).json({
              message: "Account is deactivated. Please contact administrator.",
            });
          }

          req.user = {
            managerId: manager._id,
            name: manager.name,
            role: "manager",
            email: manager.email,
          };
          req.manager = manager;
          req.isAuthenticated = true;
          return next();
        }

        // Check if it's an admin token
        if (decoded.adminId) {
          console.log("🔑 [Auth Middleware] Admin token detected");
          const admin = await Admin.findById(decoded.adminId);
          if (!admin) {
            return res.status(401).json({
              message: "Invalid token. Admin not found.",
            });
          }

          req.user = {
            adminId: admin._id,
            name: admin.name,
            role: "admin",
            email: admin.email,
          };
          req.admin = admin;
          req.isAuthenticated = true;
          return next();
        }

        // Fallback for other JWT tokens
        req.user = decoded;
        req.isAuthenticated = true;
        return next();
      } catch (jwtError) {
        console.log(
          "❌ [Auth Middleware] JWT verification failed:",
          jwtError.message
        );
        return res.status(401).json({
          message: "Invalid or expired token",
        });
      }
    }

    // Check if it's a face auth token
    if (token.startsWith("face_auth_")) {
      console.log("🔑 [Auth Middleware] Processing face auth token...");

      try {
        // Extract admin/manager ID from face auth token
        const parts = token.split("_");
        if (parts.length >= 3) {
          const userId = parts[2];
          console.log("🔑 [Auth Middleware] Extracted user ID:", userId);

          // Try to find manager first
          let user = await Manager.findById(userId);
          if (user) {
            console.log(
              "✅ [Auth Middleware] Found manager in Manager collection"
            );
            req.user = {
              managerId: user._id,
              name: user.name,
              role: "manager",
              email: user.email,
            };
            req.manager = user;
            req.isAuthenticated = true;
            return next();
          }

          // Try to find admin in Employee collection
          user = await Employee.findById(userId);
          if (user && user.role === "admin") {
            console.log(
              "✅ [Auth Middleware] Found admin in Employee collection"
            );
            req.user = {
              adminId: user._id,
              name: user.name,
              role: "admin",
              email: user.email || `${user.name.toLowerCase()}@salon.com`,
            };
            req.isAuthenticated = true;
            return next();
          }

          // Try to find in Admin collection
          user = await Admin.findById(userId);
          if (user) {
            console.log("✅ [Auth Middleware] Found admin in Admin collection");
            req.user = {
              adminId: user._id,
              name: user.name,
              role: "admin",
              email: user.email,
            };
            req.isAuthenticated = true;
            return next();
          }

          // Try to find in User collection (for general users)
          const User = require("../models/User");
          user = await User.findById(userId);
          if (user) {
            console.log("✅ [Auth Middleware] Found user in User collection");
            req.user = {
              userId: user._id,
              name: user.username || user.name,
              role: user.role,
              email: user.email || user.username,
            };
            req.isAuthenticated = true;
            return next();
          }

          console.log(
            "❌ [Auth Middleware] User not found for face auth token. Tried Manager, Employee, Admin, and User collections."
          );
        }

        return res.status(401).json({
          message: "Invalid face authentication token - user not found",
        });
      } catch (faceAuthError) {
        console.log(
          "❌ [Auth Middleware] Face auth processing failed:",
          faceAuthError.message
        );
        return res.status(401).json({
          message: "Invalid face authentication token",
        });
      }
    }

    // Unknown token format
    console.log("❌ [Auth Middleware] Unknown token format");
    return res.status(401).json({
      message: "Invalid token format",
    });
  } catch (error) {
    console.error("❌ [Auth Middleware] Authentication error:", error);
    return res.status(500).json({
      message: "Authentication service error",
    });
  }
};

// Alias for compatibility
const authenticate = authenticateToken;

// Role authorization middleware
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.isAuthenticated) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    const userRole = req.user?.role;
    console.log("🔐 [Auth] User role:", userRole);
    console.log("🔐 [Auth] Required roles:", roles);

    if (!userRole || !roles.includes(userRole)) {
      return res.status(403).json({
        message: `Access denied. Required role(s): ${roles.join(", ")}`,
      });
    }

    console.log("✅ [Auth] Role authorization passed");
    next();
  };
};

module.exports = { authenticateToken, authenticate, authorizeRoles };
