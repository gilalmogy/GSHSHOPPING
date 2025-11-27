// Authentication Module - Google Sign-In, User Management, Household Management
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut, 
  onAuthStateChanged,
  getIdToken
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  onSnapshot,
  Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let auth = null;
let db = null;
let currentUser = null;
let currentUserProfile = null;
let currentHousehold = null;
let authStateListeners = [];
let householdListeners = [];

/**
 * Initialize authentication module
 * @param {Object} params - Initialization parameters
 * @param {Object} params.app - Firebase app instance
 * @param {Object} params.db - Firestore database instance
 * @param {Function} params.onAuthChange - Callback when auth state changes
 * @param {Function} params.onHouseholdChange - Callback when household changes
 */
export function initAuth({ app, db: dbInstance, onAuthChange, onHouseholdChange }) {
  auth = getAuth(app);
  db = dbInstance;

  // Handle redirect result (if user came back from Google sign-in)
  getRedirectResult(auth).then(async (result) => {
    if (result && result.user) {
      currentUser = result.user;
      await loadUserProfile(result.user.uid);
      startHouseholdListener(result.user.uid, onHouseholdChange);
      authStateListeners.forEach(listener => listener(currentUser, currentUserProfile));
      if (onAuthChange) onAuthChange(currentUser, currentUserProfile);
    }
  }).catch((error) => {
    console.error('Auth redirect error:', error);
  });

  // Listen for auth state changes
  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    
    if (user) {
      // User is signed in - load profile
      await loadUserProfile(user.uid);
      // Start household listener
      startHouseholdListener(user.uid, onHouseholdChange);
    } else {
      // User is signed out
      currentUserProfile = null;
      currentHousehold = null;
      // Clear household listeners
      householdListeners.forEach(unsubscribe => unsubscribe?.());
      householdListeners = [];
    }

    // Notify listeners
    authStateListeners.forEach(listener => listener(currentUser, currentUserProfile));
    if (onAuthChange) onAuthChange(currentUser, currentUserProfile);
  });

  // Start listening for household changes if user is logged in
  if (auth.currentUser) {
    startHouseholdListener(auth.currentUser.uid, onHouseholdChange);
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');

    // Prefer popup where possible, fall back to redirect if blocked / COOP issues
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Check if user profile exists, if not, mark for onboarding
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) {
        // New user - create basic profile from Google data
        const profileData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          nickname: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          onboardingComplete: false
        };
        
        await setDoc(doc(db, 'users', user.uid), profileData);
        currentUserProfile = profileData;
        
        return { user, isNewUser: true, needsOnboarding: true };
      } else {
        // Existing user
        const profileData = userDoc.data();
        currentUserProfile = profileData;
        
        // Load household
        await loadUserHousehold(user.uid);
        
        return { user, isNewUser: false, needsOnboarding: !profileData.onboardingComplete };
      }
    } catch (popupError) {
      console.warn('Popup sign-in failed, falling back to redirect:', popupError);
      // Use redirect flow as a fallback (more reliable with strict browser policies)
      await signInWithRedirect(auth, provider);
      // The result will be handled by getRedirectResult on page load
      return { user: null, isNewUser: false, needsOnboarding: false };
    }
  } catch (error) {
    console.error('Google sign-in error:', error);
    throw error;
  }
}

/**
 * Sign out
 */
