// Application Constants

export const SWIPE_THRESHOLD = 60;
export const DRAG_TOLERANCE = 15;
export const LONG_PRESS_DURATION = 500;
export const MAX_QUANTITY = 10000;
export const MAX_PRICE = 100000;
export const MAX_NAME_LENGTH = 100;
export const TOAST_DURATION = 2000;
export const TOAST_ERROR_DURATION = 3000;

// LocalStorage Keys
export const TEMPLATES_KEY = 'gsh-templates';
export const THEME_KEY = 'gsh-theme';
export const VIEW_KEY = 'gsh-current-view';
export const SHOPPING_CATEGORY_KEY = 'gsh-shopping-category';
export const TASK_CATEGORY_KEY = 'gsh-task-category';
export const GANTT_VIEW_START_KEY = 'gsh-gantt-view-start';
export const GANTT_VIEW_END_KEY = 'gsh-gantt-view-end';

// Cache Names
export const IMAGE_CACHE = 'gsh-images-v1';

// Preset Templates
export const PRESET_TEMPLATES = [
  {
    id: 'weekend',
    name: 'קניות סוף שבוע',
    items: [
      { name: 'חלה', qty: 2 },
      { name: 'יין לקידוש', qty: 1, note: 'לבחור יין מתוק' },
      { name: 'סלט ירוק', qty: 1, desc: 'מצרכים לסלט: חסה, עגבניות, מלפפונים' },
      { name: 'עוף שלם', qty: 1 },
      { name: 'עוגת שוקולד', qty: 1 }
    ]
  },
  {
    id: 'basics',
    name: 'מצרכים שבועיים בסיסיים',
    items: [
      { name: 'חלב 3%', qty: 2 },
      { name: 'לחם פרוס', qty: 1 },
      { name: 'ביצים', qty: 1, note: 'מגש 12' },
      { name: 'גבינה צהובה', qty: 1 },
      { name: 'ירקות מעורבים', qty: 1 }
    ]
  },
  {
    id: 'hosting',
    name: 'אירוח ערב',
    items: [
      { name: 'פלטת גבינות', qty: 1 },
      { name: 'לחם צרפתי', qty: 2 },
      { name: 'ירקות חתוכים', qty: 1 },
      { name: 'יין לבן', qty: 2 },
      { name: 'פירות טריים', qty: 1 }
    ]
  }
];

