# 🚀 Salon Backend Postman Collection Testing Guide

## 📥 **Import Kaise Karin:**

### **Step 1: Postman mein Import**
1. **Postman** open karo
2. **Import** button click karo (top left)
3. **File** tab select karo
4. `Salon-Backend-Postman-Collection.json` file select karo
5. **Import** click karo

### **Step 2: Environment Variables Set Karo**
Collection import ke baad ye variables set karo:

```javascript
// Collection Variables (⚙️ Settings icon → Variables tab)
base_url: http://localhost:5000        // Ya aapka server URL
auth_token: (login ke baad yahan token paste karo)
```

---

## 🧪 **Testing Sequence (Step by Step):**

### **Phase 1: Basic Setup & Authentication**

#### **1️⃣ Health Check**
```
GET {{base_url}}/health
```
**Expected Response:** Status OK

#### **2️⃣ User Registration & Login**
```
POST {{base_url}}/auth/register
POST {{base_url}}/auth/login
```
**⚠️ Important:** Login response mein token copy kar ke `auth_token` variable mein paste karo

---

### **Phase 2: Admin Registration Testing (Updated Features)**

#### **3️⃣ Admin Registration - Complete (All Fields)**
```
POST {{base_url}}/admin/add
Form Data:
✅ name: "Test Admin 1"
✅ email: "admin1@salon.com"
✅ password: "Admin123!"  // Strong password: min 8 chars, uppercase, number/special
✅ confirmPassword: "Admin123!"
✅ phoneNumber: "03001234567"
✅ livePicture: [Upload Image File]
```

