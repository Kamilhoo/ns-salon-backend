require('dotenv').config();
const Service = require('../models/Services');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer to handle multiple files with any field name
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

// Accept any field name for files (this handles dynamic field names)
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept all files (you can add image type validation here if needed)
    cb(null, true);
  },
}).any(); // .any() accepts files with any field name

// Middleware function to handle file uploads
const handleFileUpload = (req, res, next) => {
  upload(req, res, (err) => {
    if (err) {
      console.error('Multer Error:', err);
      return res.status(400).json({
        message: 'File upload error',
        error: err.message,
      });
    }
    
    // Log the parsed body and files for debugging
    console.log('📋 Parsed body:', req.body);
    console.log('📁 Files:', req.files);
    
    next();
  });
};

exports.addService = async (req, res) => {
  try {
    const { title, subServices } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ message: 'Service name (title) is required' });
    }

    // Convert req.files array to object for easier access
    const filesObj = {};
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        if (!filesObj[file.fieldname]) {
          filesObj[file.fieldname] = [];
        }
        filesObj[file.fieldname].push(file);
      });
    }

    // Main service image - Check for both 'image' and 'mainImage' field names
    let imageUrl = '';
    const mainImageField = filesObj['image'] || filesObj['mainImage'];
    if (mainImageField && mainImageField.length > 0) {
      try {
        const result = await cloudinary.uploader.upload(
          mainImageField[0].path,
          {
            folder: 'salon-services',
            resource_type: 'auto',
            use_filename: true,
            unique_filename: true,
          }
        );
        imageUrl = result.secure_url;
      } catch (cloudinaryError) {
        return res.status(400).json({
          message: 'Main image upload failed',
          error: cloudinaryError.message,
        });
      }
    }

    // Sub-services and their images
    let parsedSubServices = [];
    if (subServices) {
      try {
        const subServicesArr = JSON.parse(subServices);
        parsedSubServices = await Promise.all(
          subServicesArr.map(async (sub, idx) => {
            // Only allow: name, price, time, description, image
            let subImageUrl = '';
            const fieldName = `subServiceImage${idx}`;
            if (filesObj[fieldName] && filesObj[fieldName].length > 0) {
              try {
                const result = await cloudinary.uploader.upload(
                  filesObj[fieldName][0].path,
                  {
                    folder: 'salon-services/sub-services',
                    resource_type: 'auto',
                    use_filename: true,
                    unique_filename: true,
                  }
                );
                subImageUrl = result.secure_url;
              } catch (cloudinaryError) {
                subImageUrl = '';
              }
            }
            return {
              name: sub.name,
              price: sub.price,
              time: sub.time,
              description: sub.description,
              image: subImageUrl
            };
          })
        );
      } catch (parseError) {
        return res.status(400).json({
          message: 'Invalid subServices JSON format',
          error: parseError.message,
        });
      }
    }

    const service = new Service({
      title,
      image: imageUrl,
      subServices: parsedSubServices,
    });

    await service.save();
    res.status(201).json({ message: 'Service added', service });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message,
    });
  }
};

exports.getAllServices = async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.status(200).json(services);
  } catch (err) {
    console.error('Get All Services Error:', err);
    res.status(500).json({
      message: 'Error fetching services',
      error: err.message,
      stack: err.stack,
    });
  }
};

// Get service by ID
exports.getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        message: 'Service ID is required'
      });
    }

    const service = await Service.findById(id);
    
    if (!service) {
      return res.status(404).json({
        message: 'Service not found'
      });
    }

    res.status(200).json({
      success: true,
      service
    });
  } catch (err) {
    console.error('Get Service By ID Error:', err);
    res.status(500).json({
      message: 'Error fetching service',
      error: err.message
    });
  }
};

// Delete service image from Cloudinary
const deleteServiceImage = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    
    // Extract public ID from Cloudinary URL
    const urlParts = imageUrl.split('/');
    const publicId = urlParts[urlParts.length - 1].split('.')[0];
    const folder = urlParts[urlParts.length - 2];
    
    if (folder && publicId) {
      const fullPublicId = `${folder}/${publicId}`;
      await cloudinary.uploader.destroy(fullPublicId);
      console.log(`✅ Deleted image from Cloudinary: ${fullPublicId}`);
    }
  } catch (error) {
    console.error('❌ Error deleting image from Cloudinary:', error);
  }
};

