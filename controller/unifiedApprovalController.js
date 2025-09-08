require("dotenv").config();
const ManualAttendanceRequest = require("../models/ManualAttendanceRequest");
const Expense = require("../models/Expense");
const AdvanceSalary = require("../models/AdvanceSalary");
const Attendance = require("../models/Attendance");

// Get All Pending Approvals (Unified)
exports.getAllPendingApprovals = async (req, res) => {
  try {
    console.log("🔍 Fetching all pending approvals...");

    // Get all pending requests from different models
    const pendingManualAttendance = await ManualAttendanceRequest.find({
      status: "pending",
    })
      .populate("employeeId", "name employeeId")
      .sort({ createdAt: -1 });

    console.log(
      "✅ Manual attendance requests found:",
      pendingManualAttendance.length
    );

    const pendingExpenses = await Expense.find({ status: "pending" }).sort({
      createdAt: -1,
    });

    console.log("✅ Pending expenses found:", pendingExpenses.length);
    console.log(
      "✅ Pending expenses details:",
      pendingExpenses.map((exp) => ({
        id: exp._id,
        name: exp.name,
        status: exp.status,
        userRole: exp.userRole,
        createdAt: exp.createdAt,
      }))
    );

    const pendingAdvanceSalary = await AdvanceSalary.find({ status: "pending" })
      .populate("employeeId", "name employeeId")
      .populate("submittedBy", "name")
      .sort({ createdAt: -1 });

    console.log(
      "✅ Advance salary requests found:",
      pendingAdvanceSalary.length
    );

    // Format the responses with type identification
    const formattedManualAttendance = pendingManualAttendance.map((item) => ({
      ...item.toObject(),
      requestType: "manual_attendance",
      displayType: "Manual Attendance Request",
    }));

    const formattedExpenses = pendingExpenses.map((item) => ({
      ...item.toObject(),
      requestType: "expense",
      displayType: "Expense Request",
      employeeName: item.name, // Add this for frontend compatibility
      managerName: item.name, // Add this for frontend compatibility
      userName: item.name, // Add this for frontend compatibility
    }));

    console.log(
      "✅ Formatted expenses:",
      formattedExpenses.map((exp) => ({
        id: exp._id,
        name: exp.name,
        requestType: exp.requestType,
        employeeName: exp.employeeName,
      }))
    );

    const formattedAdvanceSalary = pendingAdvanceSalary.map((item) => ({
      ...item.toObject(),
      requestType: "advance_salary",
      displayType: "Advance Salary Request",
    }));

    // Combine all pending requests
    const allPendingRequests = [
      ...formattedManualAttendance,
      ...formattedExpenses,
      ...formattedAdvanceSalary,
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log("✅ Total pending requests:", allPendingRequests.length);
    console.log(
      "✅ All pending requests:",
      allPendingRequests.map((req) => ({
        id: req._id,
        type: req.requestType,
        name: req.name || req.employeeName || req.managerName || req.userName,
      }))
    );

    res.status(200).json({
      success: true,
      message: "All pending approvals fetched successfully",
      data: allPendingRequests,
      totalPending: allPendingRequests.length,
    });
  } catch (err) {
    console.error("Get All Pending Approvals Error:", err);
    res.status(500).json({
      message: "Error fetching pending approvals",
      error: err.message,
    });
  }
};

// Approve/Decline Request (Unified)
exports.approveDeclineRequest = async (req, res) => {
  try {
    const { requestType, requestId } = req.params;
    const { status, adminNotes } = req.body;

    if (!["approved", "declined"].includes(status)) {
      return res.status(400).json({
        message: "Status must be either approved or declined",
      });
    }

    let request;
    let updatedRequest;

    switch (requestType) {
      case "manual_attendance":
        request = await ManualAttendanceRequest.findById(requestId);
        if (!request) {
          return res
            .status(404)
            .json({ message: "Manual attendance request not found" });
        }
        if (request.status !== "pending") {
          return res
            .status(400)
            .json({ message: "This request has already been processed" });
        }

        request.status = status;
        request.adminNotes = adminNotes || "";
        request.updatedAt = new Date();
        await request.save();

        // If approved, create or update attendance record
        if (status === "approved") {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          let attendance = await Attendance.findOne({
            employeeId: request.employeeId,
            date: {
              $gte: today,
              $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000),
            },
          });

          if (!attendance) {
            attendance = new Attendance({
              employeeId: request.employeeId,
              employeeName: request.employeeName,
              date: today,
              status: "present",
              isManualRequest: true,
              manualRequestData: {
                requestType: request.requestType,
                requestedTime: request.requestedTime,
                note: request.note,
                status: "approved",
                adminNotes: adminNotes,
              },
            });
          } else {
            attendance.isManualRequest = true;
            attendance.manualRequestData = {
              requestType: request.requestType,
              requestedTime: request.requestedTime,
              note: request.note,
              status: "approved",
              adminNotes: adminNotes,
            };
          }

          if (request.requestType === "checkin") {
            attendance.checkInTime = new Date(request.requestedTime);
          } else if (request.requestType === "checkout") {
            attendance.checkOutTime = new Date(request.requestedTime);
          }

          await attendance.save();
        }

        updatedRequest = request;
        break;

      case "expense":
        request = await Expense.findById(requestId);
        if (!request) {
          return res.status(404).json({ message: "Expense request not found" });
        }
        if (request.status !== "pending") {
          return res
            .status(400)
            .json({ message: "This request has already been processed" });
        }

        request.status = status;
        request.adminNotes = adminNotes || "";
        request.updatedAt = new Date();
        await request.save();

        updatedRequest = request;
        break;

      case "advance_salary":
        request = await AdvanceSalary.findById(requestId);
        if (!request) {
          return res
            .status(404)
            .json({ message: "Advance salary request not found" });
        }
        if (request.status !== "pending") {
          return res
            .status(400)
            .json({ message: "This request has already been processed" });
        }

        request.status = status;
        request.adminNotes = adminNotes || "";
        request.updatedAt = new Date();
        await request.save();

        updatedRequest = request;
        break;

      default:
        return res.status(400).json({
          message:
            "Invalid request type. Must be manual_attendance, expense, or advance_salary",
        });
    }

    res.status(200).json({
      message: `${requestType.replace(
        "_",
        " "
      )} request ${status} successfully`,
      request: {
        id: updatedRequest._id,
        requestType: requestType,
        status: updatedRequest.status,
        adminNotes: updatedRequest.adminNotes,
        updatedAt: updatedRequest.updatedAt,
      },
    });
  } catch (err) {
    console.error("Approve/Decline Request Error:", err);
    res.status(500).json({
      message: "Error processing request",
      error: err.message,
    });
  }
};

