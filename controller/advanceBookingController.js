require("dotenv").config();
const AdvanceBooking = require("../models/AdvanceBooking");
const Notification = require("../models/Notification");
const Admin = require("../models/Admin");
const Manager = require("../models/Manager");
const cloudinary = require("cloudinary").v2;
const moment = require("moment-timezone");

// Helper function for proper reminder calculation
const calculateReminderDateTime = (bookingDate, bookingTime) => {
  try {
    const TIMEZONE = "Asia/Karachi";
    const dateStr = moment(bookingDate).format("YYYY-MM-DD");
    const combinedStr = `${dateStr} ${bookingTime}`;

    const bookingMoment = moment.tz(
      combinedStr,
      "YYYY-MM-DD hh:mm A",
      TIMEZONE
    );

    if (!bookingMoment.isValid()) {
      throw new Error(`Invalid date/time combination: ${combinedStr}`);
    }

    const reminderMoment = bookingMoment.clone().subtract(24, "hours");
    return reminderMoment.toDate();
  } catch (error) {
    const bookingDateTime = new Date(`${bookingDate}T${bookingTime}`);
    return new Date(bookingDateTime.getTime() - 24 * 60 * 60 * 1000);
  }
};

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Middleware for debugging file upload
const handleFileUpload = (req, res, next) => {
  console.log("🔍 File upload middleware called");
  console.log("🔍 Request body:", req.body);
  console.log("🔍 Request files:", req.files);
  next();
};

// Create advance booking reminder notification
const createAdvanceBookingReminder = async (booking) => {
  try {
    const reminderDate = new Date(booking.reminderDate);

    const admins = await Admin.find({ isActive: { $ne: false } });
    const managers = await Manager.find({ isActive: { $ne: false } });

    for (const admin of admins) {
      const notification = new Notification({
        title: "Advance Booking Reminder",
        message: `Reminder: Call client ${booking.clientName} (${booking.phoneNumber}) for tomorrow's booking at ${booking.time}`,
        type: "advance_booking_reminder",
        recipientType: "admin",
        recipientId: admin._id,
        recipientModel: "Admin",
        relatedEntityType: "advance_booking",
        relatedEntityId: booking._id,
        scheduledFor: reminderDate,
        priority: "high",
      });
      await notification.save();
    }

    for (const manager of managers) {
      const notification = new Notification({
        title: "Advance Booking Reminder",
        message: `Reminder: Call client ${booking.clientName} (${booking.phoneNumber}) for tomorrow's booking at ${booking.time}`,
        type: "advance_booking_reminder",
        recipientType: "manager",
        recipientId: manager._id,
        recipientModel: "Manager",
        relatedEntityType: "advance_booking",
        relatedEntityId: booking._id,
        scheduledFor: reminderDate,
        priority: "high",
      });
      await notification.save();
    }
  } catch (error) {
    console.error("❌ Error creating advance booking reminder:", error);
  }
};

// ✅ Corrected Add Advance Booking
const addAdvanceBooking = async (req, res) => {
  try {
    const {
      clientName,
      date,
      time,
      advancePayment,
      description,
      phoneNumber,
      image,
      reminderDate,
    } = req.body;

    if (
      !clientName ||
      !date ||
      !time ||
      !advancePayment ||
      !phoneNumber ||
      !description
    ) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const bookingDate = new Date(date);
    if (bookingDate < new Date()) {
      return res.status(400).json({
        success: false,
        message: "Booking date cannot be in the past",
      });
    }

    if (advancePayment <= 0) {
      return res.status(400).json({
        success: false,
        message: "Advance payment must be greater than 0",
      });
    }

    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Invalid phone number format",
      });
    }

    let imageUrl = "";
    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "sarte-salon/bookings",
        resource_type: "auto",
      });
      imageUrl = result.secure_url;
    } else if (image) {
      imageUrl = image;
    } else {
      imageUrl = "https://via.placeholder.com/300x300?text=No+Image";
    }

    let calculatedReminderDate;
    if (reminderDate) {
      calculatedReminderDate = new Date(reminderDate);
    } else {
      calculatedReminderDate = calculateReminderDateTime(date, time);
    }

    const booking = new AdvanceBooking({
      clientName,
      date,
      time,
      advancePayment,
      description,
      phoneNumber,
      image: imageUrl,
      reminderDate: calculatedReminderDate,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await booking.save();
    await createAdvanceBookingReminder(booking);

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

// Other CRUD functions remain same (no changes needed)
const getAllAdvanceBookings = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const bookings = await AdvanceBooking.find(
      {},
      "clientName date time advancePayment description phoneNumber image reminderDate status createdAt"
    )
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
    const totalBookings = await AdvanceBooking.countDocuments();
    
    res.status(200).json({
      success: true,
      message: "Bookings retrieved successfully",
      data: {
        bookings,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalBookings / parseInt(limit)),
          totalBookings,
          hasNext: skip + bookings.length < totalBookings,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUpcomingReminders = async (req, res) => {
  try {
    const currentDate = new Date();
    const next24Hours = new Date();
    next24Hours.setHours(next24Hours.getHours() + 24);

    const upcomingBookings = await AdvanceBooking.find({
      reminderDate: { $lte: next24Hours, $gte: currentDate },
      reminderSent: { $ne: true },
      status: { $ne: "cancelled" },
    });

    res.status(200).json({
      success: true,
      message: "Upcoming reminders retrieved successfully",
      data: upcomingBookings,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const markReminderSent = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await AdvanceBooking.findByIdAndUpdate(
      bookingId,
      { reminderSent: true, reminderSentAt: new Date() },
      { new: true }
    );

    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    res.status(200).json({
      success: true,
      message: "Reminder marked as sent",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;

    const allowedStatuses = ["pending", "confirmed", "completed", "cancelled"];
    if (!allowedStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value" });
    }

    const booking = await AdvanceBooking.findByIdAndUpdate(
      bookingId,
      { status, updatedAt: new Date() },
      { new: true }
    );

    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    res.status(200).json({
      success: true,
      message: `Booking status updated to ${status}`,
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const updateData = { ...req.body };

    delete updateData.clientId;

    if (updateData.date) {
      const bookingDate = new Date(updateData.date);
      if (bookingDate < new Date()) {
        return res.status(400).json({
          success: false,
          message: "Booking date cannot be in the past",
        });
      }
      const reminderDate = new Date(bookingDate);
      reminderDate.setHours(reminderDate.getHours() - 24);
      updateData.reminderDate = reminderDate;
    }

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

    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    res.status(200).json({
      success: true,
      message: "Booking updated successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteBooking = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await AdvanceBooking.findByIdAndDelete(bookingId);

    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    res.status(200).json({
      success: true,
      message: "Booking deleted successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await AdvanceBooking.findById(bookingId);

    if (!booking)
      return res
        .status(404)
        .json({ success: false, message: "Booking not found" });

    res.status(200).json({
      success: true,
      message: "Booking retrieved successfully",
      data: booking,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

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

    const totalAdvancePayments = await AdvanceBooking.aggregate([
      { $group: { _id: null, total: { $sum: "$advancePayment" } } },
    ]);

    const totalAdvanceAmount =
      totalAdvancePayments.length > 0 ? totalAdvancePayments[0].total : 0;

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const upcomingBookings = await AdvanceBooking.countDocuments({
      date: { $gte: new Date(), $lte: nextWeek },
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
    res.status(500).json({ success: false, message: error.message });
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
