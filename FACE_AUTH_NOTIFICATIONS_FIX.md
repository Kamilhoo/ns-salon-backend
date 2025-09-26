# 🔔 Face Auth Notifications Fix

## Problem Description

Face-authenticated admins were not receiving notifications due to an issue in the authentication middleware where `req.user.adminId` was not being properly set for face auth JWT tokens.

## Root Cause

The authentication middleware had the correct logic for JWT tokens with `adminId`, but the fallback handling wasn't preserving the `adminId` field properly when the admin lookup failed or when using the fallback JWT token handling.

## Solution Implemented

### 1. Enhanced Authentication Middleware (`middleware/authMiddleware.js`)

**Changes Made:**

- Added detailed logging for admin token detection and lookup
- Enhanced fallback JWT token handling to preserve `adminId` field
- Added debugging logs to track token processing

**Key Fix:**

```javascript
// Enhanced fallback handling
if (decoded.adminId) {
  req.user = {
    adminId: decoded.adminId,
    name: decoded.name,
    role: decoded.role || "admin",
    email: decoded.email,
  };
} else {
  req.user = decoded;
}
```

### 2. Added Debugging to Face Login (`controller/authController.js`)

**Changes Made:**

- Added logging for JWT token creation in face login
- Enhanced debugging to track token payload structure

### 3. Enhanced Notification Controller Debugging (`controller/notificationController.js`)

**Changes Made:**

- Added detailed logging for user ID extraction
- Enhanced debugging to track notification retrieval process

## How It Works

### Face Auth Flow:

1. **Frontend** calls `/auth/face-login` with `adminId`, `name`, `faceVerified`
2. **Backend** creates JWT token with `adminId: admin._id`
3. **Authentication Middleware** decodes JWT and sets `req.user.adminId`
4. **Notification Controller** uses `req.user.adminId` to fetch notifications

### Token Structure:

```javascript
// Face auth JWT payload
{
  adminId: "admin_mongodb_id",
  email: "admin@salon.com",
  role: "admin"
}
```

### Authentication Middleware Flow:

1. Decode JWT token
2. Check if `decoded.adminId` exists
3. Look up admin in database
4. Set `req.user.adminId = admin._id`
5. Continue to next middleware

## Testing

Use the provided test script to verify the fix:

```bash
node test-face-auth-notifications.js
```

**Test Steps:**

1. Regular admin login (credential-based)
2. Face auth login simulation
3. Compare notification retrieval for both methods
4. Verify face auth admins can receive notifications

## Expected Results

After the fix:

- ✅ Admin (credential login): Gets notifications
- ✅ Manager: Gets notifications
- ✅ Admin (face recognition login): Gets notifications

## Files Modified

1. `middleware/authMiddleware.js` - Enhanced JWT token handling
2. `controller/authController.js` - Added debugging logs
3. `controller/notificationController.js` - Added debugging logs
4. `test-face-auth-notifications.js` - Test script for verification

## Debugging

The enhanced logging will show:

- JWT token creation in face login
- Admin token detection in middleware
- User ID extraction in notification controller
- Token payload structure

Check server logs for detailed debugging information.

## Verification

To verify the fix is working:

1. Start the server
2. Run the test script with valid admin credentials
3. Check that face auth notifications are retrieved successfully
4. Compare notification counts between regular and face auth login

The fix ensures that face-authenticated admins have the same notification access as credential-authenticated admins.
