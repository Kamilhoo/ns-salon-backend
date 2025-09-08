require("dotenv").config();
const Bill = require("../models/Bill");
const Client = require("../models/Client");

// Create new bill
exports.createBill = async (req, res) => {
  try {
    const {
      clientId,
      clientName,
      clientPhone,
      services,
      totalAmount,
      discount = 0,
      paymentMethod,
      paymentStatus = "pending",
      notes,
    } = req.body;

    // Validate required fields
    if (
      !clientId ||
      !clientName ||
      !services ||
      !totalAmount ||
      !paymentMethod
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Required fields: clientId, clientName, services, totalAmount, paymentMethod",
      });
    }

    // Validate services array
    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Services must be a non-empty array",
      });
    }

    // Validate each service
    for (const service of services) {
      if (!service.name || !service.price) {
        return res.status(400).json({
          success: false,
          message: "Each service must have name and price",
        });
      }
    }

    // Check if client exists
    const client = await Client.findById(clientId);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: "Client not found",
      });
    }

    // Calculate final amount
    const finalAmount = totalAmount - discount;

    // Create bill
    const bill = new Bill({
      clientId,
      clientName,
      clientPhone: clientPhone || client.phoneNumber,
      services,
      totalAmount,
      discount,
      finalAmount,
      paymentMethod,
      paymentStatus,
      notes,
    });

    await bill.save();

    // Add visit to client
    try {
      const client = await Client.findById(clientId);
      if (client) {
        // Generate visit ID
        const visitId = `VISIT${Date.now()}`;

        // Create new visit
        const newVisit = {
          visitId,
          date: new Date(),
          services: services,
          totalAmount: finalAmount,
          billNumber: bill._id.toString(),
          paymentStatus: paymentStatus,
        };

        // Add visit to client
        client.visits.push(newVisit);
        client.totalVisits += 1;
        client.totalSpent += finalAmount;
        client.lastVisit = new Date();

        await client.save();
      }
    } catch (visitError) {
      console.error("Error adding visit to client:", visitError);
      // Don't fail the bill creation if visit tracking fails
    }

    res.status(201).json({
      success: true,
      message: "Bill created successfully",
      bill,
    });
  } catch (error) {
    console.error("Error creating bill:", error);
    res.status(500).json({
      success: false,
      message: "Error creating bill",
      error: error.message,
    });
  }
};

// Get client billing history
exports.getClientBillingHistory = async (req, res) => {
  try {
    const { clientId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    // Build filter
    const filter = { clientId };
    if (status) {
      filter.paymentStatus = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get bills with pagination
    const bills = await Bill.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalBills = await Bill.countDocuments(filter);

    // Calculate totals
    const totalAmount = await Bill.aggregate([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]);

    const paidAmount = await Bill.aggregate([
      { $match: { ...filter, paymentStatus: "paid" } },
      { $group: { _id: null, total: { $sum: "$finalAmount" } } },
    ]);

    res.status(200).json({
      success: true,
      message: "Billing history retrieved successfully",
      data: {
        bills,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalBills / parseInt(limit)),
          totalBills,
          hasNext: skip + bills.length < totalBills,
          hasPrev: parseInt(page) > 1,
        },
        summary: {
          totalAmount: totalAmount.length > 0 ? totalAmount[0].total : 0,
          paidAmount: paidAmount.length > 0 ? paidAmount[0].total : 0,
        },
      },
    });
  } catch (error) {
    console.error("Error getting billing history:", error);
    res.status(500).json({
      success: false,
      message: "Error getting billing history",
      error: error.message,
    });
  }
};

// Get bill by ID
exports.getBillById = async (req, res) => {
  try {
    const { billId } = req.params;

    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Bill retrieved successfully",
      bill,
    });
  } catch (error) {
    console.error("Error getting bill:", error);
    res.status(500).json({
      success: false,
      message: "Error getting bill",
      error: error.message,
    });
  }
};

