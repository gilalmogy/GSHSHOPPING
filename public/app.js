// Main application entry point
import * as firebaseUtils from '/utils/firebase.js';
import * as helpers from '/utils/helpers.js';

// Make helpers globally available
window.toast = helpers.toast;
window.showLoading = helpers.showLoading;
window.hideLoading = helpers.hideLoading;
window.fmtMoney = helpers.fmtMoney;

// Export Firebase utilities for modules
window.firebaseUtils = firebaseUtils;
window.helpers = helpers;

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

function init() {
  // Block context menu (except input fields)
  document.addEventListener('contextmenu', (e) => {
    const allow = e.target.closest('input, textarea, select, [contenteditable="true"]');
    if (!allow) e.preventDefault();
  }, { capture: true });

  console.log('App initialized - modules will load from legacy script for now');
  // Full module migration will happen incrementally
}

