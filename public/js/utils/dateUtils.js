// Date utility functions
export function parseDateStr(s) {
  if (!s || typeof s !== 'string') return new Date(); // fallback
  const parts = s.split('-').map(Number);
  if (parts.length !== 3) return new Date(); // fallback
  const [y, m, d] = parts;
  const date = new Date(y, m - 1, d);
  // Validate date is valid
  if (isNaN(date.getTime()) || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    console.warn('Invalid date string:', s);
    return new Date(); // fallback to today
  }
  return date;
}

export function iso(date) {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

export function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

