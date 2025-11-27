/**
 * Cloud Functions for GSH Shopping App
 * Handles push notifications via Firebase Cloud Messaging (FCM)
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Send push notification to user's devices
 * @param {string} userId - User ID to send notification to
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data to send with notification
 */
async function sendPushNotification(userId, title, body, data = {}) {
  try {
    // Get user's FCM tokens
    const userTokensRef = admin.firestore()
      .collection('users')
      .doc(userId)
      .collection('fcmTokens');
    
    const tokensSnapshot = await userTokensRef.get();
    
    if (tokensSnapshot.empty) {
      console.log(`No FCM tokens found for user ${userId}`);
      return { success: false, reason: 'no_tokens' };
    }
    
    const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
    
    // Prepare notification message
    const message = {
      notification: {
        title: title,
        body: body
      },
      data: {
        ...data,
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      },
      tokens: tokens,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'reminders'
        }
      },
      webpush: {
        notification: {
          icon: '/GSH-192.png',
          badge: '/GSH-192.png',
          requireInteraction: true,
          vibrate: [200, 100, 200]
        }
      }
    };
    
    // Send to all user's devices
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`Successfully sent ${response.successCount} notifications to user ${userId}`);
    
    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          console.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
        }
      });
      
      // Remove invalid tokens
      for (const token of failedTokens) {
        const tokenDoc = tokensSnapshot.docs.find(doc => doc.data().token === token);
        if (tokenDoc) {
          await tokenDoc.ref.delete();
        }
      }
    }
    
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send push notification to household members
 * @param {string} householdId - Household ID
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data
 */
async function sendPushToHousehold(householdId, title, body, data = {}) {
  try {
    const householdRef = admin.firestore().collection('households').doc(householdId);
    const householdDoc = await householdRef.get();
    
    if (!householdDoc.exists) {
      return { success: false, reason: 'household_not_found' };
    }
    
    const householdData = householdDoc.data();
    const memberIds = householdData.members || [];
    
    // Send to all household members
    const results = await Promise.all(
      memberIds.map(userId => sendPushNotification(userId, title, body, data))
    );
    
    const successCount = results.filter(r => r.success).length;
    
    return {
      success: true,
      sentTo: successCount,
      total: memberIds.length
    };
  } catch (error) {
    console.error('Error sending push to household:', error);
    return { success: false, error: error.message };
  }
}

/**
 * HTTP Cloud Function to send push notification
 * Callable from client or triggered by other functions
 */
exports.sendPushNotification = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { userId, title, body, data: notificationData } = data;
  
  if (!userId || !title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }
  
  // Users can only send notifications to themselves or their household
  if (userId !== context.auth.uid) {
    // Check if user is in same household
    const userProfile = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userData = userProfile.data();
    
    if (!userData || !userData.householdId) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot send notifications to other users');
    }
    
    const targetUserProfile = await admin.firestore().collection('users').doc(userId).get();
    const targetUserData = targetUserProfile.data();
    
    if (!targetUserData || targetUserData.householdId !== userData.householdId) {
      throw new functions.https.HttpsError('permission-denied', 'Users must be in same household');
    }
  }
  
  return await sendPushNotification(userId, title, body, notificationData || {});
});

/**
 * Firestore trigger: Send push notification when reminder is due
 * Triggered when a reminder document is created or updated with status 'due'
 */
exports.onReminderDue = functions.firestore
  .document('households/{householdId}/reminders/{reminderId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    
    // Check if reminder just became due
    if (!before.isDue && after.isDue && after.status === 'active') {
      const householdId = context.params.householdId;
      const reminderId = context.params.reminderId;
      
      const title = after.title || 'תזכורת';
      const body = 'הגיע הזמן!';
      
      const notificationData = {
        reminderId: reminderId,
        type: 'reminder',
        url: '/#reminders'
      };
      
      // Send to household members
      await sendPushToHousehold(householdId, title, body, notificationData);
    }
    
    return null;
  });

/**
 * HTTP endpoint to trigger reminder notification (for scheduled reminders)
 */
exports.triggerReminderNotification = functions.https.onRequest(async (req, res) => {
  // Verify request (should use authentication or secret token in production)
  const { householdId, reminderId, userId, title, body } = req.body;
  
  if (!householdId || !reminderId || !title) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  try {
    const notificationData = {
      reminderId: reminderId,
      type: 'reminder',
      url: '/#reminders'
    };
    
    if (userId) {
      // Send to specific user
      const result = await sendPushNotification(userId, title, body || 'הגיע הזמן!', notificationData);
      return res.json(result);
    } else {
      // Send to household
      const result = await sendPushToHousehold(householdId, title, body || 'הגיע הזמן!', notificationData);
      return res.json(result);
    }
  } catch (error) {
    console.error('Error triggering reminder notification:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * Scheduled function to check for due reminders
 * Runs every minute to check for time-based reminders
 */
exports.checkDueReminders = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    try {
      const now = admin.firestore.Timestamp.now();
      const householdsSnapshot = await admin.firestore().collection('households').get();
      
      for (const householdDoc of householdsSnapshot.docs) {
        const householdId = householdDoc.id;
        const remindersRef = admin.firestore()
          .collection('households')
          .doc(householdId)
          .collection('reminders');
        
        // Query active reminders with due time <= now
        const dueReminders = await remindersRef
          .where('status', '==', 'active')
          .where('time', '<=', now)
          .where('isDue', '==', false)
          .get();
        
        for (const reminderDoc of dueReminders.docs) {
          const reminder = reminderDoc.data();
          
          // Mark as due and send notification
          await reminderDoc.ref.update({
            isDue: true,
            notifiedAt: now
          });
          
          const title = reminder.title || 'תזכורת';
          const body = 'הגיע הזמן!';
          
          const notificationData = {
            reminderId: reminderDoc.id,
            type: 'reminder',
            url: '/#reminders'
          };
          
          // Send to user who owns the reminder or household
          if (reminder.userId) {
            await sendPushNotification(reminder.userId, title, body, notificationData);
          } else {
            await sendPushToHousehold(householdId, title, body, notificationData);
          }
        }
      }
      
      console.log('Checked for due reminders');
      return null;
    } catch (error) {
      console.error('Error checking due reminders:', error);
      return null;
    }
  });

