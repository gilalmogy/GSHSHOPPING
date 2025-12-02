/**
 * Application-wide constants
 * Centralized to avoid magic numbers and improve maintainability
 */

// UI Interaction Constants
export const SWIPE_THRESHOLD = 60;
export const DRAG_TOLERANCE = 15;
export const LONG_PRESS_DURATION = 500;
export const LONG_PRESS_MS = 550;

// Validation Limits
export const MAX_QUANTITY = 10000;
export const MAX_PRICE = 100000;
export const MAX_NAME_LENGTH = 100;

// Toast Durations
export const TOAST_DURATION = 1500;
export const TOAST_ERROR_DURATION = 3000;

// Debounce Delays
export const DEBOUNCE_DELAY = 300;
export const SEARCH_DEBOUNCE_DELAY = 300;

// Environment
export const DEBUG = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

