/**
 * Centralized error handling utility
 * Provides consistent error handling and user-friendly messages
 */

import { toast } from '/utils/helpers.js';
import { TOAST_ERROR_DURATION } from './constants.js';
import { DEBUG } from './constants.js';

/**
 * Handle errors with user-friendly messages and optional logging
 * @param {Error} error - The error object
 * @param {string} context - Context where the error occurred (e.g., 'shopping.saveItem')
 * @param {string} userMessage - Optional custom user message
 */
export function handleError(error, context = 'unknown', userMessage = null) {
  // Always log errors in development
  if (DEBUG || error.code === 'unavailable') {
    console.error(`[${context}]`, error);
  }
  
  // Determine user-friendly message
  let message = userMessage || 'שגיאה בלתי צפויה';
  
  if (!userMessage) {
    // Map common error codes to user-friendly messages
    if (error.code === 'unavailable' || error.code === 'network-request-failed') {
      message = 'אין חיבור לאינטרנט. נסה שוב מאוחר יותר.';
    } else if (error.code === 'permission-denied') {
      message = 'אין הרשאה לבצע פעולה זו.';
    } else if (error.code === 'not-found') {
      message = 'הפריט לא נמצא.';
    } else if (error.code === 'already-exists') {
      message = 'הפריט כבר קיים.';
    } else if (error.code === 'invalid-argument') {
      message = 'הנתונים שגויים. נסה שוב.';
    } else if (error.code === 'deadline-exceeded') {
      message = 'הבקשה לוקחת יותר מדי זמן. נסה שוב.';
    } else if (error.message && DEBUG) {
      // In debug mode, show the actual error message
      message = error.message;
    }
  }
  
  // Show toast to user
  toast(message, TOAST_ERROR_DURATION);
  
  // Report to monitoring service if available
  if (typeof window !== 'undefined' && window.reportError) {
    try {
      window.reportError(error, { context });
    } catch (e) {
      // Silently fail if reporting fails
    }
  }
  
  return { success: false, error, message };
}

/**
 * Wrap async functions with error handling
 * @param {Function} fn - Async function to wrap
 * @param {string} context - Context for error reporting
 * @returns {Function} - Wrapped function
 */
export function withErrorHandling(fn, context) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleError(error, context);
      throw error; // Re-throw so caller can handle if needed
    }
  };
}

