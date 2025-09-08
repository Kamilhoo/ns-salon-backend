const jwt = require('jsonwebtoken');
const Manager = require('../models/Manager');

// Middleware to authenticate manager
exports.authenticateManager = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if manager exists and is active
    const manager = await Manager.findById(decoded.managerId);
    if (!manager) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Manager not found.'
      });
    }

    if (!manager.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact administrator.'
      });
    }

    // Add manager info to request
    req.managerId = manager._id;
    req.manager = manager;
    next();

  } catch (error) {
    console.error('Manager Authentication Error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication.',
      error: error.message
    });
  }
};

// Middleware to authorize manager role
exports.authorizeManager = (req, res, next) => {
  if (req.manager && req.manager.role === 'manager') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied. Manager role required.'
    });
  }
};

// Middleware to check if manager is active
exports.checkManagerActive = (req, res, next) => {
  if (req.manager && req.manager.isActive) {
    next();
  } else {
    res.status(401).json({
      success: false,
      message: 'Account is deactivated. Please contact administrator.'
    });
  }
}; 