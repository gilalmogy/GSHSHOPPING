// Shared utility functions
export function toast(msg, duration = 2000) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), duration);
}

export function showLoading(text = 'טוען...') {
  const overlay = document.getElementById('loadingOverlay');
  const textEl = document.getElementById('loadingText');
  if (overlay) {
    if (textEl) textEl.textContent = text;
    overlay.classList.remove('hidden');
  }
}

export function hideLoading() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.classList.add('hidden');
}

export function fmtMoney(cents) {
  return `₪${(cents / 100).toFixed(2)}`;
}

export function validatePrice(price) {
  const num = Number(price);
  if (isNaN(num) || num < 0) return { valid: false, error: 'מחיר חייב להיות מספר חיובי' };
  if (num > 100000) return { valid: false, error: 'מחיר גדול מדי (מקסימום 100000)' };
  return { valid: true, value: Math.round(num * 100) / 100 };
}

export function validateQuantity(qty) {
  const num = Number(qty);
  if (isNaN(num) || num < 0) return { valid: false, error: 'כמות חייבת להיות מספר חיובי' };
  if (num > 10000) return { valid: false, error: 'כמות גדולה מדי (מקסימום 10000)' };
  return { valid: true, value: Math.round(num) };
}

export function validateName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return { valid: false, error: 'שם נדרש' };
  if (trimmed.length > 100) return { valid: false, error: 'שם ארוך מדי (מקסימום 100 תווים)' };
  return { valid: true, value: trimmed };
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function formatTaskDetails(text) {
  if (!text) return '';
  // Make phone numbers clickable
  text = text.replace(/(0\d{1,2}[-]?\d{7})/g, '<a href="tel:$1">$1</a>');
  // Make URLs clickable
  text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  // Make email addresses clickable
  text = text.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, '<a href="mailto:$1">$1</a>');
  return text;
}

export function isTaskOverdue(task) {
  if (!task.endDate || task.status === 'finished' || task.status === 'canceled') return false;
  const endDate = new Date(task.endDate.seconds * 1000);
  const now = new Date();
  return endDate < now;
}

export function getStatusClass(status) {
  const classes = {
    'todo': 'task-status-todo',
    'in_progress': 'task-status-in_progress',
    'finished': 'task-status-finished',
    'canceled': 'task-status-canceled'
  };
  return classes[status] || classes.todo;
}

export function getStatusLabel(status) {
  const labels = {
    'todo': 'לעשות',
    'in_progress': 'בתהליך',
    'finished': 'הושלם',
    'canceled': 'בוטל'
  };
  return labels[status] || labels.todo;
}

export function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

