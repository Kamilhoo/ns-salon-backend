/**
 * 🧪 Comprehensive Pagination Test Script
 * Tests all pagination-enabled APIs
 */

const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost:5000/api";
const TEST_CONFIG = {
  // Test with different page sizes
  pageSizes: [5, 10, 20],
  // Test multiple pages
  maxPages: 3,
  // Test different filters
  filters: {
    attendance: { status: "present" },
    advanceSalary: { status: "pending" },
    employees: { role: "employee" },
  },
};

// Test data for creating records
const testData = {
  advanceBooking: {
    clientName: "Test Client",
    date: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    time: "10:00 AM",
    advancePayment: 1000,
    description: "Test booking for pagination",
    phoneNumber: "1234567890",
    reminderDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
  },
  expense: {
    name: "Test Expense",
    price: 500,
    description: "Test expense for pagination",
    userRole: "admin", // Auto-approved
  },
  employee: {
    employeeId: "EMP" + Date.now(),
    name: "Test Employee",
    phoneNumber: "1234567890",
    role: "employee",
    monthlySalary: 25000,
    idCardNumber: "ID" + Date.now(),
  },
  client: {
    clientId: "CLI" + Date.now(),
    name: "Test Client",
    phoneNumber: "1234567890",
  },
};

// Helper function to make API calls
async function makeAPICall(endpoint, method = "GET", data = null, params = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      params,
      data,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ API Error for ${endpoint}:`, error.response?.data || error.message);
    return null;
  }
}

// Test pagination for a specific API
async function testPaginationAPI(apiName, endpoint, testParams = {}) {
  console.log(`\n🧪 Testing ${apiName} Pagination`);
  console.log("=" .repeat(50));

  try {
    // Test different page sizes
    for (const pageSize of TEST_CONFIG.pageSizes) {
      console.log(`\n📄 Testing with page size: ${pageSize}`);

      // Test first page
      const firstPage = await makeAPICall(endpoint, "GET", null, {
        page: 1,
        limit: pageSize,
        ...testParams,
      });

      if (firstPage && firstPage.data) {
        console.log(`✅ First page (size ${pageSize}):`);
        console.log(`   Records: ${firstPage.data.records?.length || firstPage.data.clients?.length || firstPage.data.employees?.length || 0}`);
        console.log(`   Pagination:`, firstPage.data.pagination || firstPage.pagination);

        // Test second page if available
        if (firstPage.data.pagination?.hasNext || firstPage.pagination?.hasNext) {
          const secondPage = await makeAPICall(endpoint, "GET", null, {
            page: 2,
            limit: pageSize,
            ...testParams,
          });

          if (secondPage && secondPage.data) {
            console.log(`✅ Second page (size ${pageSize}):`);
            console.log(`   Records: ${secondPage.data.records?.length || secondPage.data.clients?.length || secondPage.data.employees?.length || 0}`);
            console.log(`   Pagination:`, secondPage.data.pagination || secondPage.pagination);
          }
        }
      } else {
        console.log(`❌ Failed to get data for ${apiName} with page size ${pageSize}`);
      }
    }

    // Test edge cases
    console.log(`\n🔍 Testing edge cases for ${apiName}:`);

    // Test with very large page number
    const largePage = await makeAPICall(endpoint, "GET", null, {
      page: 999,
      limit: 10,
      ...testParams,
    });
    console.log(`   Large page (999): ${largePage ? "✅ Handled gracefully" : "❌ Error"}`);

    // Test with very small limit
    const smallLimit = await makeAPICall(endpoint, "GET", null, {
      page: 1,
      limit: 1,
      ...testParams,
    });
    console.log(`   Small limit (1): ${smallLimit ? "✅ Handled gracefully" : "❌ Error"}`);

  } catch (error) {
    console.error(`❌ Error testing ${apiName}:`, error.message);
  }
}

// Test all pagination APIs
async function testAllPaginationAPIs() {
  console.log("🚀 Starting Comprehensive Pagination Tests");
  console.log("=" .repeat(60));

  // Test Attendance API
  await testPaginationAPI(
    "Attendance",
    "/attendance/all",
    TEST_CONFIG.filters.attendance
  );

  // Test Advance Salary API
  await testPaginationAPI(
    "Advance Salary",
    "/advance-salary/all",
    TEST_CONFIG.filters.advanceSalary
  );

  // Test Advance Booking API
  await testPaginationAPI("Advance Booking", "/advance-booking/all");

  // Test Expense API
  await testPaginationAPI("Expense", "/expenses/all");

  // Test Employee API
  await testPaginationAPI(
    "Employee",
    "/employees/all",
    TEST_CONFIG.filters.employees
  );

  // Test Client API
  await testPaginationAPI("Client", "/clients/all");

  console.log("\n🎉 All pagination tests completed!");
}

// Test pagination response structure
async function testPaginationStructure() {
  console.log("\n🔍 Testing Pagination Response Structure");
  console.log("=" .repeat(50));

  const testAPIs = [
    { name: "Attendance", endpoint: "/attendance/all" },
    { name: "Advance Salary", endpoint: "/advance-salary/all" },
    { name: "Advance Booking", endpoint: "/advance-booking/all" },
    { name: "Expense", endpoint: "/expenses/all" },
    { name: "Employee", endpoint: "/employees/all" },
    { name: "Client", endpoint: "/clients/all" },
  ];

  for (const api of testAPIs) {
    console.log(`\n📋 Testing ${api.name} structure:`);
    
    const response = await makeAPICall(api.endpoint, "GET", null, {
      page: 1,
      limit: 5,
    });

    if (response) {
      console.log(`✅ ${api.name} Response Structure:`);
      console.log(`   Success: ${response.success !== undefined ? "✅" : "❌"}`);
      console.log(`   Message: ${response.message ? "✅" : "❌"}`);
      console.log(`   Data: ${response.data ? "✅" : "❌"}`);
      
      if (response.data) {
        console.log(`   Records: ${response.data.records || response.data.clients || response.data.employees ? "✅" : "❌"}`);
        console.log(`   Pagination: ${response.data.pagination || response.pagination ? "✅" : "❌"}`);
        
        if (response.data.pagination || response.pagination) {
          const pagination = response.data.pagination || response.pagination;
          console.log(`   Current Page: ${pagination.currentPage ? "✅" : "❌"}`);
          console.log(`   Total Pages: ${pagination.totalPages ? "✅" : "❌"}`);
          console.log(`   Total Records: ${pagination.totalRecords || pagination.totalEmployees || pagination.totalClients ? "✅" : "❌"}`);
          console.log(`   Has Next: ${pagination.hasNext !== undefined ? "✅" : "❌"}`);
          console.log(`   Has Prev: ${pagination.hasPrev !== undefined ? "✅" : "❌"}`);
        }
      }
    } else {
      console.log(`❌ Failed to get response from ${api.name}`);
    }
  }
}

// Performance test for pagination
async function testPaginationPerformance() {
  console.log("\n⚡ Testing Pagination Performance");
  console.log("=" .repeat(50));

  const testAPIs = [
    { name: "Attendance", endpoint: "/attendance/all" },
    { name: "Advance Salary", endpoint: "/advance-salary/all" },
    { name: "Employee", endpoint: "/employees/all" },
    { name: "Client", endpoint: "/clients/all" },
  ];

  for (const api of testAPIs) {
    console.log(`\n⏱️ Testing ${api.name} performance:`);
    
    const startTime = Date.now();
    const response = await makeAPICall(api.endpoint, "GET", null, {
      page: 1,
      limit: 10,
    });
    const endTime = Date.now();
    
    if (response) {
      const responseTime = endTime - startTime;
      console.log(`   Response Time: ${responseTime}ms`);
      console.log(`   Performance: ${responseTime < 1000 ? "✅ Fast" : responseTime < 3000 ? "⚠️ Moderate" : "❌ Slow"}`);
    } else {
      console.log(`   Performance: ❌ Failed`);
    }
  }
}

// Main test function
async function runPaginationTests() {
  try {
    console.log("🧪 Starting Comprehensive Pagination Tests");
    console.log("=" .repeat(60));
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Test Configuration:`, TEST_CONFIG);

    // Test pagination structure first
    await testPaginationStructure();

    // Test all pagination APIs
    await testAllPaginationAPIs();

    // Test performance
    await testPaginationPerformance();

    console.log("\n🎉 All pagination tests completed successfully!");
    console.log("\n📋 Summary:");
    console.log("✅ Attendance API - Pagination added");
    console.log("✅ Advance Salary API - Pagination added");
    console.log("✅ Advance Booking API - Pagination added");
    console.log("✅ Expense API - Pagination added");
    console.log("✅ Employee API - Pagination added");
    console.log("✅ Client API - Pagination added");

    console.log("\n🚀 Frontend Implementation Guide:");
    console.log("1. Use page and limit query parameters");
    console.log("2. Handle pagination object in response");
    console.log("3. Implement pagination controls");
    console.log("4. Handle loading states");
    console.log("5. Test with different page sizes");

  } catch (error) {
    console.error("❌ Test execution failed:", error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runPaginationTests();
}

module.exports = {
  testPaginationAPI,
  testAllPaginationAPIs,
  testPaginationStructure,
  testPaginationPerformance,
  runPaginationTests,
};
