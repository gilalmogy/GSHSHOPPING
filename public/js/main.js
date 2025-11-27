// Main application entry point
// This file will gradually replace the inline script in index.html

import * as firebaseUtils from '/utils/firebase.js';
import * as helpers from '/utils/helpers.js';
import { loadImageWithCache } from './utils/imageCache.js';
import * as constants from './constants.js';

// Make helpers globally available for backward compatibility
window.toast = helpers.toast;
window.showLoading = helpers.showLoading;
window.hideLoading = helpers.hideLoading;
window.fmtMoney = helpers.fmtMoney;
window.firebaseUtils = firebaseUtils;
window.helpers = helpers;
window.loadImageWithCache = loadImageWithCache;
window.constants = constants;

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  // Block context menu (except input fields and category buttons)
  document.addEventListener('contextmenu', (e) => {
    // Allow contextmenu on category buttons
    if (e.target.closest('.cat')) return;
    const allow = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (!allow) e.preventDefault();
  }, { capture: true });

  console.log('App initialized - modules will load from legacy script for now');
  // Full module migration will happen incrementally
  // TODO: Import and initialize feature modules here
  // import { initShopping } from './modules/shopping.js';
  // import { initTasks } from './modules/tasks.js';
  // import { initNotes } from './modules/notes.js';
  // import { initReminders } from './modules/reminders.js';
  // import { initAnalytics } from './modules/analytics.js';
  // import { initUI } from './modules/ui.js';
  // 
  // initUI();
  // initShopping();
  // initTasks();
  // initNotes();
  // initReminders();
  // initAnalytics();
}

