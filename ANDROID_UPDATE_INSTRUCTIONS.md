# Instructions to Update GSH App on Android

If your Android phone is stuck on an older version of the app, follow these steps:

## Method 1: Automatic Update (Recommended)
1. **Close the app completely** - Swipe it away from recent apps
2. **Open the app again** - The app should automatically detect the new version and reload
3. If it doesn't update automatically, wait 30 seconds and try again

## Method 2: Force Refresh
1. **Open the app** in your browser (Chrome, etc.)
2. **Open the browser menu** (three dots)
3. **Go to Settings** → **Privacy** → **Clear browsing data**
4. **Select "Cached images and files"** and **"Site data"**
5. **Clear data** for the last hour or for the site specifically
6. **Close the browser completely**
7. **Reopen the app**

## Method 3: Clear Service Worker (Advanced)
1. **Open Chrome on your Android phone**
2. **Navigate to**: `chrome://serviceworker-internals/`
3. **Find "gsh.warpcodes.com"** or the app URL in the list
4. **Click "Unregister"**
5. **Close Chrome completely**
6. **Reopen the app**

## Method 4: Uninstall and Reinstall
1. **Uninstall the app** from your Android home screen
2. **Visit** `https://gsh.warpcodes.com` or `https://gsh-shop-6cc4a.web.app`
3. **Install the app again** (add to home screen)

## Method 5: Use Browser Console (For Developers)
If you have access to developer tools:
1. Open the app in Chrome
2. Open Chrome DevTools (Remote debugging)
3. In the console, type: `forceAppUpdate()`
4. The app will clear all caches and reload

## What We Changed
- **Cache version**: Updated from v3 to v4 (forces new service worker)
- **Aggressive cache clearing**: All old caches are deleted on update
- **Automatic version detection**: App checks for updates every 30 seconds
- **Force reload mechanism**: App automatically reloads when a new version is detected

## Still Not Working?
If none of the above work:
1. Check your internet connection
2. Make sure you're visiting the correct URL
3. Try opening in an incognito/private window first
4. Contact support with your Android version and browser version