export async function signOutUser() {
  try {
    await signOut(auth);
    currentUser = null;
    currentUserProfile = null;
    currentHousehold = null;
    
    // Clear household listener
    householdListeners.forEach(unsubscribe => unsubscribe?.());
    householdListeners = [];
    
    return true;
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
}

/**
 * Load user profile from Firestore
 */
async function loadUserProfile(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      currentUserProfile = { id: userDoc.id, ...userDoc.data() };
      await loadUserHousehold(uid);
      return currentUserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
}

/**
 * Load user's household
 */
async function loadUserHousehold(uid) {
  try {
    // Find household where user is a member
    const householdsQuery = query(
      collection(db, 'households'),
      where('members', 'array-contains', uid)
    );
    const householdsSnapshot = await getDocs(householdsQuery);
    
    if (!householdsSnapshot.empty) {
      const householdDoc = householdsSnapshot.docs[0];
      currentHousehold = { id: householdDoc.id, ...householdDoc.data() };
      return currentHousehold;
    }
    
    currentHousehold = null;
    return null;
  } catch (error) {
    console.error('Error loading household:', error);
    currentHousehold = null;
    return null;
  }
}

/**
 * Start listening for household changes
 */
function startHouseholdListener(uid, onHouseholdChange) {
  // Clear existing listeners
  householdListeners.forEach(unsubscribe => unsubscribe?.());
  householdListeners = [];
  
  if (!uid) return;
  
  const unsubscribe = onSnapshot(
    query(collection(db, 'households'), where('members', 'array-contains', uid)),
    (snapshot) => {
      if (!snapshot.empty) {
        const householdDoc = snapshot.docs[0];
        currentHousehold = { id: householdDoc.id, ...householdDoc.data() };
        if (onHouseholdChange) onHouseholdChange(currentHousehold);
      } else {
        currentHousehold = null;
        if (onHouseholdChange) onHouseholdChange(null);
      }
    },
    (error) => {
      console.error('Household listener error:', error);
    }
  );
  
  householdListeners.push(unsubscribe);
}

/**
 * Update user profile
 */
export async function updateUserProfile(updates) {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  try {
    const userRef = doc(db, 'users', auth.currentUser.uid);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    
    // Reload profile
    await loadUserProfile(auth.currentUser.uid);
    return currentUserProfile;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

/**
 * Complete onboarding
 */
export async function completeOnboarding(profileData) {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  try {
    const updates = {
      firstName: profileData.firstName || '',
      lastName: profileData.lastName || '',
      nickname: profileData.nickname || '',
      photoURL: profileData.photoURL || auth.currentUser.photoURL || '',
      onboardingComplete: true,
      updatedAt: serverTimestamp()
    };
    
    await updateUserProfile(updates);
    return currentUserProfile;
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw error;
  }
}

/**
 * Create a new household
 */
export async function createHousehold(householdName) {
  if (!auth.currentUser) throw new Error('User not authenticated');
  
  try {
    // Check if user already has a household
    if (currentHousehold) {
      throw new Error('User already belongs to a household');
    }
    
    const householdData = {
      name: householdName,
      ownerId: auth.currentUser.uid,
      members: [auth.currentUser.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    const householdRef = await addDoc(collection(db, 'households'), householdData);
    currentHousehold = { id: householdRef.id, ...householdData };
    
    // Start household listener to pick up changes
    if (auth.currentUser) {
      startHouseholdListener(auth.currentUser.uid, globalOnHouseholdChange);
    }
    
    // Trigger household change callback immediately
    if (globalOnHouseholdChange) {
      globalOnHouseholdChange(currentHousehold);
    }
    
    return currentHousehold;
  } catch (error) {
    console.error('Error creating household:', error);
    throw error;
  }
}

/**
 * Generate invitation code for household (4-digit numeric code)
 */
export async function generateInviteCode() {
  if (!currentHousehold) throw new Error('No household selected');
  if (!auth.currentUser || auth.currentUser.uid !== currentHousehold.ownerId) {
    throw new Error('Only household owner can generate invite codes');
  }
  
  try {
    // Generate a unique 4-digit numeric code (0000-9999)
    let code;
    let attempts = 0;
    const maxAttempts = 100;
    
    do {
      // Generate random 4-digit code (0000-9999)
      code = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      
      // Check if code already exists and is not used
      const existingQuery = query(
        collection(db, 'householdInvites'),
        where('code', '==', code),
        where('used', '==', false)
      );
      const existing = await getDocs(existingQuery);
      
      if (existing.empty) {
        // Code is unique and available
        break;
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique invite code. Please try again.');
      }
    } while (true);
    
    const inviteData = {
      householdId: currentHousehold.id,
      code: code,
      createdBy: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
      used: false,
      usedBy: null,
      usedAt: null
    };
    
    const inviteRef = await addDoc(collection(db, 'householdInvites'), inviteData);
    return { id: inviteRef.id, code, ...inviteData };
  } catch (error) {
    console.error('Error generating invite code:', error);
    throw error;
  }
}

/**
 * Join household by invite code
 */
export async function joinHouseholdByCode(inviteCode) {
  if (!auth.currentUser) throw new Error('User not authenticated');
  if (currentHousehold) throw new Error('User already belongs to a household');
  
  try {
    // Normalize code - remove spaces, ensure 4 digits
    const normalizedCode = inviteCode.replace(/\s/g, '').trim();
    
    // Validate format (4 digits)
    if (!/^\d{4}$/.test(normalizedCode)) {
      throw new Error('קוד הזמנה חייב להיות 4 ספרות');
    }
    
    // Find invite by code (4-digit numeric)
    const invitesQuery = query(
      collection(db, 'householdInvites'),
      where('code', '==', normalizedCode),
      where('used', '==', false)
    );
    const invitesSnapshot = await getDocs(invitesQuery);
    
    if (invitesSnapshot.empty) {
      throw new Error('קוד הזמנה לא תקין או פג תוקף');
    }
    
    const inviteDoc = invitesSnapshot.docs[0];
    const inviteData = inviteDoc.data();
    
    // Check if expired
    if (inviteData.expiresAt?.toDate() < new Date()) {
      throw new Error('קוד הזמנה פג תוקף');
    }
    
    // Get household
    const householdRef = doc(db, 'households', inviteData.householdId);
    const householdDoc = await getDoc(householdRef);
    
    if (!householdDoc.exists()) {
      throw new Error('Household not found');
    }
    
    // Add user to household members
    const householdData = householdDoc.data();
    if (!householdData.members) {
      householdData.members = [];
    }
    
    if (!householdData.members.includes(auth.currentUser.uid)) {
      householdData.members.push(auth.currentUser.uid);
      await updateDoc(householdRef, {
        members: householdData.members,
        updatedAt: serverTimestamp()
      });
    }
    
    // Mark invite as used
    await updateDoc(doc(db, 'householdInvites', inviteDoc.id), {
      used: true,
      usedBy: auth.currentUser.uid,
      usedAt: serverTimestamp()
    });
    
    // Reload household (listener will pick it up automatically)
    await loadUserHousehold(auth.currentUser.uid);
    
    return currentHousehold;
  } catch (error) {
    console.error('Error joining household:', error);
    throw error;
  }
}

/**
 * Remove a member from household
 */
export async function removeHouseholdMember(memberId) {
  if (!currentHousehold) throw new Error('No household selected');
  if (!auth.currentUser) throw new Error('User not authenticated');
  if (auth.currentUser.uid !== currentHousehold.ownerId) {
    throw new Error('Only household owner can remove members');
  }
  if (memberId === currentHousehold.ownerId) {
    throw new Error('Cannot remove the household owner');
  }
  
  try {
    const householdRef = doc(db, 'households', currentHousehold.id);
    const householdData = await getDoc(householdRef);
    
    if (!householdData.exists()) {
      throw new Error('Household not found');
    }
    
    const members = householdData.data().members || [];
    if (!members.includes(memberId)) {
      throw new Error('User is not a member of this household');
    }
    
    // Remove member from array
    const updatedMembers = members.filter(id => id !== memberId);
    
    await updateDoc(householdRef, {
      members: updatedMembers,
      updatedAt: serverTimestamp()
    });
    
    // Update current household
    currentHousehold.members = updatedMembers;
    
    return true;
  } catch (error) {
    console.error('Error removing household member:', error);
    throw error;
  }
}

/**
 * Update household name
 */
export async function updateHouseholdName(newName) {
  if (!currentHousehold) throw new Error('No household selected');
  if (!auth.currentUser) throw new Error('User not authenticated');
  if (auth.currentUser.uid !== currentHousehold.ownerId) {
    throw new Error('Only household owner can update household name');
  }
  
  if (!newName || !newName.trim()) {
    throw new Error('Household name cannot be empty');
  }
  
  try {
    const householdRef = doc(db, 'households', currentHousehold.id);
    await updateDoc(householdRef, {
      name: newName.trim(),
      updatedAt: serverTimestamp()
    });
    
    // Update current household
    currentHousehold.name = newName.trim();
    
    return true;
  } catch (error) {
    console.error('Error updating household name:', error);
    throw error;
  }
}

/**
 * Get current user
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * Get current user profile
 */
export function getCurrentUserProfile() {
  return currentUserProfile;
}

/**
 * Get current household
 */
export function getCurrentHousehold() {
  return currentHousehold;
}

/**
 * Wait for authentication to be ready
 */
export function waitForAuth() {
  return new Promise((resolve) => {
    // Wait a bit for auth to initialize
    const checkAuth = () => {
      if (auth && auth.currentUser && currentUserProfile !== null) {
        resolve({ user: currentUser, profile: currentUserProfile, household: currentHousehold });
        return;
      }
      
      if (auth && !auth.currentUser) {
        // User is signed out - resolve with null
        resolve({ user: null, profile: null, household: null });
        return;
      }
      
      // Wait for auth state to change
      const listener = (user, profile) => {
        resolve({ user, profile: profile || null, household: currentHousehold });
        // Remove listener after first resolution
        const index = authStateListeners.indexOf(listener);
        if (index > -1) authStateListeners.splice(index, 1);
      };
      
      authStateListeners.push(listener);
      
      // Timeout after 1.5 seconds if no auth state (shorter for mobile)
      setTimeout(() => {
        const idx = authStateListeners.indexOf(listener);
        if (idx > -1) {
          authStateListeners.splice(idx, 1);
          console.log('waitForAuth timeout (1.5s) - resolving with no user');
          resolve({ user: null, profile: null, household: null });
        }
      }, 1500);
    };
    
    // Give auth a moment to initialize
    if (auth) {
      checkAuth();
    } else {
      // If auth not ready, wait a bit then check (shorter timeout for mobile)
      setTimeout(() => {
        if (!auth) {
          // If auth still not ready after 200ms, resolve with no user
          console.warn('Auth not initialized after 200ms - resolving with no user');
          resolve({ user: null, profile: null, household: null });
        } else {
          checkAuth();
        }
      }, 200);
    }
  });
}

/**
 * Add auth state change listener
 */
export function onAuthStateChange(callback) {
  authStateListeners.push(callback);
  // Immediately call with current state if available
  if (auth.currentUser !== null || currentUser === null) {
    callback(currentUser, currentUserProfile);
  }
  // Return unsubscribe function
  return () => {
    const index = authStateListeners.indexOf(callback);
    if (index > -1) authStateListeners.splice(index, 1);
  };
}
