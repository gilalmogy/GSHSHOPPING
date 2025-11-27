// Firebase initialization and exports
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  initializeFirestore, persistentLocalCache,
  doc, setDoc, updateDoc, addDoc, deleteDoc,
  collection, query, where, orderBy, onSnapshot,
  serverTimestamp, limit, getDocs, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage, ref as sref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyDW9cEbt6ltDpRGDrfv6RQtpVk4zc30aIY",
  authDomain: "gsh-shop-6cc4a.firebaseapp.com",
  projectId: "gsh-shop-6cc4a",
  storageBucket: "gsh-shop-6cc4a.firebasestorage.app",
  messagingSenderId: "114081496381",
  appId: "1:114081496381:web:391f552b1ee20757025954",
  measurementId: "G-N43W43M74H"
};

// Check if Firebase is already initialized to avoid duplicate app error
let app;
try {
  app = getApp();
} catch (e) {
  // App doesn't exist, initialize it
  app = initializeApp(firebaseConfig);
}
const db = initializeFirestore(app, { localCache: persistentLocalCache() });
const storage = getStorage(app, "gs://gsh-shop-6cc4a.firebasestorage.app");

// Note: Household reference is now managed through authentication
// Old hardcoded household initialization removed - households are now created per authenticated user

// Initialize Firebase Cloud Messaging
let messaging = null;
try {
  messaging = getMessaging(app);
} catch (e) {
  console.warn('FCM not available:', e);
}

export { 
  app,
  db, 
  storage, 
  doc, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  limit, 
  getDocs, 
  Timestamp,
  sref,
  uploadBytesResumable,
  getDownloadURL,
  messaging,
  getToken,
  onMessage
};

