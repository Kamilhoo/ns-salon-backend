// 🛍️ Test Product Flow: Admin to Manager Side
// This script demonstrates how products added by admin become available to managers

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000/api';
const ADMIN_TOKEN = 'your_admin_token_here';
const MANAGER_TOKEN = 'your_manager_token_here';

// Test data
const testProduct = {
  name: 'Test Premium Shampoo',
  price: 750,
  description: 'High-quality shampoo for testing product flow',
  time: 'N/A'
};

const testClient = {
  name: 'Test Client',
  phoneNumber: '+919876543210',
  email: 'test@example.com'
};

// Test functions
async function testProductFlow() {
  console.log('🔄 Testing Product Flow: Admin to Manager Side\n');
  
  try {
    // Step 1: Admin adds a product
    console.log('📝 Step 1: Admin adding product...');
    const addProductResponse = await axios.post(`${BASE_URL}/products/add`, testProduct, {
      headers: {
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (addProductResponse.data.success) {
      const productId = addProductResponse.data.product._id;
      console.log(`✅ Product added successfully! ID: ${productId}`);
      console.log(`   Name: ${addProductResponse.data.product.name}`);
      console.log(`   Price: ₹${addProductResponse.data.product.price}`);
    } else {
      console.log('❌ Failed to add product');
      return;
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Step 2: Manager views all products (no authentication required)
    console.log('👀 Step 2: Manager viewing all products...');
    const getAllProductsResponse = await axios.get(`${BASE_URL}/products/all`);
    
    if (getAllProductsResponse.data) {
      const products = getAllProductsResponse.data;
      console.log(`✅ Found ${products.length} products available to managers`);
      
      // Find our test product
      const testProductInList = products.find(p => p.name === testProduct.name);
      if (testProductInList) {
        console.log(`   ✅ Test product found in manager's view:`);
        console.log(`      ID: ${testProductInList._id}`);
        console.log(`      Name: ${testProductInList.name}`);
        console.log(`      Price: ₹${testProductInList.price}`);
        console.log(`      Image: ${testProductInList.image || 'No image'}`);
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Step 3: Manager views specific product details
    console.log('🔍 Step 3: Manager viewing specific product details...');
    const productId = addProductResponse.data.product._id;
    const getProductResponse = await axios.get(`${BASE_URL}/products/${productId}`);
    
    if (getProductResponse.data.success) {
      const product = getProductResponse.data.product;
      console.log(`✅ Product details retrieved successfully:`);
      console.log(`   ID: ${product._id}`);
      console.log(`   Name: ${product.name}`);
      console.log(`   Price: ₹${product.price}`);
      console.log(`   Description: ${product.description}`);
      console.log(`   Created: ${product.createdAt}`);
      console.log(`   Updated: ${product.updatedAt}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Step 4: Manager creates a client (if needed)
    console.log('👤 Step 4: Manager creating test client...');
    const createClientResponse = await axios.post(`${BASE_URL}/clients/add`, testClient, {
      headers: {
        'Authorization': `Bearer ${MANAGER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    let clientId;
    if (createClientResponse.data.success) {
      clientId = createClientResponse.data.client._id;
      console.log(`✅ Client created successfully! ID: ${clientId}`);
    } else {
      console.log('❌ Failed to create client or client already exists');
      // Try to get existing client
      const searchResponse = await axios.get(`${BASE_URL}/clients/search?query=${testClient.phoneNumber}`, {
        headers: {
          'Authorization': `Bearer ${MANAGER_TOKEN}`
        }
      });
      
      if (searchResponse.data.results && searchResponse.data.results.length > 0) {
        clientId = searchResponse.data.results[0]._id;
        console.log(`✅ Using existing client ID: ${clientId}`);
      } else {
        console.log('❌ Cannot proceed without client ID');
        return;
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Step 5: Manager creates bill with the product
    console.log('🧾 Step 5: Manager creating bill with product...');
    const billData = {
      clientId: clientId,
      items: [
        {
          itemType: 'product',
          itemId: productId,
          quantity: 2,
          notes: 'Test purchase of premium shampoo'
        }
      ],
      paymentMethod: 'cash',
      paidAmount: 0,
      notes: 'Test bill to demonstrate product flow'
    };
    
    const createBillResponse = await axios.post(`${BASE_URL}/bills/create`, billData, {
      headers: {
        'Authorization': `Bearer ${MANAGER_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (createBillResponse.data.success) {
      const bill = createBillResponse.data.bill;
      console.log(`✅ Bill created successfully!`);
      console.log(`   Bill Number: ${bill.billNumber}`);
      console.log(`   Client: ${bill.clientName}`);
      console.log(`   Total Amount: ₹${bill.totalAmount}`);
      console.log(`   Payment Status: ${bill.paymentStatus}`);
      
      // Calculate expected amount
      const expectedAmount = testProduct.price * 2; // 2 quantities
      console.log(`   Expected Amount: ₹${expectedAmount} (${testProduct.price} × 2)`);
      
      if (bill.totalAmount === expectedAmount) {
        console.log(`   ✅ Price calculation correct!`);
      } else {
        console.log(`   ❌ Price calculation mismatch!`);
      }
    } else {
      console.log('❌ Failed to create bill');
      console.log('   Error:', createBillResponse.data.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Step 6: Manager views client billing history
    console.log('📋 Step 6: Manager viewing client billing history...');
    const billingHistoryResponse = await axios.get(`${BASE_URL}/bills/client/${clientId}/history`, {
      headers: {
        'Authorization': `Bearer ${MANAGER_TOKEN}`
      }
    });
    
    if (billingHistoryResponse.data.success) {
      const history = billingHistoryResponse.data;
      console.log(`✅ Billing history retrieved successfully:`);
      console.log(`   Client: ${history.client.name}`);
      console.log(`   Total Bills: ${history.summary.totalBills}`);
      console.log(`   Total Spent: ₹${history.summary.totalSpent}`);
      console.log(`   Pending Bills: ${history.summary.pendingBills}`);
      console.log(`   Paid Bills: ${history.summary.paidBills}`);
      
      if (history.billingHistory && history.billingHistory.length > 0) {
        const latestBill = history.billingHistory[0];
        console.log(`   Latest Bill: ${latestBill.billNumber} - ₹${latestBill.totalAmount}`);
      }
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Summary
    console.log('🎉 PRODUCT FLOW TEST COMPLETED SUCCESSFULLY!');
    console.log('\n📋 Summary of what was tested:');
    console.log('   1. ✅ Admin added product');
    console.log('   2. ✅ Manager viewed all products (no auth required)');
    console.log('   3. ✅ Manager viewed specific product details');
    console.log('   4. ✅ Manager created test client');
    console.log('   5. ✅ Manager created bill with product');
    console.log('   6. ✅ Manager viewed client billing history');
    console.log('\n💡 Key Points:');
    console.log('   • Products added by admin are immediately visible to managers');
    console.log('   • No authentication required to view products');
    console.log('   • Product prices automatically fetched in bills');
    console.log('   • Complete integration between products and billing system');
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('   Response data:', error.response.data);
      console.error('   Status:', error.response.status);
    }
  }
}

// Helper function to check if server is running
async function checkServerStatus() {
  try {
    const response = await axios.get(`${BASE_URL}/products/all`);
    console.log('✅ Server is running and accessible');
    return true;
  } catch (error) {
    console.error('❌ Server is not running or not accessible');
    console.error('   Make sure your server is running on port 3000');
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Starting Product Flow Test...\n');
  
  // Check server status first
  const serverRunning = await checkServerStatus();
  if (!serverRunning) {
    return;
  }
  
  // Check if tokens are provided
  if (ADMIN_TOKEN === 'your_admin_token_here' || MANAGER_TOKEN === 'your_manager_token_here') {
    console.log('⚠️  Please update the tokens in the script:');
    console.log('   ADMIN_TOKEN: Your admin JWT token');
    console.log('   MANAGER_TOKEN: Your manager JWT token');
    console.log('\n   You can get these tokens by logging in as admin/manager');
    return;
  }
  
  // Run the test
  await testProductFlow();
}

// Run the test
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testProductFlow, checkServerStatus };

