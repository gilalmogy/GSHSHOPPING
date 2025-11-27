# FCM Push Notifications Implementation Guide

## ✅ Completed Steps

### 1. Client-Side FCM Setup
- ✅ FCM SDK is imported in `public/utils/firebase.js`
- ✅ Service worker is configured to handle push notifications
- ✅ FCM token generation and storage in Firestore
- ✅ Token stored in both household and user collections
- ✅ Foreground message handling

### 2. Cloud Functions Created
- ✅ `functions/index.js` - Main Cloud Functions file
- ✅ `functions/package.json` - Dependencies configured
- ✅ `functions/.eslintrc.js` - ESLint configuration

### 3. Functions Implemented
- ✅ `sendPushNotification(userId, title, body, data)` - Send to specific user
- ✅ `sendPushToHousehold(householdId, title, body, data)` - Send to all household members
- ✅ `sendPushNotification` (callable) - HTTP callable function
- ✅ `onReminderDue` - Firestore trigger for reminders
- ✅ `triggerReminderNotification` - HTTP endpoint for scheduled reminders
- ✅ `checkDueReminders` - Scheduled function (runs every minute)

## 📋 Next Steps to Deploy

### Step 1: Install Cloud Functions Dependencies
```bash
cd functions
npm install
```

### Step 2: Deploy Cloud Functions
```bash
firebase deploy --only functions
```

### Step 3: Update Firestore Security Rules
Add rules to allow Cloud Functions to read/write FCM tokens:

```javascript
match /households/{householdId}/fcmTokens/{tokenId} {
  allow read, write: if request.auth != null;
}

match /users/{userId}/fcmTokens/{tokenId} {
  allow read, write: if request.auth != null;
}
```

### Step 4: Update Client Code (Optional)
The client-side code in `public/js/utils/notifications.js` is already set up. 
You may want to add a helper function to call Cloud Functions directly:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

export async function sendPushViaCloudFunction(userId, title, body, data) {
  const functions = getFunctions(app);
  const sendPush = httpsCallable(functions, 'sendPushNotification');
  
  try {
    const result = await sendPush({ userId, title, body, data });
    return result.data;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}
```

### Step 5: Test Push Notifications

1. **Test token generation:**
   - Open app and check console for "FCM Token obtained"
   - Verify token is saved in Firestore under `households/{householdId}/fcmTokens/`

2. **Test foreground notification:**
   - Keep app open
   - Create a reminder due in 1 minute
   - Should see notification appear

3. **Test background notification:**
   - Close app completely
   - Wait for scheduled function to check reminders
   - Should receive push notification

## 🔧 Configuration Required

### VAPID Key
The VAPID key is already in the code:
```
BHkimOnlB7n64yn7lp_qR_r7wjfxKoV4AuaYjDrhhA8PZOI3eKw_VNQGH1YkJxel0JOIQ2sXqSQ_zFNOF4Ungqo
```

To get a new one or verify:
1. Go to Firebase Console
2. Project Settings > Cloud Messaging
3. Copy Web Push certificates > Key pair

### Cloud Functions Configuration
Make sure your Firebase project has:
- Billing enabled (required for scheduled functions)
- Cloud Functions API enabled
- Firestore in production mode

## 📝 Notes

- Scheduled function runs every minute to check for due reminders
- Reminders are checked both client-side (when app is open) and server-side (always)
- Invalid FCM tokens are automatically cleaned up
- Notifications work even when app is completely closed

## 🐛 Troubleshooting

1. **No push notifications received:**
   - Check browser console for FCM token
   - Verify notification permission is granted
   - Check Cloud Functions logs: `firebase functions:log`

2. **Token not saving:**
   - Verify Firestore security rules allow write
   - Check network tab for errors
   - Verify user is authenticated

3. **Cloud Functions not working:**
   - Check billing is enabled
   - Verify functions are deployed: `firebase functions:list`
   - Check logs: `firebase functions:log`

