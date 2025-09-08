const { compareFaces, detectFaces } = require("../config/aws");
const fs = require("fs");
const axios = require("axios");

class FaceService {
  // Validate single face in image
  async validateFaceImage(imagePath) {
    try {
      const imageBuffer = fs.readFileSync(imagePath);
      const detection = await detectFaces(imageBuffer);

      if (!detection.success || detection.faceCount === 0) {
        return { valid: false, message: "No face detected in image" };
      }

      if (detection.faceCount > 1) {
        return {
          valid: false,
          message: "Multiple faces detected. Use image with single face.",
        };
      }

      return { valid: true, message: "Face validation successful" };
    } catch (error) {
      return { valid: false, message: "Face validation failed" };
    }
  }

  // Find user by comparing face
  async findUserByFace(loginImagePath) {
    const User = require("../models/User");

    try {
      // Get all users with face authentication
      const users = await User.find({
        faceRegistered: true,
        faceImageUrl: { $exists: true, $ne: "" },
      });

      const loginImageBuffer = fs.readFileSync(loginImagePath);
      let bestMatch = null;
      let highestSimilarity = 0;

      // Compare with each registered face
      for (const user of users) {
        try {
          // Download stored image from Cloudinary
          const response = await axios.get(user.faceImageUrl, {
            responseType: "arraybuffer",
          });
          const storedImageBuffer = Buffer.from(response.data);

          // Compare faces
          const comparison = await compareFaces(
            storedImageBuffer,
            loginImageBuffer
          );

          if (
            comparison.success &&
            comparison.isMatch &&
            comparison.similarity > highestSimilarity
          ) {
            bestMatch = user;
            highestSimilarity = comparison.similarity;
          }
        } catch (error) {
          console.log(
            `Error comparing with user ${user.username}:`,
            error.message
          );
          continue;
        }
      }

      if (bestMatch) {
        return {
          success: true,
          user: bestMatch,
          similarity: highestSimilarity,
        };
      } else {
        return {
          success: false,
          message: "No matching face found",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Face recognition failed",
      };
    }
  }
}

module.exports = new FaceService();
