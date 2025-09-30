const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
const crypto = require("crypto");
const { compareFaces, detectFaces } = require("../config/aws");

// Simple in-memory cache for face comparison results
const faceComparisonCache = new Map();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

// Convert image to base64
const imageToBase64 = (imagePath) => {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString("base64");
  } catch (error) {
    console.error("Image to Base64 conversion error:", error);
    return null;
  }
};

// Convert base64 to buffer
const base64ToBuffer = (base64String) => {
  try {
    return Buffer.from(base64String, "base64");
  } catch (error) {
    console.error("Base64 to Buffer conversion error:", error);
    return null;
  }
};

// Optimize image for face recognition (compress and resize)
const optimizeImageForFaceRecognition = async (imagePath) => {
  try {
    const optimizedPath = imagePath.replace(/\.[^/.]+$/, "_optimized.jpg");

    await sharp(imagePath)
      .resize(800, 600, {
        // Resize to optimal size for face recognition
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({
        quality: 85, // Good quality but smaller file size
        progressive: true,
      })
      .toFile(optimizedPath);

    return optimizedPath;
  } catch (error) {
    console.error("Image optimization error:", error);
    return imagePath; // Return original if optimization fails
  }
};

// Enhanced face comparison with optimization and caching
const enhancedFaceComparison = async (storedImagePath, loginImagePath) => {
  try {
    console.log("Starting optimized face comparison process...");

    // Create cache key based on image paths
    const cacheKey = crypto
      .createHash("md5")
      .update(storedImagePath + loginImagePath)
      .digest("hex");

    // Check cache first
    const cachedResult = faceComparisonCache.get(cacheKey);
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
      console.log("Using cached face comparison result");
      return cachedResult.result;
    }

    // Optimize login image first
    const optimizedLoginPath = await optimizeImageForFaceRecognition(
      loginImagePath
    );

    // Handle both local paths and URLs for stored image
    let storedImageBuffer;
    if (storedImagePath.startsWith("http")) {
      // Download image from URL (Cloudinary) with timeout
      const response = await axios.get(storedImagePath, {
        responseType: "arraybuffer",
        timeout: 5000, // 5 second timeout
        maxContentLength: 5 * 1024 * 1024, // 5MB max
      });
      storedImageBuffer = Buffer.from(response.data);
    } else {
      // Read local file
      storedImageBuffer = fs.readFileSync(storedImagePath);
    }

    // Use optimized login image
    const loginImageBuffer = fs.readFileSync(optimizedLoginPath);

    // Skip individual face detection for speed - go directly to comparison
    console.log("Comparing faces directly...");
    const comparisonResult = await compareFaces(
      storedImageBuffer,
      loginImageBuffer
    );

    // Clean up optimized image
    cleanupTempImage(optimizedLoginPath);

    let result;
    if (comparisonResult.success && comparisonResult.isMatch) {
      console.log(
        `Face verification successful! Similarity: ${comparisonResult.similarity}%`
      );
      result = {
        success: true,
        similarity: comparisonResult.similarity,
        isMatch: true,
        message: `Face verification successful! Similarity: ${comparisonResult.similarity.toFixed(
          2
        )}%`,
        confidence:
          comparisonResult.similarity >= 90
            ? "HIGH"
            : comparisonResult.similarity >= 85
            ? "MEDIUM"
            : "LOW",
      };
    } else {
      console.log(
        `Face verification failed. Similarity: ${comparisonResult.similarity}%`
      );
      result = {
        success: false,
        similarity: comparisonResult.similarity,
        isMatch: false,
        message: `Face verification failed. Similarity: ${comparisonResult.similarity.toFixed(
          2
        )}%`,
        error: "LOW_SIMILARITY",
      };
    }

    // Cache the result
    faceComparisonCache.set(cacheKey, {
      result: result,
      timestamp: Date.now(),
    });

    return result;
  } catch (error) {
    console.error("Enhanced face comparison error:", error);
    return {
      success: false,
      similarity: 0,
      isMatch: false,
      message: "Face comparison process failed",
      error: error.message,
    };
  }
};

// Validate image quality for face recognition
const validateImageForFaceRecognition = (imagePath) => {
  try {
    const stats = fs.statSync(imagePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    // Check file size (should be between 10KB and 5MB)
    if (fileSizeInMB < 0.01 || fileSizeInMB > 5) {
      return {
        valid: false,
        message: "Image size should be between 10KB and 5MB",
        error: "INVALID_FILE_SIZE",
      };
    }

    // Check file extension
    const allowedExtensions = [".jpg", ".jpeg", ".png"];
    const fileExtension = path.extname(imagePath).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return {
        valid: false,
        message: "Only JPG, JPEG, and PNG images are supported",
        error: "INVALID_FILE_TYPE",
      };
    }

    return {
      valid: true,
      message: "Image validation passed",
      fileSize: fileSizeInMB.toFixed(2) + " MB",
      extension: fileExtension,
    };
  } catch (error) {
    console.error("Image validation error:", error);
    return {
      valid: false,
      message: "Image validation failed",
      error: error.message,
    };
  }
};

// Clean up temporary images
const cleanupTempImage = (imagePath) => {
  try {
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log("Temporary image cleaned up:", imagePath);
    }
  } catch (error) {
    console.error("Image cleanup error:", error);
  }
};

module.exports = {
  imageToBase64,
  base64ToBuffer,
  optimizeImageForFaceRecognition,
  enhancedFaceComparison,
  validateImageForFaceRecognition,
  cleanupTempImage,
};
