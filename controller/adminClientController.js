require('dotenv').config();
const AdminClient = require('../models/AdminClient');
const Admin = require('../models/Admin');
const Manager = require('../models/Manager');

// Add new admin client (Admin only)
exports.addAdminClient = async (req, res) => {
  try {
    const { name, phoneNumber } = req.body;

    if (!name || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Name and phone number are required'
      });
    }

    const existingClient = await AdminClient.findOne({ phoneNumber });
    if (existingClient) {
      return res.status(400).json({
        success: false,
        message: 'Client with this phone number already exists'
      });
    }

    const adminClient = new AdminClient({
      name,
      phoneNumber
    });

    await adminClient.save();

    console.log(`✅ New admin client added: ${adminClient.name} (ID: ${adminClient.clientId}) by admin: ${adminId}`);

    res.status(201).json({
      success: true,
      message: 'Admin client added successfully',
      client: {
        clientId: adminClient.clientId,
        name: adminClient.name,
        phoneNumber: adminClient.phoneNumber
      }
    });

  } catch (err) {
    console.error('❌ Add Admin Client Error:', err);
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: err.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error adding admin client',
      error: err.message
    });
  }
};

// Get all admin clients (Admin only)
exports.getAllAdminClients = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      sortBy = 'name',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { clientId: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const adminClients = await AdminClient.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('clientId name phoneNumber');

    const totalClients = await AdminClient.countDocuments(filter);
    const totalPages = Math.ceil(totalClients / limit);

    console.log(`📋 Retrieved ${adminClients.length} admin clients for admin: ${adminId}`);

    res.status(200).json({
      success: true,
      clients: adminClients,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalClients,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });

  } catch (err) {
    console.error('❌ Get All Admin Clients Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin clients',
      error: err.message
    });
  }
};

// Get admin client by ID (Admin only)
exports.getAdminClientById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Client ID is required'
      });
    }

    const adminClient = await AdminClient.findOne({ _id: id })
      .select('clientId name phoneNumber');
    
    if (!adminClient) {
      return res.status(404).json({
        success: false,
        message: 'Admin client not found'
      });
    }

    res.status(200).json({
      success: true,
      client: adminClient
    });

  } catch (err) {
    console.error('❌ Get Admin Client By ID Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin client',
      error: err.message
    });
  }
};

// Update admin client (Admin only)
exports.updateAdminClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phoneNumber } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Client ID is required'
      });
    }

    const existingClient = await AdminClient.findOne({ _id: id });
    if (!existingClient) {
      return res.status(404).json({
        success: false,
        message: 'Admin client not found'
      });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;

    if (updateData.phoneNumber && updateData.phoneNumber !== existingClient.phoneNumber) {
      const phoneExists = await AdminClient.findOne({ 
        phoneNumber: updateData.phoneNumber,
        _id: { $ne: id }
      });
      
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: 'Phone number already exists with another client'
        });
      }
    }

    const updatedClient = await AdminClient.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('clientId name phoneNumber');

    console.log(`✅ Admin client updated: ${updatedClient.name} (ID: ${updatedClient.clientId})`);

    res.status(200).json({
      success: true,
      message: 'Admin client updated successfully',
      client: updatedClient
    });

  } catch (err) {
    console.error('❌ Update Admin Client Error:', err);
    
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        error: err.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error updating admin client',
      error: err.message
    });
  }
};

// Delete admin client (Admin only)
exports.deleteAdminClient = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Client ID is required'
      });
    }

    // Check if client exists and belongs to this admin
    const client = await AdminClient.findOne({ _id: id, createdBy: adminId });
    
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Admin client not found'
      });
    }

    // Delete the admin client
    await AdminClient.findByIdAndDelete(id);

    console.log(`🗑️ Admin client deleted: ${client.name} (ID: ${client.clientId}) by admin: ${adminId}`);

    res.status(200).json({
      success: true,
      message: 'Admin client deleted successfully',
      deletedClient: {
        id: client._id,
        clientId: client.clientId,
        name: client.name
      }
    });

  } catch (err) {
    console.error('❌ Delete Admin Client Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error deleting admin client',
      error: err.message
    });
  }
};

// Get admin client statistics (Admin only)
exports.getAdminClientStats = async (req, res) => {
  try {
    const adminId = req.user.id;

    const totalClients = await AdminClient.countDocuments({ createdBy: adminId });

    res.status(200).json({
      success: true,
      stats: {
        totalClients
      }
    });

  } catch (err) {
    console.error('❌ Get Admin Client Stats Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching admin client statistics',
      error: err.message
    });
  }
};

// Search admin clients (Admin only)
exports.searchAdminClients = async (req, res) => {
  try {
    const adminId = req.user.id;
    const { query, limit = 20 } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchRegex = { $regex: query.trim(), $options: 'i' };
    
    const filter = {
      createdBy: adminId,
      $or: [
        { name: searchRegex },
        { phoneNumber: searchRegex },
        { clientId: searchRegex }
      ]
    };
    
    const clients = await AdminClient.find(filter)
      .limit(parseInt(limit))
      .select('clientId name phoneNumber')
      .sort({ name: 1 });

    console.log(`🔍 Search results for "${query}": ${clients.length} admin clients found`);

    res.status(200).json({
      success: true,
      query: query.trim(),
      results: clients,
      totalResults: clients.length
    });

  } catch (err) {
    console.error('❌ Search Admin Clients Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error searching admin clients',
      error: err.message
    });
  }
};

// Assign manager to admin client (Admin only)
exports.assignManagerToClient = async (req, res) => {
  try {
    return res.status(400).json({
      success: false,
      message: 'Assigning manager is not supported in the simplified client model'
    });

  } catch (err) {
    console.error('❌ Assign Manager Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error assigning manager',
      error: err.message
    });
  }
};
