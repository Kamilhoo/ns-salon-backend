require('dotenv').config();
const Product = require('../models/Products');
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

exports.addProduct = async (req, res) => {
  try {
    if (!req.body) {
      return res.status(400).json({
        message: 'Request body is missing',
      });
    }
    const { name, subProducts } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Product name is required' });
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
    // Main product image - Check for both 'image' and 'mainImage' field names
    let imageUrl = '';
    const mainImageField = filesObj['image'] || filesObj['mainImage'];
    if (mainImageField && mainImageField.length > 0) {
      try {
        const result = await cloudinary.uploader.upload(
          mainImageField[0].path,
          {
            folder: 'salon-products',
            resource_type: 'auto',
            use_filename: true,
            unique_filename: true,
          }
        );
        imageUrl = result.secure_url;
      } catch (cloudinaryError) {
        return res.status(400).json({
          message: 'Main product image upload failed',
          error: cloudinaryError.message,
        });
      }
    }
    // Sub-products and their images
    let parsedSubProducts = [];
    if (subProducts) {
      try {
        const subProductsArr = JSON.parse(subProducts);
        parsedSubProducts = await Promise.all(
          subProductsArr.map(async (sub, idx) => {
            // Only allow: name, price, time, description, image
            let subImageUrl = '';
            const fieldName = `subProductImage${idx}`;
            if (filesObj[fieldName] && filesObj[fieldName].length > 0) {
              try {
                const result = await cloudinary.uploader.upload(
                  filesObj[fieldName][0].path,
                  {
                    folder: 'salon-products/sub-products',
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
          message: 'Invalid subProducts JSON format',
          error: parseError.message,
        });
      }
    }
    const product = new Product({
      name,
      image: imageUrl,
      subProducts: parsedSubProducts,
    });
    await product.save();
    res.status(201).json({ message: 'Product added', product });
  } catch (err) {
    res.status(500).json({
      message: 'Server error',
      error: err.message,
    });
  }
};

exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (err) {
    console.error('Get All Products Error:', err);
    res.status(500).json({
      message: 'Error fetching products',
      error: err.message,
      stack: err.stack,
    });
  }
};

// Get product by ID
exports.getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        message: 'Product ID is required'
      });
    }

    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      product
    });
  } catch (err) {
    console.error('Get Product By ID Error:', err);
    res.status(500).json({
      message: 'Error fetching product',
      error: err.message
    });
  }
};

// Delete product image from Cloudinary
const deleteProductImage = async (imageUrl) => {
  try {
    if (!imageUrl) return;
    
    // Extract public ID from Cloudinary URL
    const urlParts = imageUrl.split('/');
    const publicId = urlParts[urlParts.length - 1].split('.')[0];
    const folder = urlParts[urlParts.length - 2];
    
    if (folder && publicId) {
      const fullPublicId = `${folder}/${publicId}`;
      await cloudinary.uploader.destroy(fullPublicId);
      console.log(`✅ Deleted product image from Cloudinary: ${fullPublicId}`);
    }
  } catch (error) {
    console.error('❌ Error deleting product image from Cloudinary:', error);
  }
};

// Delete product by ID
exports.deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        message: 'Product ID is required'
      });
    }

    // Find the product first to get image URLs
    const product = await Product.findById(id);
    
    if (!product) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    console.log(`🗑️ Deleting product: ${product.name} (ID: ${id})`);

    // Delete main product image from Cloudinary
    if (product.image) {
      await deleteProductImage(product.image);
    }

    // Delete sub-product images from Cloudinary
    if (product.subProducts && product.subProducts.length > 0) {
      for (const subProduct of product.subProducts) {
        if (subProduct.image) {
          await deleteProductImage(subProduct.image);
        }
      }
    }

    // Delete the product from database
    await Product.findByIdAndDelete(id);
    
    console.log(`✅ Product deleted successfully: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      deletedProduct: {
        id: product._id,
        name: product.name
      }
    });
  } catch (err) {
    console.error('❌ Delete Product Error:', err);
    res.status(500).json({
      message: 'Error deleting product',
      error: err.message
    });
  }
};

// Update product
exports.updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, time, description, subProducts } = req.body;

    if (!id) {
      return res.status(400).json({
        message: 'Product ID is required'
      });
    }

    // Check if product exists
    const existingProduct = await Product.findById(id);
    if (!existingProduct) {
      return res.status(404).json({
        message: 'Product not found'
      });
    }

    console.log(`🔄 Updating product: ${existingProduct.name} (ID: ${id})`);

    // Handle file uploads if any
    let imageUrl = existingProduct.image;
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
        if (existingProduct.image) {
          await deleteProductImage(existingProduct.image);
        }

        // Upload new image
        const result = await cloudinary.uploader.upload(
          mainImageField[0].path,
          {
            folder: 'salon-products',
            resource_type: 'auto',
            use_filename: true,
            unique_filename: true,
          }
        );
        imageUrl = result.secure_url;
        console.log('✅ New main product image uploaded:', imageUrl);
      }
    }

    // Parse sub-products if provided
    let parsedSubProducts = existingProduct.subProducts || [];
    if (subProducts) {
      try {
        const subProductsArr = JSON.parse(subProducts);
        parsedSubProducts = await Promise.all(
          subProductsArr.map(async (sub, idx) => {
            let subImageUrl = sub.image || '';
            const fieldName = `subProductImage${idx}`;

            if (req.files && req.files.length > 0) {
              const filesObj = {};
              req.files.forEach((file) => {
                if (!filesObj[file.fieldname]) {
                  filesObj[file.fieldname] = [];
                }
                filesObj[file.fieldname].push(file);
              });

              if (filesObj[fieldName] && filesObj[fieldName].length > 0) {
                // Delete old sub-product image if exists
                if (sub.image) {
                  await deleteProductImage(sub.image);
                }

                // Upload new sub-product image
                const result = await cloudinary.uploader.upload(
                  filesObj[fieldName][0].path,
                  {
                    folder: 'salon-products/sub-products',
                    resource_type: 'auto',
                    use_filename: true,
                    unique_filename: true,
                  }
                );
                subImageUrl = result.secure_url;
                console.log(`✅ New sub-product image ${idx} uploaded:`, subImageUrl);
              }
            }

            return { ...sub, image: subImageUrl };
          })
        );
      } catch (parseError) {
        console.error('❌ JSON parse error for subProducts:', parseError);
        return res.status(400).json({
          message: 'Invalid subProducts JSON format',
          error: parseError.message,
        });
      }
    }

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(
      id,
      {
        name: name || existingProduct.name,
        price: price || existingProduct.price,
        time: time || existingProduct.time,
        description: description || existingProduct.description,
        image: imageUrl,
        subProducts: parsedSubProducts,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    );

    console.log(`✅ Product updated successfully: ${id}`);

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct
    });
  } catch (err) {
    console.error('❌ Update Product Error:', err);
    res.status(500).json({
      message: 'Error updating product',
      error: err.message
    });
  }
};

// Export the middleware
exports.handleFileUpload = handleFileUpload; 