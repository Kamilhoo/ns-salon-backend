const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// Note: Vercel automatically provides environment variables
// No need for dotenv.config() in serverless environment

// Create express app
const app = express();

// Trust proxy for rate limiting (fixes X-Forwarded-For header issue)
app.set("trust proxy", 1);

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === "production" ? 100 : 1000, // limit each IP to 100 requests per windowMs in production
  message: {
    error: "Too many requests from this IP, please try again after 15 minutes.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS Configuration
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL || true // Allow all origins if FRONTEND_URL not set
        : true, // Allow all origins in development
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware to parse JSON
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Import Routes
const serviceRoutes = require("./routes/serviceRoutes");
const authRoutes = require("./routes/authRoute");
const productRoutes = require("./routes/productRoutes");
const employeeRoutes = require("./routes/employeeRoutes");
const dealRoutes = require("./routes/dealRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const advanceSalaryRoutes = require("./routes/advanceSalaryRoutes");
const expenseRoutes = require("./routes/expenseRoutes");
const adminRoutes = require("./routes/adminRoutes");
const adminAdvanceSalaryRoutes = require("./routes/adminAdvanceSalaryRoutes");
const unifiedApprovalRoutes = require("./routes/unifiedApprovalRoutes");
const advanceBookingRoutes = require("./routes/advanceBookingRoutes");
const managerAuthRoutes = require("./routes/managerAuthRoutes");
const clientRoutes = require("./routes/clientRoutes");
const adminClientRoutes = require("./routes/adminClientRoutes");
const billRoutes = require("./routes/billRoutes");

// Use Routes
app.use("/api/services", serviceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/deals", dealRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/advance-salary", advanceSalaryRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin-advance-salary", adminAdvanceSalaryRoutes);
app.use("/api/admin-approvals", unifiedApprovalRoutes);
app.use("/api/advance-bookings", advanceBookingRoutes);
app.use("/api/manager", managerAuthRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/admin-clients", adminClientRoutes);
app.use("/api/bills", billRoutes);

// Favicon handler (to prevent 404s)
app.get("/favicon.ico", (req, res) => {
  res.status(204).end();
});

app.get("/favicon.png", (req, res) => {
  res.status(204).end();
});

// Health check endpoint
app.get("/", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Salon Backend API is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    env_status: {
      MONGO_URI: process.env.MONGO_URI ? "✅ SET" : "❌ NOT SET",
      JWT_SECRET: process.env.JWT_SECRET ? "✅ SET" : "❌ NOT SET",
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME
        ? "✅ SET"
        : "❌ NOT SET",
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID
        ? "✅ SET"
        : "❌ NOT SET",
      AWS_REGION: process.env.AWS_REGION ? "✅ SET" : "❌ NOT SET",
    },
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Salon Backend API is healthy",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Debug endpoint to check users (remove in production)
app.get("/debug/users", async (req, res) => {
  try {
    const Manager = require("./models/Manager");
    const Admin = require("./models/Admin");
    const Employee = require("./models/Employee");
    const User = require("./models/User");

    const managers = await Manager.find({}, "_id name email");
    const admins = await Admin.find({}, "_id name email");
    const employees = await Employee.find({}, "_id name email role");
    const users = await User.find({}, "_id username email role");

    res.json({
      managers: managers,
      admins: admins,
      employees: employees,
      users: users,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.originalUrl} not found`,
    availableEndpoints: [
      "/api/auth/*",
      "/api/employees/*",
      "/api/attendance/*",
      "/api/services/*",
      "/api/products/*",
      "/api/clients/*",
      "/api/bills/*",
      "/health",
    ],
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const errors = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: errors,
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      message: `${field} already exists`,
      field: field,
    });
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  if (err.name === "TokenExpiredError") {
    return res.status(401).json({
      success: false,
      message: "Token expired",
    });
  }

  // Default server error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// MongoDB Connection (for serverless, reuse connections)
let isConnected = false;

const connectToMongoDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  try {
    if (process.env.MONGO_URI) {
      await mongoose.connect(process.env.MONGO_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      isConnected = true;
      console.log("✅ MongoDB connected successfully");
    } else {
      console.error("❌ MONGO_URI environment variable not set");
    }
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    isConnected = false;
  }
};

// Connect on startup
connectToMongoDB();

// Handle MongoDB connection events
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});

module.exports = app;
