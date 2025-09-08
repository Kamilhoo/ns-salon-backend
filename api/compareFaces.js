const express = require("express");
const multer = require("multer");
const axios = require("axios");
const AWS = require("aws-sdk");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// AWS Rekognition Config
const rekognition = new AWS.Rekognition({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

/**
 * POST /api/employees/compare-faces
 * Body: sourceImage (file), targetImageUrl (string)
 */
router.post(
  "/compare-faces",
  upload.single("sourceImage"),
  async (req, res) => {
    try {
      if (!req.file || !req.body.targetImageUrl) {
        return res.status(400).json({ error: "Missing required fields." });
      }

      // Fetch target image from URL (Cloudinary / S3)
      const targetResponse = await axios.get(req.body.targetImageUrl, {
        responseType: "arraybuffer",
      });

      const params = {
        SourceImage: {
          Bytes: req.file.buffer, // file from camera
        },
        TargetImage: {
          Bytes: Buffer.from(targetResponse.data, "binary"), // stored manager face
        },
        SimilarityThreshold: 80, // minimum confidence
      };

      try {
        const data = await rekognition.compareFaces(params).promise();

        if (data.FaceMatches && data.FaceMatches.length > 0) {
          const match = data.FaceMatches[0];
          return res.json({
            match: true,
            confidence: match.Similarity,
          });
        } else {
          return res.json({
            match: false,
            confidence: 0,
          });
        }
      } catch (err) {
        console.error("Rekognition error:", err);
        return res.status(500).json({ error: "Face comparison failed." });
      }
    } catch (error) {
      console.error("CompareFaces API Error:", error);
      return res.status(500).json({ error: "Something went wrong." });
    }
  }
);

module.exports = router;
