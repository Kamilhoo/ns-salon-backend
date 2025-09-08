require("dotenv").config();
const AdvanceBooking = require("../models/AdvanceBooking");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Handle file upload middleware
const handleFileUpload = (req, res, next) => {
  console.log("🔍 File upload middleware called");
  console.log("🔍 Request body:", req.body);
  console.log("🔍 Request files:", req.files);
  next();
};

// Add Advance Booking
const addAdvanceBooking = async (req, res) => {
  try {
    console.log("🔍 Received request body:", req.body);
    console.log("🔍 Received files:", req.files);

    const {
      clientId,
      clientName,
      date,
      time,
      advancePayment,
      description,
      phoneNumber,
      image,
    } = req.body;

    // Validate required fields with detailed logging
    console.log("🔍 Validating fields:");
    console.log("clientId:", clientId, "Type:", typeof clientId);
    console.log("clientName:", clientName, "Type:", typeof clientName);
    console.log("date:", date, "Type:", typeof date);
    console.log("time:", time, "Type:", typeof time);
    console.log(
      "advancePayment:",
      advancePayment,
      "Type:",
      typeof advancePayment
    );
    console.log("phoneNumber:", phoneNumber, "Type:", typeof phoneNumber);
    console.log("description:", description, "Type:", typeof description);

    if (
      !clientId ||
      !clientName ||
      !date ||
      !time ||
      !advancePayment ||
      !phoneNumber ||
      !description
    ) {
      console.log("❌ Validation failed - missing fields detected");
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    console.log("✅ All required fields are present");

    // Check for unique clientId
    const existingBooking = await AdvanceBooking.findOne({ clientId });
    if (existingBooking) {
      return res.status(400).json({
        success: false,
        message: "clientId must be unique. This clientId already exists.",
      });
    }

    // Validate date and time
    const bookingDate = new Date(date);
    const currentDate = new Date();
    if (bookingDate < currentDate) {
      return res.status(400).json({
        success: false,
        message: "Booking date cannot be in the past",
      });
    }

    // Validate advance payment
    if (advancePayment <= 0) {
      return res.status(400).json({
        success: false,
        message: "Advance payment must be greater than 0",
      });
    }

    // Validate phone number
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      });
    }

    // Handle image upload
    let imageUrl = "";
    if (req.file) {
      console.log("🔍 File uploaded:", req.file);
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "sarte-salon/bookings",
        resource_type: "auto",
      });
      imageUrl = result.secure_url;
      console.log("🔍 Image uploaded to Cloudinary:", imageUrl);
    } else if (image) {
      imageUrl = image;
    } else {
      // For now, use a placeholder image if no image is provided
      imageUrl = "https://via.placeholder.com/300x300?text=No+Image";
    }

    // Calculate reminder date (24 hours before booking)
    const reminderDate = new Date(bookingDate);
    reminderDate.setHours(reminderDate.getHours() - 24);

    // Create booking
    const booking = new AdvanceBooking({
      clientId,
      clientName,
      date: bookingDate,
      time,
      advancePayment,
      description,
      phoneNumber,
      image: imageUrl,
      reminderDate,
    });

    await booking.save();

    res.status(201).json({
      success: true,
      message: "Advance booking created successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error creating advance booking:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get All Advance Bookings (no filters, only required fields)
const getAllAdvanceBookings = async (req, res) => {
  try {
    const bookings = await AdvanceBooking.find(
      {},
      "clientId clientName date time advancePayment description phoneNumber image reminderDate status createdAt"
    ).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: bookings,
    });
  } catch (error) {
    console.error("Error getting advance bookings:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get Upcoming Reminders (24 hours before booking)
const getUpcomingReminders = async (req, res) => {
  try {
    const currentDate = new Date();
    const next24Hours = new Date();
    next24Hours.setHours(next24Hours.getHours() + 24);

    const upcomingBookings = await AdvanceBooking.find({
      reminderDate: {
        $lte: next24Hours,
        $gte: currentDate,
      },
      reminderSent: { $ne: true },
      status: { $ne: "cancelled" },
    });

    res.status(200).json({
      success: true,
      message: "Upcoming reminders retrieved successfully",
      data: upcomingBookings,
    });
  } catch (error) {
    console.error("Error getting upcoming reminders:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Mark Reminder as Sent
const markReminderSent = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await AdvanceBooking.findByIdAndUpdate(
      bookingId,
      {
        reminderSent: true,
        reminderSentAt: new Date(),
      },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Reminder marked as sent",
      data: booking,
    });
  } catch (error) {
    console.error("Error marking reminder as sent:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update Booking Status
const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "confirmed", "completed", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid status. Allowed values: pending, confirmed, completed, cancelled",
      });
    }

    const booking = await AdvanceBooking.findByIdAndUpdate(
      bookingId,
      {
        status,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Booking status updated to ${status}`,
      data: booking,
    });
  } catch (error) {
    console.error("Error updating booking status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update Booking
const updateBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const updateData = { ...req.body };

    // Remove clientId from update data to prevent changes
    delete updateData.clientId;

    // Validate date if provided
    if (updateData.date) {
      const bookingDate = new Date(updateData.date);
      const currentDate = new Date();
      if (bookingDate < currentDate) {
        return res.status(400).json({
          success: false,
          message: "Booking date cannot be in the past",
        });
      }

      // Recalculate reminder date
      const reminderDate = new Date(bookingDate);
      reminderDate.setHours(reminderDate.getHours() - 24);
      updateData.reminderDate = reminderDate;
    }

    // Handle image upload
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "sarte-salon/bookings",
        resource_type: "auto",
      });
      updateData.image = result.secure_url;
    }

    updateData.updatedAt = new Date();

    const booking = await AdvanceBooking.findByIdAndUpdate(
      bookingId,
      updateData,
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error updating booking:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Delete Booking
const deleteBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await AdvanceBooking.findByIdAndDelete(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get Booking by ID
const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await AdvanceBooking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Booking retrieved successfully",
      data: booking,
    });
  } catch (error) {
    console.error("Error getting booking by ID:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get Booking Statistics
const getBookingStats = async (req, res) => {
  try {
    const totalBookings = await AdvanceBooking.countDocuments();
    const pendingBookings = await AdvanceBooking.countDocuments({
      status: "pending",
    });
    const confirmedBookings = await AdvanceBooking.countDocuments({
      status: "confirmed",
    });
    const completedBookings = await AdvanceBooking.countDocuments({
      status: "completed",
    });
    const cancelledBookings = await AdvanceBooking.countDocuments({
      status: "cancelled",
    });

    // Calculate total advance payments
    const totalAdvancePayments = await AdvanceBooking.aggregate([
      { $group: { _id: null, total: { $sum: "$advancePayment" } } },
    ]);

    const totalAdvanceAmount =
      totalAdvancePayments.length > 0 ? totalAdvancePayments[0].total : 0;

    // Get upcoming bookings (next 7 days)
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingBookings = await AdvanceBooking.countDocuments({
      date: {
        $gte: new Date(),
        $lte: nextWeek,
      },
      status: { $ne: "cancelled" },
    });

    res.status(200).json({
      success: true,
      message: "Booking statistics retrieved successfully",
      data: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        cancelledBookings,
        totalAdvanceAmount,
        upcomingBookings,
      },
    });
  } catch (error) {
    console.error("Error getting booking statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  addAdvanceBooking,
  getAllAdvanceBookings,
  getUpcomingReminders,
  markReminderSent,
  updateBookingStatus,
  updateBooking,
  deleteBooking,
  getBookingById,
  getBookingStats,
  handleFileUpload,
};