// Update bill payment status
exports.updateBillPayment = async (req, res) => {
  try {
    const { billId } = req.params;
    const { paymentStatus, paymentMethod, notes } = req.body;

    // Validate payment status
    const validStatuses = ["pending", "paid", "partially_paid", "overdue"];
    if (paymentStatus && !validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid payment status. Valid options: pending, paid, partially_paid, overdue",
      });
    }

    const updateData = {};
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (notes) updateData.notes = notes;

    // Add payment date if status is paid
    if (paymentStatus === "paid") {
      updateData.paidAt = new Date();
    }

    updateData.updatedAt = new Date();

    const bill = await Bill.findByIdAndUpdate(billId, updateData, {
      new: true,
    });

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Bill payment updated successfully",
      bill,
    });
  } catch (error) {
    console.error("Error updating bill payment:", error);
    res.status(500).json({
      success: false,
      message: "Error updating bill payment",
      error: error.message,
    });
  }
};

// Cancel bill
exports.cancelBill = async (req, res) => {
  try {
    const { billId } = req.params;
    const { reason } = req.body;

    const bill = await Bill.findByIdAndUpdate(
      billId,
      {
        paymentStatus: "cancelled",
        notes: reason ? `Cancelled: ${reason}` : "Bill cancelled",
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (!bill) {
      return res.status(404).json({
        success: false,
        message: "Bill not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Bill cancelled successfully",
      bill,
    });
  } catch (error) {
    console.error("Error cancelling bill:", error);
    res.status(500).json({
      success: false,
      message: "Error cancelling bill",
      error: error.message,
    });
  }
};

// Search bills by client
exports.searchBillsByClient = async (req, res) => {
  try {
    const { query, status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    // Build search filter
    const searchFilter = {
      $or: [
        { clientName: { $regex: query, $options: "i" } },
        { clientPhone: { $regex: query, $options: "i" } },
      ],
    };

    // Add additional filters
    if (status) {
      searchFilter.paymentStatus = status;
    }

    if (dateFrom || dateTo) {
      searchFilter.createdAt = {};
      if (dateFrom) searchFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) searchFilter.createdAt.$lte = new Date(dateTo);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Search bills
    const bills = await Bill.find(searchFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalBills = await Bill.countDocuments(searchFilter);

    res.status(200).json({
      success: true,
      message: `Found ${totalBills} bills`,
      data: {
        bills,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalBills / parseInt(limit)),
          totalBills,
          hasNext: skip + bills.length < totalBills,
          hasPrev: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error searching bills:", error);
    res.status(500).json({
      success: false,
      message: "Error searching bills",
      error: error.message,
    });
  }
};

// Get manager billing statistics
exports.getManagerBillingStats = async (req, res) => {
  try {
    // Total bills
    const totalBills = await Bill.countDocuments();

    // Bills by status
    const billsByStatus = await Bill.aggregate([
      {
        $group: {
          _id: "$paymentStatus",
          count: { $sum: 1 },
          totalAmount: { $sum: "$finalAmount" },
        },
      },
    ]);

    // Today's bills
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBills = await Bill.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
    });

    const todayRevenue = await Bill.aggregate([
      {
        $match: {
          createdAt: { $gte: today, $lt: tomorrow },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$finalAmount" },
        },
      },
    ]);

    // This month's stats
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthlyBills = await Bill.countDocuments({
      createdAt: { $gte: firstDayOfMonth },
    });

    const monthlyRevenue = await Bill.aggregate([
      {
        $match: {
          createdAt: { $gte: firstDayOfMonth },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$finalAmount" },
        },
      },
    ]);

    // Top services
    const topServices = await Bill.aggregate([
      { $unwind: "$services" },
      {
        $group: {
          _id: "$services.name",
          count: { $sum: 1 },
          totalRevenue: { $sum: "$services.price" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Monthly revenue trend (last 6 months)
    const monthlyTrend = await Bill.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(today.setMonth(today.getMonth() - 6)) },
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          revenue: { $sum: "$finalAmount" },
          billCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    // Recent bills
    const recentBills = await Bill.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .select("billNumber clientName finalAmount paymentStatus createdAt");

    res.status(200).json({
      success: true,
      message: "Billing statistics retrieved successfully",
      stats: {
        totalBills,
        todayBills,
        monthlyBills,
        todayRevenue: todayRevenue.length > 0 ? todayRevenue[0].total : 0,
        monthlyRevenue: monthlyRevenue.length > 0 ? monthlyRevenue[0].total : 0,
        billsByStatus,
        topServices,
        monthlyTrend,
        recentBills,
      },
    });
  } catch (error) {
    console.error("Error getting billing stats:", error);
    res.status(500).json({
      success: false,
      message: "Error getting billing statistics",
      error: error.message,
    });
  }
};
