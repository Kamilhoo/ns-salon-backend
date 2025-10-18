// Authentication Middleware for Node.js/Express

const jwt = require("jsonwebtoken");
const Employee = require("../models/Employee"); // ✅ SIRF EMPLOYEE MODEL CHAHIYE

// Enhanced authentication middleware that supports both JWT and face auth tokens
const authenticateToken = async (req, res, next) => {
  try {
    console.log("🔑 [Auth Middleware] Starting authentication...");

    const authHeader = req.headers["authorization"];
    const token =
      authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;

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

    // --- JWT TOKEN HANDLING ---
    if (token.startsWith("eyJ")) {
      console.log("🔑 [Auth Middleware] Processing JWT token...");

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("✅ [Auth Middleware] JWT token valid:", decoded);

        // ✅ Look up user in the correct collection based on token payload
        let user = null;
        let roleFromToken = decoded.role;

        if (decoded.employeeId) {
          user = await Employee.findById(decoded.employeeId);
        } else if (decoded.managerId) {
          const Manager = require("../models/Manager");
          user = await Manager.findById(decoded.managerId);
        } else if (decoded.adminId) {
          const Admin = require("../models/Admin");
          user = await Admin.findById(decoded.adminId);
        } else if (decoded.userId) {
          // Fallback to Employee collection for generic userId
          user = await Employee.findById(decoded.userId);
        }

        if (!user) {
          console.log("❌ [Auth Middleware] User not found in database");
          return res.status(401).json({
            message: "Invalid token. User not found.",
          });
        }

        // Determine role: prefer DB value, else token
        const role = user.role || roleFromToken;

        // Check for active status only if the field exists and is explicitly false
        if (Object.prototype.hasOwnProperty.call(user, "isActive") && user.isActive === false) {
          return res.status(401).json({
            message: "Account is deactivated. Please contact administrator.",
          });
        }

        // Standardize the user object
        req.user = {
          _id: user._id,
          role: role,
          name: user.name || user.username,
          email: user.email,
        };

        // Attach based on role
        if (role === "admin") req.admin = user;
        if (role === "manager") req.manager = user;
        if (role === "employee") req.employee = user;

        req.isAuthenticated = true;
        console.log(
          `✅ [Auth Middleware] JWT authentication successful for role: ${req.user.role}`
        );
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

    // --- FACE AUTH TOKEN HANDLING ---
    if (token.startsWith("face_auth_")) {
      console.log("🔑 [Auth Middleware] Processing face auth token...");

      try {
        const parts = token.split("_");
        if (parts.length >= 3) {
          const userId = parts[2];
          console.log("🔑 [Auth Middleware] Extracted user ID:", userId);

          // ✅ SIRF EMPLOYEE COLLECTION MEIN SEARCH KAREIN
          const user = await Employee.findById(userId);

          if (user) {
            // ✅ ROLE USER KE DATABASE FIELD SE LO
            const role = user.role; // "admin", "manager", ya "employee"

            console.log(`✅ [Auth Middleware] Found user with role: ${role}`);

            // Standardize the user object
            req.user = {
              _id: user._id,
              role: role, // ✅ YE ROLE DATABASE SE AAYA
              name: user.name || user.username,
              email: user.email,
            };

            // Attach based on role
            if (role === "admin") req.admin = user;
            if (role === "manager") req.manager = user;
            if (role === "employee") req.employee = user;

            req.isAuthenticated = true;
            console.log(
              `✅ [Auth Middleware] Face Auth successful for role: ${req.user.role}`
            );
            return next();
          }

          console.log("❌ [Auth Middleware] User not found");
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

    // --- UNKNOWN TOKEN FORMAT ---
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
    if (!req.isAuthenticated || !req.user || !req.user.role) {
      return res.status(401).json({
        message: "Authentication required and user role must be defined",
      });
    }

    const userRole = req.user.role;
    console.log("🔐 [Auth] User role:", userRole);
    console.log("🔐 [Auth] Required roles:", roles);

    if (!roles.includes(userRole)) {
      return res.status(403).json({
        message: `Access denied. Required role(s): ${roles.join(", ")}`,
      });
    }

    console.log("✅ [Auth] Role authorization passed");
    next();
  };
};

module.exports = { authenticateToken, authenticate, authorizeRoles };
