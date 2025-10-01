// 🧪 Test Advance Salary Role Fix
// This script tests if advance salary role fields are properly saved and retrieved

const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:5000";
const ADMIN_EMAIL = "admin@salon.com"; // Replace with actual admin email
const ADMIN_PASSWORD = "Admin123!"; // Replace with actual admin password

// Test functions
async function testAdvanceSalaryRoleFix() {
  console.log("🔔 Testing Advance Salary Role Fix\n");

  try {
    // Step 1: Admin login
    console.log("🔑 Step 1: Admin login...");
    const loginResponse = await axios.post(`${BASE_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (!loginResponse.data.token) {
      console.log("❌ Admin login failed");
      return;
    }

    console.log("✅ Admin login successful");
    const token = loginResponse.data.token;
    const adminInfo = loginResponse.data.admin;

    // Step 2: Create admin advance salary
    console.log("🔑 Step 2: Creating admin advance salary...");
    
    // Create a test image file (you might need to adjust this)
    const FormData = require('form-data');
    const fs = require('fs');
    
    // Create a simple test image file
    const testImagePath = './test-image.jpg';
    if (!fs.existsSync(testImagePath)) {
      console.log("⚠️ Test image not found, creating a dummy file...");
      fs.writeFileSync(testImagePath, 'dummy image content');
    }

    const formData = new FormData();
    formData.append('amount', '1000');
    formData.append('image', fs.createReadStream(testImagePath));

    const adminAdvanceSalaryResponse = await axios.post(
      `${BASE_URL}/admin-advance-salary/add`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      }
    );

    if (adminAdvanceSalaryResponse.data.message) {
      console.log("✅ Admin advance salary created successfully");
    } else {
      console.log("❌ Admin advance salary creation failed");
      console.log("Response:", adminAdvanceSalaryResponse.data);
    }

    // Step 3: Get all advance salary requests to verify roles
    console.log("\n🔑 Step 3: Retrieving all advance salary requests...");
    const allRequestsResponse = await axios.get(
      `${BASE_URL}/advance-salary/all`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (allRequestsResponse.data && Array.isArray(allRequestsResponse.data)) {
      console.log("✅ All advance salary requests retrieved successfully");
      const requests = allRequestsResponse.data;
      
      console.log(`📋 Total requests: ${requests.length}`);
      
      // Check role distribution
      const roleCounts = {};
      requests.forEach(request => {
        const role = request.role || 'Unknown';
        roleCounts[role] = (roleCounts[role] || 0) + 1;
      });
      
      console.log("📋 Role distribution:");
      Object.entries(roleCounts).forEach(([role, count]) => {
        console.log(`   ${role}: ${count} requests`);
      });
      
      // Check if admin requests show correct role
      const adminRequests = requests.filter(request => 
        request.role && request.role.toLowerCase().includes('admin')
      );
      
      if (adminRequests.length > 0) {
        console.log("🎉 SUCCESS: Admin advance salary requests show correct role!");
        console.log(`   Found ${adminRequests.length} admin requests`);
        
        // Show sample admin request
        const sampleRequest = adminRequests[0];
        console.log("\n📋 Sample admin request:");
        console.log(`   Employee: ${sampleRequest.employeeName}`);
        console.log(`   Role: ${sampleRequest.role}`);
        console.log(`   Amount: ${sampleRequest.amount}`);
      } else {
        console.log("❌ ISSUE: No admin requests found with correct role");
      }
      
      // Check for any requests with "Employee" role that should be "Admin"
      const incorrectAdminRequests = requests.filter(request => 
        request.role === 'Employee' && 
        (request.employeeName === 'Admin' || request.employeeName.includes('Admin'))
      );
      
      if (incorrectAdminRequests.length > 0) {
        console.log(`❌ ISSUE: Found ${incorrectAdminRequests.length} admin requests showing as 'Employee'`);
      } else {
        console.log("✅ No incorrect role assignments found");
      }
      
    } else {
      console.log("❌ Failed to retrieve advance salary requests");
    }

    // Clean up test file
    if (fs.existsSync(testImagePath)) {
      fs.unlinkSync(testImagePath);
    }

  } catch (error) {
    console.error("❌ Test failed:", error.response?.data || error.message);
  }
}

// Run the test
testAdvanceSalaryRoleFix();