**Password Requirements (Shown in Response):**
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one number (0-9) OR special character (!@#$%^&* etc.)

#### **4️⃣ Test Missing Email (Should Fail)**
```
POST {{base_url}}/admin/add
Form Data:
✅ name: "Test Admin 2"
❌ email: (Skip this field) 
✅ password: "admin456"
✅ confirmPassword: "admin456"
✅ phoneNumber: "03001234568"
```
**Expected:** ❌ Error: "Email is required"

#### **5️⃣ Test Missing Password (Should Fail)**
```
POST {{base_url}}/admin/add
Form Data:
✅ name: "Test Admin 3"
✅ email: "admin3@salon.com"
❌ password: (Skip this field)
❌ confirmPassword: (Skip this field)
✅ phoneNumber: "03001234569"
```
**Expected:** ❌ Error: "Password is required"

#### **6️⃣ Test Email Duplicate Validation**
```
POST {{base_url}}/admin/add
Form Data:
✅ name: "Duplicate Test"
✅ email: "admin1@salon.com"  // Same as first admin
✅ password: "test123"
✅ confirmPassword: "test123"
✅ phoneNumber: "03001234570"
```
**Expected:** ❌ Error: "Email already registered"

#### **7️⃣ Test Weak Password (Should Fail)**
```
POST {{base_url}}/admin/add
Form Data:
✅ name: "Weak Password Test"
✅ email: "weakpass@salon.com"
✅ password: "weak123"  // Missing uppercase
✅ confirmPassword: "weak123"
✅ phoneNumber: "03001234571"
```
**Expected:** ❌ Error: "Password does not meet requirements"

#### **8️⃣ Test Short Password (Should Fail)**
```
POST {{base_url}}/admin/add
Form Data:
✅ name: "Short Password Test"
✅ email: "shortpass@salon.com"
✅ password: "Ab1!"  // Only 4 characters
✅ confirmPassword: "Ab1!"
✅ phoneNumber: "03001234572"
```
**Expected:** ❌ Error: "Password must be at least 8 characters long"

#### **9️⃣ Test Password Mismatch**
```
POST {{base_url}}/admin/add
Form Data:
✅ name: "Password Mismatch Test"
✅ email: "mismatch@salon.com"
✅ password: "StrongPass123!"
✅ confirmPassword: "DifferentPass456@"  // Different password
✅ phoneNumber: "03001234573"
```
**Expected:** ❌ Error: "Password and confirm password do not match"

#### **🔟 Get All Admins**
```
GET {{base_url}}/admin/all
```
**Expected:** List of all registered admins

---

### **Phase 3: Complete System Testing**

#### **9️⃣ Employee Management**
```
POST {{base_url}}/employee/add
GET {{base_url}}/employee/all
```

#### **🔟 Client Management**
```
POST {{base_url}}/client/add
GET {{base_url}}/client/all
GET {{base_url}}/client/search?query=client_name
```

#### **1️⃣1️⃣ Services & Products**
```
POST {{base_url}}/service/add
GET {{base_url}}/service/all
POST {{base_url}}/product/add
GET {{base_url}}/product/all
```

#### **1️⃣2️⃣ Billing & Financial**
```
POST {{base_url}}/bill/create
GET {{base_url}}/bill/all
POST {{base_url}}/expense/add
GET {{base_url}}/expense/all
```

---

## 🎯 **Admin Registration Specific Test Cases:**

### **✅ Expected Success Cases:**
1. **Complete registration** with all required fields (Name, Email, Password, ConfirmPassword, Phone, Face)

### **❌ Expected Failure Cases:**
1. **Missing email** → "Email is required"
2. **Missing password** → "Password is required" + Requirements shown
3. **Missing confirmPassword** → "Please confirm your password"
4. **Weak password** → "Password does not meet requirements" + Error details
5. **Short password** → "Password must be at least 8 characters long"
6. **Password mismatch** → "Password and confirm password do not match"
7. **Duplicate email** → "Email already registered"
8. **Missing name** → "Name is required"
9. **Duplicate phone** → Phone already exists error

### **🔍 Validation Points:**
- **Email uniqueness** check working  
- **Password hashing** (response shows hasPassword: true)
- **Required fields validation** working properly
- **Face recognition** integration (if image uploaded)

---

## 📋 **Testing Checklist:**

### **Admin Registration Features:**
- [ ] ✅ Complete registration (all required fields)
- [ ] ❌ Missing email validation
- [ ] ❌ Missing password validation + Requirements display
- [ ] ❌ Missing confirmPassword validation
- [ ] ❌ Weak password rejection (no uppercase)
- [ ] ❌ Short password rejection (< 8 chars)
- [ ] ❌ Password without number/special char rejection
- [ ] ❌ Duplicate email rejection
- [ ] ❌ Password mismatch validation
- [ ] ❌ Missing required name error
- [ ] 🔐 Password hashing working
- [ ] 📸 Face recognition integration
- [ ] 📱 Phone number validation

### **General API Testing:**
- [ ] 🏥 Health endpoints working
- [ ] 🔐 Authentication flow
- [ ] 👥 Employee management
- [ ] 👤 Client management
- [ ] 🛍️ Services & Products
- [ ] 🧾 Billing system
- [ ] 💰 Financial management
- [ ] ✅ Approval system

---

## 🔧 **Important Notes:**

### **File Uploads:**
- **Images:** Face recognition ke liye clear face photos use karo
- **Format:** JPG, PNG supported
- **Size:** Reasonable size (< 5MB recommended)

### **Authentication:**
- **Token Required:** Most APIs need Bearer token
- **Token Location:** Login response → copy to `auth_token` variable
- **Token Format:** `Bearer YOUR_TOKEN_HERE`

### **Error Handling:**
- **400:** Bad Request (validation errors)
- **401:** Unauthorized (token missing/invalid)
- **404:** Not Found
- **500:** Server Error

### **Development vs Production:**
- **Local:** `http://localhost:5000`
- **Production:** Replace with your deployed URL

---

## 🎉 **Success Criteria:**

Agar ye sab test pass ho jayin to aapka updated Admin Registration system fully working hai:

1. ✅ **All registration scenarios working**
2. ✅ **Email uniqueness validation**
3. ✅ **Password confirmation logic**
4. ✅ **Optional fields handling**
5. ✅ **Face recognition integration**
6. ✅ **Proper error messages**
7. ✅ **Response format correct**

**Happy Testing! 🚀**