// Delete service by ID
exports.deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        message: 'Service ID is required'
      });
    }

    // Find the service first to get image URLs
    const service = await Service.findById(id);
    
    if (!service) {
      return res.status(404).json({
        message: 'Service not found'
      });
    }

    console.log(`🗑️ Deleting service: ${service.title} (ID: ${id})`);

    // Delete main service image from Cloudinary
    if (service.image) {
      await deleteServiceImage(service.image);
    }

    // Delete sub-service images from Cloudinary
    if (service.subServices && service.subServices.length > 0) {
      for (const subService of service.subServices) {
        if (subService.image) {
          await deleteServiceImage(subService.image);
        }
      }
    }

    // Delete the service from database
    await Service.findByIdAndDelete(id);
    
    console.log(`✅ Service deleted successfully: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Service deleted successfully',
      deletedService: {
        id: service._id,
        title: service.title
      }
    });
  } catch (err) {
    console.error('❌ Delete Service Error:', err);
    res.status(500).json({
      message: 'Error deleting service',
      error: err.message
    });
  }
};

// Update service
exports.updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subServices } = req.body;

    if (!id) {
      return res.status(400).json({
        message: 'Service ID is required'
      });
    }

    // Check if service exists
    const existingService = await Service.findById(id);
    if (!existingService) {
      return res.status(404).json({
        message: 'Service not found'
      });
    }

    console.log(`🔄 Updating service: ${existingService.title} (ID: ${id})`);

    // Handle file uploads if any
    let imageUrl = existingService.image;
    if (req.files && req.files.length > 0) {
      const filesObj = {};
      req.files.forEach((file) => {
        if (!filesObj[file.fieldname]) {
          filesObj[file.fieldname] = [];
        }
        filesObj[file.fieldname].push(file);
      });

      // Handle main image update
      const mainImageField = filesObj['image'] || filesObj['mainImage'];
      if (mainImageField && mainImageField.length > 0) {
        // Delete old image if exists
        if (existingService.image) {
          await deleteServiceImage(existingService.image);
        }

        // Upload new image
        const result = await cloudinary.uploader.upload(
          mainImageField[0].path,
          {
            folder: 'salon-services',
            resource_type: 'auto',
            use_filename: true,
            unique_filename: true,
          }
        );
        imageUrl = result.secure_url;
        console.log('✅ New main image uploaded:', imageUrl);
      }
    }

    // Parse sub-services if provided
    let parsedSubServices = existingService.subServices || [];
    if (subServices) {
      try {
        const subServicesArr = JSON.parse(subServices);
        parsedSubServices = await Promise.all(
          subServicesArr.map(async (sub, idx) => {
            let subImageUrl = sub.image || '';
            const fieldName = `subServiceImage${idx}`;

            if (req.files && req.files.length > 0) {
              const filesObj = {};
              req.files.forEach((file) => {
                if (!filesObj[file.fieldname]) {
                  filesObj[file.fieldname] = [];
                }
                filesObj[file.fieldname].push(file);
              });

              if (filesObj[fieldName] && filesObj[fieldName].length > 0) {
                // Delete old sub-service image if exists
                if (sub.image) {
                  await deleteServiceImage(sub.image);
                }

                // Upload new sub-service image
                const result = await cloudinary.uploader.upload(
                  filesObj[fieldName][0].path,
                  {
                    folder: 'salon-services/sub-services',
                    resource_type: 'auto',
                    use_filename: true,
                    unique_filename: true,
                  }
                );
                subImageUrl = result.secure_url;
                console.log(`✅ New sub-service image ${idx} uploaded:`, subImageUrl);
              }
            }

            return { ...sub, image: subImageUrl };
          })
        );
      } catch (parseError) {
        console.error('❌ JSON parse error for subServices:', parseError);
        return res.status(400).json({
          message: 'Invalid subServices JSON format',
          error: parseError.message,
        });
      }
    }

    // Update the service
    const updatedService = await Service.findByIdAndUpdate(
      id,
      {
        title: title || existingService.title,
        image: imageUrl,
        subServices: parsedSubServices,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    console.log(`✅ Service updated successfully: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Service updated successfully',
      service: updatedService
    });
  } catch (err) {
    console.error('❌ Update Service Error:', err);
    res.status(500).json({
      message: 'Error updating service',
      error: err.message
    });
  }
};

// Export the middleware
exports.handleFileUpload = handleFileUpload;
