require("dotenv").config();
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const Expense = require("../models/Expense");

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

const handleFileUpload = (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        message: "File upload error",
        error: err.message,
      });
    }
    next();
  });
};

// Add Expense
exports.addExpense = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }
    const { name, price, description } = req.body;
    if (!name || !price || !description) {
      return res
        .status(400)
        .json({ message: "All fields are required: name, price, description" });
    }
    let imageUrl = null;

    // Handle image upload if file is provided
    if (req.file) {
      // Upload image to Cloudinary
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "expenses",
        resource_type: "auto",
      });
      // Delete local file
      fs.unlinkSync(req.file.path);
      imageUrl = result.secure_url;
    }

    const expense = new Expense({
      name,
      price: parseFloat(price),
      description,
      image: imageUrl || "https://via.placeholder.com/400x300?text=No+Image", // Default placeholder if no image
      userRole: req.body.userRole || "manager", // Default to manager
      status: req.body.userRole === "admin" ? "approved" : "pending", // Admin expenses are auto-approved, manager expenses need approval
    });
    await expense.save();
    res.status(201).json({
      success: true,
      message: "Expense submitted successfully",
      data: {
        id: expense._id,
        name: expense.name,
        price: expense.price,
        description: expense.description,
        image: expense.image,
        status: expense.status,
        userRole: expense.userRole,
      },
    });
  } catch (err) {
    res.status(500).json({
      message: "Error adding expense",
      error: err.message,
    });
  }
};

// Get All Expenses (only approved expenses)
exports.getAllExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find(
      { status: "approved" },
      "name price description image createdAt"
    );
    res.status(200).json({
      success: true,
      data: expenses,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching expenses",
      error: err.message,
    });
  }
};

// Get Pending Expenses (Add this missing function)
exports.getPendingExpenses = async (req, res) => {
  try {
    const pendingExpenses = await Expense.find({ status: "pending" });
    res.status(200).json({
      success: true,
      data: pendingExpenses,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching pending expenses",
      error: err.message,
    });
  }
};

// Get Manager's Own Pending Expenses
exports.getManagerPendingExpenses = async (req, res) => {
  try {
    const managerPendingExpenses = await Expense.find({ 
      status: "pending",
      userRole: "manager"
    });
    res.status(200).json({
      success: true,
      data: managerPendingExpenses,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Error fetching manager pending expenses",
      error: err.message,
    });
  }
};

// Approve/Decline Expense (Add this missing function)
exports.approveDeclineExpense = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const { status, remarks } = req.body; // status should be 'approved' or 'declined'

    if (!["approved", "declined"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either approved or declined",
      });
    }

    const expense = await Expense.findByIdAndUpdate(
      expenseId,
      {
        status,
        remarks: remarks || "",
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    res.status(200).json({
      message: `Expense ${status} successfully`,
      expense,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error updating expense",
      error: err.message,
    });
  }
};

// Get Expense by ID
exports.getExpenseById = async (req, res) => {
  try {
    const { expenseId } = req.params;
    const expense = await Expense.findById(expenseId).select(
      "name price description image status remarks"
    );
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.status(200).json(expense);
  } catch (err) {
    res.status(500).json({
      message: "Error fetching expense",
      error: err.message,
    });
  }
};

// Get Expense Statistics (Add this missing function)
exports.getExpenseStats = async (req, res) => {
  try {
    const totalExpenses = await Expense.countDocuments();
    const pendingExpenses = await Expense.countDocuments({ status: "pending" });
    const approvedExpenses = await Expense.countDocuments({
      status: "approved",
    });
    const declinedExpenses = await Expense.countDocuments({
      status: "declined",
    });

    // Calculate total amount for approved expenses
    const approvedExpenseTotal = await Expense.aggregate([
      { $match: { status: "approved" } },
      { $group: { _id: null, total: { $sum: "$price" } } },
    ]);

    const totalAmount =
      approvedExpenseTotal.length > 0 ? approvedExpenseTotal[0].total : 0;

    res.status(200).json({
      totalExpenses,
      pendingExpenses,
      approvedExpenses,
      declinedExpenses,
      totalApprovedAmount: totalAmount,
    });
  } catch (err) {
    res.status(500).json({
      message: "Error fetching expense statistics",
      error: err.message,
    });
  }
};

exports.handleFileUpload = handleFileUpload;
