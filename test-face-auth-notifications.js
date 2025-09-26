// 🧪 Test Face Auth Notifications Fix
// This script tests if face-authenticated admins can receive notifications

const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:5000";
const ADMIN_EMAIL = "admin@salon.com"; // Replace with actual admin email
const ADMIN_PASSWORD = "Admin123!"; // Replace with actual admin password

// Test data
const testNotification = {
  title: "Test Notification for Face Auth Admin",
  message: "This notification should be visible to face-authenticated admins",
  type: "test",
  recipientId: null, // Will be set after getting admin ID
};

// Test functions
async function testFaceAuthNotifications() {
  console.log("🔔 Testing Face Auth Notifications Fix\n");

  try {
    // Step 1: Regular admin login (credential-based)
    console.log("🔑 Step 1: Testing regular admin login...");
    const regularLoginResponse = await axios.post(`${BASE_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (regularLoginResponse.data.token) {
      console.log("✅ Regular admin login successful");
      const regularToken = regularLoginResponse.data.token;
      const regularAdminId = regularLoginResponse.data.admin.id;

      // Test notifications with regular login
      console.log("🔔 Testing notifications with regular login...");
      const regularNotificationsResponse = await axios.get(
        `${BASE_URL}/notifications`,
        {
          headers: {
            Authorization: `Bearer ${regularToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("✅ Regular login notifications retrieved successfully");
      console.log(
        `   Notifications count: ${regularNotificationsResponse.data.data.notifications.length}`
      );
    } else {
      console.log("❌ Regular admin login failed");
      return;
    }

    console.log("\n" + "=".repeat(50) + "\n");

    // Step 2: Face auth login simulation
    console.log("🔑 Step 2: Testing face auth login...");

    // First, get admin details for face login
    const adminDetailsResponse = await axios.get(`${BASE_URL}/admin/all`, {
      headers: {
        Authorization: `Bearer ${regularLoginResponse.data.token}`,
        "Content-Type": "application/json",
      },
    });

    if (
      adminDetailsResponse.data.admins &&
      adminDetailsResponse.data.admins.length > 0
    ) {
      const admin = adminDetailsResponse.data.admins[0];
      console.log(`✅ Found admin: ${admin.name} (ID: ${admin._id})`);

      // Simulate face login
      const faceLoginResponse = await axios.post(
        `${BASE_URL}/auth/face-login`,
        {
          adminId: admin._id,
          name: admin.name,
          faceVerified: true,
        }
      );

      if (faceLoginResponse.data.success && faceLoginResponse.data.data.token) {
        console.log("✅ Face auth login successful");
        const faceToken = faceLoginResponse.data.data.token;

        // Test notifications with face auth
        console.log("🔔 Testing notifications with face auth...");
        const faceNotificationsResponse = await axios.get(
          `${BASE_URL}/notifications`,
          {
            headers: {
              Authorization: `Bearer ${faceToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("✅ Face auth notifications retrieved successfully");
        console.log(
          `   Notifications count: ${faceNotificationsResponse.data.data.notifications.length}`
        );

        // Compare the results
        console.log("\n" + "=".repeat(50) + "\n");
        console.log("📊 COMPARISON RESULTS:");
        console.log(
          `   Regular Login Notifications: ${regularNotificationsResponse.data.data.notifications.length}`
        );
        console.log(
          `   Face Auth Notifications: ${faceNotificationsResponse.data.data.notifications.length}`
        );

        if (faceNotificationsResponse.data.data.notifications.length > 0) {
          console.log(
            "🎉 SUCCESS: Face auth admins can receive notifications!"
          );
        } else {
          console.log(
            "⚠️  WARNING: Face auth admins may not be receiving notifications"
          );
        }
      } else {
        console.log("❌ Face auth login failed");
        console.log("Response:", faceLoginResponse.data);
      }
    } else {
      console.log("❌ No admins found for face login test");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

async function checkServerStatus() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log("✅ Server is running");
    return true;
  } catch (error) {
    console.log("❌ Server is not running. Please start the server first.");
    return false;
  }
}

// Main execution
async function main() {
  console.log("🚀 Starting Face Auth Notifications Test...\n");

  // Check server status first
  const serverRunning = await checkServerStatus();
  if (!serverRunning) {
    return;
  }

  // Check if admin credentials are provided
  if (ADMIN_EMAIL === "admin@salon.com" || ADMIN_PASSWORD === "Admin123!") {
    console.log("⚠️  Please update the admin credentials in the script:");
    console.log("   ADMIN_EMAIL: Your admin email");
    console.log("   ADMIN_PASSWORD: Your admin password");
    console.log("\n   You can get these from your admin registration");
    return;
  }

  // Run the test
  await testFaceAuthNotifications();
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}