// Get Approval Statistics
exports.getApprovalStats = async (req, res) => {
  try {
    const pendingManualAttendance =
      await ManualAttendanceRequest.countDocuments({ status: "pending" });
    const pendingExpenses = await Expense.countDocuments({ status: "pending" });
    const pendingAdvanceSalary = await AdvanceSalary.countDocuments({
      status: "pending",
    });

    const totalPending =
      pendingManualAttendance + pendingExpenses + pendingAdvanceSalary;

    // Get approved counts
    const approvedManualAttendance =
      await ManualAttendanceRequest.countDocuments({ status: "approved" });
    const approvedExpenses = await Expense.countDocuments({
      status: "approved",
    });
    const approvedAdvanceSalary = await AdvanceSalary.countDocuments({
      status: "approved",
    });

    // Get declined counts
    const declinedManualAttendance =
      await ManualAttendanceRequest.countDocuments({ status: "declined" });
    const declinedExpenses = await Expense.countDocuments({
      status: "declined",
    });
    const declinedAdvanceSalary = await AdvanceSalary.countDocuments({
      status: "declined",
    });

    res.status(200).json({
      pending: {
        manualAttendance: pendingManualAttendance,
        expenses: pendingExpenses,
        advanceSalary: pendingAdvanceSalary,
        total: totalPending,
      },
      approved: {
        manualAttendance: approvedManualAttendance,
        expenses: approvedExpenses,
        advanceSalary: approvedAdvanceSalary,
        total:
          approvedManualAttendance + approvedExpenses + approvedAdvanceSalary,
      },
      declined: {
        manualAttendance: declinedManualAttendance,
        expenses: declinedExpenses,
        advanceSalary: declinedAdvanceSalary,
        total:
          declinedManualAttendance + declinedExpenses + declinedAdvanceSalary,
      },
    });
  } catch (err) {
    console.error("Get Approval Stats Error:", err);
    res.status(500).json({
      message: "Error fetching approval statistics",
      error: err.message,
    });
  }
};

// Get Request Details by Type and ID
exports.getRequestDetails = async (req, res) => {
  try {
    const { requestType, requestId } = req.params;

    let request;

    switch (requestType) {
      case "manual_attendance":
        request = await ManualAttendanceRequest.findById(requestId).populate(
          "employeeId",
          "name employeeId"
        );
        break;

      case "expense":
        request = await Expense.findById(requestId);
        break;

      case "advance_salary":
        request = await AdvanceSalary.findById(requestId)
          .populate("employeeId", "name employeeId")
          .populate("submittedBy", "name");
        break;

      default:
        return res.status(400).json({
          message: "Invalid request type",
        });
    }

    if (!request) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    res.status(200).json({
      requestType: requestType,
      request: request,
    });
  } catch (err) {
    console.error("Get Request Details Error:", err);
    res.status(500).json({
      message: "Error fetching request details",
      error: err.message,
    });
  }
};
