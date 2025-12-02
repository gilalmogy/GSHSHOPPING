/**
 * Centralized logging utility with DEBUG flag
 * Prevents console logs in production while allowing debugging in development
 */

import { DEBUG } from './constants.js';

/**
 * Log a message (only in debug mode)
 * @param {...any} args - Arguments to log
 */
export function log(...args) {
  if (DEBUG) {
    console.log(...args);
  }
}

/**
 * Log a warning (always logs)
 * @param {...any} args - Arguments to log
 */
export function warn(...args) {
  console.warn(...args);
}

/**
 * Log an error (always logs)
 * @param {...any} args - Arguments to log
 */
export function error(...args) {
  console.error(...args);
}

/**
 * Log info (only in debug mode)
 * @param {...any} args - Arguments to log
 */
export function info(...args) {
  if (DEBUG) {
    console.info(...args);
  }
}

/**
 * Log debug (only in debug mode)
 * @param {...any} args - Arguments to log
 */
export function debug(...args) {
  if (DEBUG) {
    console.debug(...args);
  }
}

/**
 * Group logs (only in debug mode)
 * @param {string} label - Group label
 */
export function group(label) {
  if (DEBUG) {
    console.group(label);
  }
}

/**
 * End log group (only in debug mode)
 */
export function groupEnd() {
  if (DEBUG) {
    console.groupEnd();
  }
}

