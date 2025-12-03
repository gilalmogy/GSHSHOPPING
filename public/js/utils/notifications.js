// Push Notifications Utility with FCM
// Note: FCM imports are loaded dynamically to avoid initialization issues
let messaging, getToken, onMessage, setDoc, collection, addDoc, query, where, getDocs, deleteDoc, firestoreDoc, doc;
let currentHouseholdRef = null;

let serviceWorkerRegistration = null;
let notificationPermission = null;
let fcmToken = null;
let fcmMessaging = null;

/**
 * Initialize push notifications system with FCM
 * @param {DocumentReference} householdRef - Firestore reference to the current household
 */
export async function initNotifications(householdRef = null) {
  // If we've already registered SW and have a token with granted permission, skip re-init
  if (serviceWorkerRegistration && notificationPermission === 'granted' && fcmToken) {
    console.log('Notifications already initialized - skipping re-init');
    return true;
  }
  // Store household reference if provided
  if (householdRef) {
    currentHouseholdRef = householdRef;
  }
  
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return false;
  }

  try {
    // Register service worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    serviceWorkerRegistration = registration;
    console.log('Service Worker registered:', registration);

    // Wait for service worker to be fully ready/active
    await navigator.serviceWorker.ready;
    console.log('Service Worker ready');

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          console.log('New service worker available');
        }
      });
    });

    // Request notification permission
    const hasPermission = await requestNotificationPermission();
    
    if (hasPermission) {
      // Ensure service worker is active before initializing FCM
      if (registration.active && registration.active.state === 'activated') {
        // Initialize FCM (will load dependencies dynamically)
        await initializeFCM(registration);
      } else {
        // Wait for service worker to activate
        await new Promise((resolve) => {
          if (registration.installing) {
            registration.installing.addEventListener('statechange', () => {
              if (registration.installing.state === 'activated') {
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
        await initializeFCM(registration);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return false;
  }
}

/**
 * Load FCM dependencies dynamically
 */
async function loadFCMDependencies() {
  try {
    const firebaseModule = await import('/utils/firebase.js');
    messaging = firebaseModule.messaging;
    getToken = firebaseModule.getToken;
    onMessage = firebaseModule.onMessage;
    setDoc = firebaseModule.setDoc;
    collection = firebaseModule.collection;
    addDoc = firebaseModule.addDoc;
    query = firebaseModule.query;
    where = firebaseModule.where;
    getDocs = firebaseModule.getDocs;
    deleteDoc = firebaseModule.deleteDoc;
    doc = firebaseModule.doc;
    firestoreDoc = firebaseModule.doc;
    
    return true;
  } catch (error) {
    console.error('Error loading FCM dependencies:', error);
    return false;
  }
}

/**
 * Initialize Firebase Cloud Messaging
 */
async function initializeFCM(registration) {
  try {
    // Load FCM dependencies
    const loaded = await loadFCMDependencies();
    if (!loaded || !messaging) {
      console.warn('FCM not available, using client-side notifications only');
      return;
    }
    
    fcmMessaging = messaging;
    
    // Get FCM token
    const vapidKey = 'BHkimOnlB7n64yn7lp_qR_r7wjfxKoV4AuaYjDrhhA8PZOI3eKw_VNQGH1YkJxel0JOIQ2sXqSQ_zFNOF4Ungqo';
    fcmToken = await getToken(fcmMessaging, {
      vapidKey: vapidKey,
      serviceWorkerRegistration: registration
    });
    
    if (fcmToken) {
      console.log('FCM Token:', fcmToken);
      // Store token in Firestore
      await saveFCMToken(fcmToken);
      
      // Listen for foreground messages
      onMessage(fcmMessaging, (payload) => {
        console.log('Foreground message received:', payload);
        showNotification(payload.notification?.title || 'תזכורת', {
          body: payload.notification?.body || payload.data?.body || '',
          icon: payload.notification?.icon || '/GSH-192.png',
          tag: payload.data?.tag || 'default',
          data: payload.data || {}
        });
      });
    } else {
      console.warn('No FCM token available');
    }
  } catch (error) {
    console.error('FCM initialization failed:', error);
    // Continue without FCM - client-side notifications will still work
  }
}

/**
 * Save FCM token to Firestore
 */
async function saveFCMToken(token) {
  try {
    const firebaseModule = await import('/utils/firebase.js');
    const authModule = await import('/js/modules/auth.js');
    const { getCurrentUser, getCurrentHousehold } = authModule;
    
    const user = getCurrentUser();
    const household = getCurrentHousehold();
    
    if (!household || !firebaseModule.db) {
      console.warn('No household available, skipping FCM token save');
      return;
    }
    
    const householdRef = doc(firebaseModule.db, 'households', household.id);
    const tokensCol = collection(householdRef, 'fcmTokens');
    
    // Get user ID for this token
    const userId = user?.uid || 'anonymous';
    
    // Check if token already exists (same token for same user)
    const existingQuery = query(
      tokensCol, 
      where('token', '==', token),
      where('userId', '==', userId)
    );
    const existing = await getDocs(existingQuery);
    
    const serverTimestamp = firebaseModule.serverTimestamp || firebaseModule.Timestamp?.now;
    
    const tokenData = {
      token: token,
      userId: userId,
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      updatedAt: serverTimestamp ? serverTimestamp() : new Date()
    };
    
    if (existing.empty) {
      // New token - add it
      await addDoc(tokensCol, {
        ...tokenData,
        createdAt: serverTimestamp ? serverTimestamp() : new Date()
      });
      console.log('FCM token saved for user:', userId);
    } else {
      // Token exists - update timestamp
      const docRef = existing.docs[0].ref;
      await setDoc(docRef, tokenData, { merge: true });
      console.log('FCM token updated for user:', userId);
    }
    
    // Also store in user's tokens collection (for user-specific notifications)
    if (user?.uid) {
      const userTokensCol = collection(doc(firebaseModule.db, 'users', user.uid), 'fcmTokens');
      const userTokenQuery = query(userTokensCol, where('token', '==', token));
      const userExisting = await getDocs(userTokenQuery);
      
      if (userExisting.empty) {
        await addDoc(userTokensCol, {
          ...tokenData,
          createdAt: serverTimestamp ? serverTimestamp() : new Date()
        });
      } else {
        await setDoc(userExisting.docs[0].ref, tokenData, { merge: true });
      }
    }
  } catch (error) {
    console.error('Error saving FCM token:', error);
  }
}

/**
 * Get current FCM token
 */
export function getFCMToken() {
  return fcmToken;
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return false;
  }

  notificationPermission = Notification.permission;

  if (notificationPermission === 'granted') {
    return true;
  }

  if (notificationPermission === 'denied') {
    console.warn('Notification permission denied');
    return false;
  }

  // Request permission
  try {
    const permission = await Notification.requestPermission();
    notificationPermission = permission;
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Check if notifications are enabled
 */
export function isNotificationEnabled() {
  return notificationPermission === 'granted' && serviceWorkerRegistration !== null;
}

/**
 * Show a notification
 * @param {string} title - Notification title
 * @param {Object} options - Notification options
 */
export async function showNotification(title, options = {}) {
  if (!isNotificationEnabled()) {
    console.warn('Notifications not enabled');
    return false;
  }

  const defaultOptions = {
    body: '',
    icon: '/GSH-192.png',
    badge: '/GSH-192.png',
    tag: 'default',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: {},
    ...options
  };

  try {
    // Try service worker notification first (works in background)
    if (serviceWorkerRegistration) {
      await serviceWorkerRegistration.showNotification(title, defaultOptions);
      return true;
    }

    // Fallback to regular notification (only works when app is open)
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, defaultOptions);
      return true;
    }
  } catch (error) {
    console.error('Error showing notification:', error);
    return false;
  }

  return false;
}

/**
 * Show reminder notification
 * @param {Object} reminder - Reminder object
 * @param {string} type - 'time'
 */
export async function showReminderNotification(reminder, type) {
  const title = reminder.title || 'תזכורת';
  const body = 'הגיע הזמן!';

  return await showNotification(title, {
    body,
    tag: `reminder-${reminder.id}`,
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      reminderId: reminder.id,
      type,
      url: '/',
      reminder: reminder
    }
  });
}

/**
 * Get service worker registration
 */
export function getServiceWorkerRegistration() {
  return serviceWorkerRegistration;
}

/**
 * Check notification permission status
 */
export function getNotificationPermission() {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

