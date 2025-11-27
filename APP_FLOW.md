# GSH App Flow - Authentication & Household System

This document explains the complete application flow after implementing Google Authentication and Household management.

## 📋 Overview

The app now follows a **gated initialization** pattern where the main application only starts after:
1. User authenticates with Google
2. User completes onboarding (first time only)
3. User has a household (creates or joins one)

---

## 🔄 Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    APP LOADS (index.html)                    │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          Initialize Firebase (app, db, storage)              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│   Initialize Authentication Module (initAuth)                │
│   - Sets up auth state listener                              │
│   - Handles Google redirect result (if applicable)           │
│   - Starts household listener for existing users             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│        waitForAuth() - Wait for Auth State                   │
│        (Promise resolves when auth state is known)           │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
    ┌────────┐                         ┌────────┐
    │  User  │                         │  No    │
    │  Found │                         │  User  │
    └───┬────┘                         └───┬────┘
        │                                   │
        │                                   ▼
        │                    ┌──────────────────────────────┐
        │                    │  Show Auth Modal             │
        │                    │  (Google Sign-In button)     │
        │                    └──────────────┬───────────────┘
        │                                   │
        │                                   │ User clicks
        │                                   │ "Sign in"
        │                                   │
        │                                   ▼
        │                    ┌──────────────────────────────┐
        │                    │  signInWithGoogle()          │
        │                    │  - Try popup first           │
        │                    │  - Fallback to redirect      │
        │                    └──────────────┬───────────────┘
        │                                   │
        │                                   ▼
        │                    ┌──────────────────────────────┐
        │                    │  Check if new user           │
        │                    │  - New: Create profile       │
        │                    │    with onboardingComplete   │
        │                    │    = false                   │
        │                    │  - Existing: Load profile    │
        │                    └──────────────┬───────────────┘
        │                                   │
        └───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Check Onboarding Status                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
    ┌─────────────┐                  ┌──────────────┐
    │  Needs      │                  │  Onboarding  │
    │  Onboarding │                  │  Complete    │
    │  (new user) │                  └──────┬───────┘
    └──────┬──────┘                         │
           │                                │
           ▼                                │
┌──────────────────────────┐               │
│  Show Onboarding Modal   │               │
│  - First name            │               │
│  - Last name             │               │
│  - Nickname              │               │
│  - Profile photo (opt)   │               │
└──────────┬───────────────┘               │
           │                                │
           │ User submits                   │
           │                                │
           ▼                                │
┌──────────────────────────┐               │
│  completeOnboarding()    │               │
│  - Save profile data     │               │
│  - Set onboardingComplete│               │
│    = true                │               │
└──────────┬───────────────┘               │
           │                                │
           └────────────────┬───────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│              Check Household Status                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │                                   │
         ▼                                   ▼
    ┌──────────────┐                  ┌──────────────┐
    │  Has         │                  │  No          │
    │  Household   │                  │  Household   │
    └──────┬───────┘                  └──────┬───────┘
           │                                  │
           │                                  ▼
           │                  ┌──────────────────────────────┐
           │                  │  Show Household Modal        │
           │                  │  - Create household          │
           │                  │  - Join with invite code     │
           │                  └──────────────┬───────────────┘
           │                                 │
           │                                 │ User creates
           │                                 │ or joins
           │                                 │
           │                                 ▼
           │                  ┌──────────────────────────────┐
           │                  │  createHousehold() OR        │
           │                  │  joinHouseholdByCode()       │
           │                  │  - Creates/updates household │
           │                  │  - Starts household listener │
           │                  │  - Triggers callback         │
           │                  └──────────────┬───────────────┘
           │                                 │
           └─────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│         onHouseholdChange() Callback Fired                   │
│         - Sets currentHousehold                              │
│         - Hides household modal                              │
│         - Triggers startApp()                                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    startApp() Function                       │
│                    (Main App Initialization)                 │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  1. Get householdRef from currentHousehold                  │
│  2. Initialize Push Notifications                           │
│  3. Setup Image Caching                                     │
│  4. Initialize Modules:                                     │
│     - initShopping(householdRef, ...)                       │
│     - initTasks(householdRef, ...)                          │
│     - initNotes(householdRef, ...)                          │
│     - initReminders(householdRef, ...)                      │
│     - initAnalytics(householdRef, ...)                      │
│  5. Setup Event Listeners                                   │
│  6. Load Data (categories, items, etc.)                     │
│  7. Render UI                                               │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    APP IS READY                             │
│          User can now interact with the app                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Authentication Flow Details

### 1. **Initial Page Load**
- Firebase is initialized (app, Firestore, Storage)
- `initAuth()` is called to set up authentication listeners
- `waitForAuth()` promise resolves when auth state is determined

### 2. **No User Found**
- Shows **Auth Modal** with Google Sign-In button
- User clicks "התחבר עם Google" (Sign in with Google)
- `signInWithGoogle()` is called

### 3. **Sign-In Process**
- **First attempt**: Tries `signInWithPopup()` (popup window)
- **Fallback**: If popup fails (COOP policy, etc.), uses `signInWithRedirect()`
- User authenticates with Google
- Google returns user information

### 4. **New vs Existing User**
- **New User**: 
  - Creates user profile in Firestore (`users/{uid}`)
  - Sets `onboardingComplete = false`
  - Triggers onboarding flow
- **Existing User**: 
  - Loads existing profile
  - Checks `onboardingComplete` status
  - Proceeds to household check

---

## 👤 Onboarding Flow (First Time Only)

### Steps:
1. **Show Onboarding Modal** with fields:
   - First name (required)
   - Last name (required)
   - Nickname (optional)
   - Profile photo upload (optional, defaults to Google photo)

