// 🧪 Test Client Bill History Fix
// This script tests if client bill history shows complete bill information including notes, beautician, GST, and discount

const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:5000";
const TEST_CLIENT_PHONE = "+923001234567"; // Replace with test client phone
const ADMIN_EMAIL = "admin@salon.com"; // Replace with actual admin email
const ADMIN_PASSWORD = "Admin123!"; // Replace with actual admin password

// Test bill data
const testBillData = {
  clientName: "Test Client for History",
  clientPhone: TEST_CLIENT_PHONE,
  selectedServices: [
    {
      name: "Premium Haircut",
      price: 1000,
      duration: "30 minutes",
      description: "Professional haircut service",
    },
    {
      name: "Hair Styling",
      price: 500,
      duration: "20 minutes",
      description: "Hair styling service",
    },
  ],
  discount: 50,
  paymentMethod: "cash",
  notes: "Customer prefers short hair. Used special shampoo.",
  appointmentDate: new Date().toISOString(),
  startTime: "2:30 PM",
  specialist: "Ali Khan", // beautician name
  totalDuration: "50 minutes",
};

// Test functions
async function testClientBillHistory() {
  console.log("🧾 Testing Client Bill History Fix\n");

  try {
    // Step 1: Admin login to get token
    console.log("🔑 Step 1: Admin login...");
    const loginResponse = await axios.post(`${BASE_URL}/admin/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (!loginResponse.data.token) {
      console.log("❌ Admin login failed");
      return;
    }

    const token = loginResponse.data.token;
    console.log("✅ Admin login successful");

    // Step 2: Create a test bill with complete information
    console.log("\n🧾 Step 2: Creating test bill with complete information...");
    const billResponse = await axios.post(
      `${BASE_URL}/bills/create-from-services`,
      testBillData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (billResponse.data.success) {
      const bill = billResponse.data.bill;
      const clientId = bill.clientId;
      console.log("✅ Test bill created successfully");
      console.log(`   Bill Number: ${bill.billNumber}`);
      console.log(`   Client ID: ${clientId}`);
      console.log(`   Total Amount: PKR ${bill.finalAmount}`);
      console.log(`   Notes: "${bill.notes}"`);
      console.log(`   Specialist: "${bill.specialist}"`);
      console.log(`   Discount: PKR ${bill.discount}`);
      console.log(`   GST Amount: PKR ${bill.gstAmount}`);

      // Step 3: Get client history to verify complete data
      console.log("\n📋 Step 3: Fetching client history...");
      const historyResponse = await axios.get(
        `${BASE_URL}/clients/${clientId}/history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (historyResponse.data.success) {
        const client = historyResponse.data.client;
        const visits = client.visits;

        console.log("✅ Client history retrieved successfully");
        console.log(`   Client Name: ${client.name}`);
        console.log(`   Total Visits: ${client.totalVisits}`);
        console.log(`   Total Spent: PKR ${client.totalSpent}`);
        console.log(`   Number of visits in history: ${visits.length}`);

        if (visits.length > 0) {
          const latestVisit = visits[0]; // Most recent visit
          console.log("\n📊 LATEST VISIT DETAILS:");
          console.log(`   Visit ID: ${latestVisit.visitId}`);
          console.log(
            `   Date: ${new Date(latestVisit.date).toLocaleDateString()}`
          );
          console.log(`   Bill Number: ${latestVisit.billNumber}`);
          console.log(
            `   Services: ${latestVisit.services.map((s) => s.name).join(", ")}`
          );
          console.log(`   Subtotal: PKR ${latestVisit.subtotal}`);
          console.log(`   Discount: PKR ${latestVisit.discount}`);
          console.log(`   GST Amount: PKR ${latestVisit.gstAmount}`);
          console.log(`   GST Percentage: ${latestVisit.gstPercentage}%`);
          console.log(`   Final Amount: PKR ${latestVisit.finalAmount}`);
          console.log(`   Notes: "${latestVisit.notes}"`);
          console.log(`   Specialist/Beautician: "${latestVisit.specialist}"`);
          console.log(`   Payment Method: ${latestVisit.paymentMethod}`);
          console.log(`   Payment Status: ${latestVisit.paymentStatus}`);

          // Verification checks
          console.log("\n🔍 VERIFICATION RESULTS:");

          const checksResults = {
            notes: latestVisit.notes && latestVisit.notes.length > 0,
            specialist:
              latestVisit.specialist && latestVisit.specialist.length > 0,
            gstAmount:
              latestVisit.gstAmount !== undefined && latestVisit.gstAmount >= 0,
            gstPercentage: latestVisit.gstPercentage !== undefined,
            discount:
              latestVisit.discount !== undefined && latestVisit.discount >= 0,
            paymentMethod: latestVisit.paymentMethod !== undefined,
            appointmentDetails:
              latestVisit.startTime !== undefined ||
              latestVisit.appointmentDate !== undefined,
          };

          console.log(
            `   ✅ Notes included: ${checksResults.notes ? "YES" : "NO"}`
          );
          console.log(
            `   ✅ Specialist/Beautician included: ${
              checksResults.specialist ? "YES" : "NO"
            }`
          );
          console.log(
            `   ✅ GST Amount included: ${
              checksResults.gstAmount ? "YES" : "NO"
            }`
          );
          console.log(
            `   ✅ GST Percentage included: ${
              checksResults.gstPercentage ? "YES" : "NO"
            }`
          );
          console.log(
            `   ✅ Discount included: ${checksResults.discount ? "YES" : "NO"}`
          );
          console.log(
            `   ✅ Payment Method included: ${
              checksResults.paymentMethod ? "YES" : "NO"
            }`
          );
          console.log(
            `   ✅ Appointment Details: ${
              checksResults.appointmentDetails ? "YES" : "NO"
            }`
          );

          // Overall result
          const allFieldsPresent = Object.values(checksResults).every(
            (check) => check === true
          );

          if (allFieldsPresent) {
            console.log(
              "\n🎉 SUCCESS: All missing fields are now included in client bill history!"
            );
            console.log("   ✅ Notes: Present");
            console.log("   ✅ Beautician/Specialist: Present");
            console.log("   ✅ GST Information: Present");
            console.log("   ✅ Discount: Present");
            console.log("   ✅ Payment Method: Present");
          } else {
            console.log(
              "\n⚠️  PARTIAL SUCCESS: Some fields may still be missing"
            );
            console.log("   Please check the verification results above");
          }
        } else {
          console.log("⚠️  No visits found in client history");
        }
      } else {
        console.log("❌ Failed to retrieve client history");
        console.log("Response:", historyResponse.data);
      }
    } else {
      console.log("❌ Failed to create test bill");
      console.log("Response:", billResponse.data);
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
  console.log("🚀 Starting Client Bill History Test...\n");

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
    console.log("   TEST_CLIENT_PHONE: Your test client phone number");
    console.log("\n   You can get these from your admin registration");
    return;
  }

  // Run the test
  await testClientBillHistory();
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}
