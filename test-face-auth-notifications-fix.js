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
  type: "general",
  recipientType: "admin",
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
    console.log("🔑 Step 2: Testing face auth login simulation...");
    
    // First, get admin ID from regular login
    const adminId = regularLoginResponse.data.admin.id;
    console.log("🔍 Using admin ID:", adminId);

    // Simulate face auth login
    const faceAuthResponse = await axios.post(`${BASE_URL}/auth/admin-face-login`, {
      adminId: adminId,
      name: "Admin User",
      faceVerified: true,
    });

    if (faceAuthResponse.data.success && faceAuthResponse.data.data.token) {
      console.log("✅ Face auth login successful");
      const faceToken = faceAuthResponse.data.data.token;

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

      // Compare results
      console.log("\n📊 Comparison Results:");
      console.log(`   Regular login notifications: ${regularNotificationsResponse.data.data.notifications.length}`);
      console.log(`   Face auth notifications: ${faceNotificationsResponse.data.data.notifications.length}`);
      
      if (faceNotificationsResponse.data.data.notifications.length > 0) {
        console.log("🎉 SUCCESS: Face auth admin can receive notifications!");
      } else {
        console.log("❌ ISSUE: Face auth admin cannot receive notifications");
      }

    } else {
      console.log("❌ Face auth login failed");
      console.log("Response:", faceAuthResponse.data);
    }

  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Run the test
testFaceAuthNotifications();