2. **User Submits** → `completeOnboarding()` is called:
   - Updates user profile in Firestore
   - Sets `onboardingComplete = true`
   - Uploads photo to Firebase Storage (if provided)

3. **After Onboarding**:
   - Modal closes
   - Checks if household exists
   - If no household → Shows household modal
   - If household exists → Starts app

---

## 🏠 Household Flow

### Scenario A: User Has No Household

1. **Show Household Modal** with two options:
   - **Create Household**: User enters household name
   - **Join Household**: User enters invite code

2. **Create Household** (`createHousehold()`):
   - Creates document in `households` collection
   - Sets `ownerId` to current user's UID
   - Adds current user to `members` array
   - Starts household listener
   - Triggers `onHouseholdChange()` callback

3. **Join Household** (`joinHouseholdByCode()`):
   - Validates invite code in `householdInvites` collection
   - Checks if invite is valid and not expired
   - Adds user to household's `members` array
   - Marks invite as used
   - Starts household listener
   - Triggers `onHouseholdChange()` callback

### Scenario B: User Already Has Household

- Household listener detects household via query: `where('members', 'array-contains', uid)`
- `onHouseholdChange()` callback fires automatically
- App initialization starts

---

## 🚀 App Initialization (`startApp()`)

**Important**: This function is only called **once** after authentication and household setup are complete.

### What Happens:

1. **Get Household Reference**:
   ```javascript
   const household = getCurrentHousehold();
   const householdRef = doc(db, 'households', household.id);
   ```

2. **Initialize Push Notifications**:
   - Service worker registration
   - FCM token generation
   - Permission requests

3. **Setup Image Caching**:
   - Configure image cache for offline support

4. **Initialize All Modules** (each receives `householdRef`):
   - **Shopping Module**: Categories, items, purchase events
   - **Tasks Module**: Task categories, tasks, Gantt chart
   - **Notes Module**: Note categories, notes
   - **Reminders Module**: Reminder categories, reminders
   - **Analytics Module**: Statistics and charts

5. **Setup Event Listeners**:
   - Navigation (Shopping, Tasks, Notes, Reminders)
   - Theme toggle
   - Search functionality
   - Modal handlers

6. **Load and Render Data**:
   - Categories are loaded from Firestore subcollections
   - Items/Tasks/Notes/Reminders are loaded per category
   - UI is rendered

---

## 🔄 Real-Time Updates

### Household Listener
- Continuously monitors Firestore for household changes
- Query: `where('members', 'array-contains', uid)`
- When household changes (e.g., new member joins), `onHouseholdChange()` fires
- App updates accordingly

### Module Listeners
- Each module (Shopping, Tasks, Notes, Reminders) has its own `onSnapshot` listeners
- Listen to subcollections: `households/{householdId}/categories`, etc.
- Real-time updates when data changes

---

## 🔒 Security Flow

### Firestore Security Rules

All data access is gated by:
1. **Authentication**: User must be authenticated (`request.auth != null`)
2. **Household Membership**: User must be owner OR member of the household

**Example Rule**:
```javascript
match /households/{householdId}/categories/{categoryId} {
  allow read, write: if isHouseholdOwnerOrMember(householdId);
}
```

### Storage Security Rules

- Images are stored in Firebase Storage
- Write requires authentication
- Read is public (for sharing images)
- File size and type validation

---

## 📱 User Journey Examples

### New User Journey
```
1. Opens app → Auth modal shown
2. Signs in with Google → Profile created
3. Onboarding modal → Fills profile details
4. Household modal → Creates "My Family" household
5. App initializes → Can use all features
```

### Existing User Journey
```
1. Opens app → Auth check happens
2. Already authenticated → Household loaded automatically
3. App initializes → Can use all features
```

### Returning User (No Session)
```
1. Opens app → Auth modal shown
2. Signs in with Google → Profile loaded
3. Household found → App initializes
```

### User Joining Existing Household
```
1. Opens app → Auth modal shown
2. Signs in → Onboarding complete
3. Household modal → Enters invite code
4. Joins household → App initializes
```

---

## 🛠️ Key Functions

### Authentication
- `initAuth()` - Initialize auth module
- `signInWithGoogle()` - Handle Google sign-in
- `signOutUser()` - Sign out user
- `waitForAuth()` - Wait for auth state
- `getCurrentUser()` - Get current user
- `getCurrentUserProfile()` - Get user profile

### Onboarding
- `completeOnboarding()` - Save onboarding data

### Household
- `createHousehold(name)` - Create new household
- `joinHouseholdByCode(code)` - Join with invite code
- `getCurrentHousehold()` - Get current household
- `generateInviteCode()` - Generate invite code for sharing

### App Initialization
- `startApp()` - Initialize all modules (only called once)

---

## ⚠️ Important Notes

1. **`startApp()` is called only once** - Protected by `authInitialized` flag
2. **All modules require `householdRef`** - Data is scoped to household
3. **Real-time listeners** - Data updates automatically via Firestore
4. **Security** - All operations checked against household membership
5. **Offline support** - Firestore local cache enabled for offline use

---

## 🔍 Debugging

### Check Authentication State
```javascript
console.log('User:', getCurrentUser());
console.log('Profile:', getCurrentUserProfile());
console.log('Household:', getCurrentHousehold());
```

### Common Issues

1. **"No household found"**: User needs to create or join a household
2. **Permission errors**: Check Firestore security rules
3. **App not loading**: Check if `startApp()` was called
4. **Data not showing**: Check if modules were initialized with correct `householdRef`

---

This flow ensures that:
- ✅ Users must authenticate
- ✅ Users complete onboarding (first time)
- ✅ Users belong to a household (shared data)
- ✅ All data is scoped to household
- ✅ Real-time updates work across household members
- ✅ Security rules enforce access control

