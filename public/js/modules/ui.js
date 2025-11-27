// UI Module - Navigation, Theme, Modals, and UI Helpers
import appState from '../state.js';
import * as constants from '../constants.js';

// DOM References (will be initialized)
let themeToggle, appLogo;
let navShopping, navTasks, navNotes, navReminders;
let mainView, analyticsView, tasksView, notesView, remindersView;
let shoppingHeader, tasksHeader, notesHeader, remindersHeader;

// Initialize UI module
export function initUI() {
  // Get DOM references
  themeToggle = document.getElementById('themeToggle');
  appLogo = document.getElementById('appLogo');
  navShopping = document.getElementById('navShopping');
  navTasks = document.getElementById('navTasks');
  navNotes = document.getElementById('navNotes');
  navReminders = document.getElementById('navReminders');
  mainView = document.getElementById('mainView');
  analyticsView = document.getElementById('analyticsView');
  tasksView = document.getElementById('tasksView');
  notesView = document.getElementById('notesView');
  remindersView = document.getElementById('remindersView');
  shoppingHeader = document.getElementById('shoppingHeader');
  tasksHeader = document.getElementById('tasksHeader');
  notesHeader = document.getElementById('notesHeader');
  remindersHeader = document.getElementById('remindersHeader');
  
  // Initialize theme
  initTheme();
  
  // Setup navigation
  setupNavigation();
  
  // Setup app logo
  if (appLogo) {
    appLogo.addEventListener('dblclick', () => {
      const current = appState.showingAnalytics;
      appState.showingAnalytics = !current;
      if (appState.showingAnalytics) {
        switchView('analytics');
      } else {
        switchView(appState.currentView);
      }
    });
  }
  
  // Load saved view
  const savedView = localStorage.getItem(constants.VIEW_KEY) || 'shopping';
  switchView(savedView);
}

// Theme management
function initTheme() {
  const saved = localStorage.getItem(constants.THEME_KEY);
  const preferred = saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(preferred);
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = document.body.classList.contains('dark-mode') ? 'light' : 'dark';
      applyTheme(next);
      navigator.vibrate?.(12);
    });
  }
}

function applyTheme(mode) {
  const isDark = mode === 'dark';
  document.body.classList.toggle('dark-mode', isDark);
  const iconEl = document.getElementById('themeIcon');
  if (iconEl) iconEl.textContent = isDark ? '☀️' : '🌙';
  try {
    localStorage.setItem(constants.THEME_KEY, mode);
  } catch(_) {}
}

// Navigation
function setupNavigation() {
  if (navShopping) navShopping.addEventListener('click', () => switchView('shopping'));
  if (navTasks) navTasks.addEventListener('click', () => switchView('tasks'));
  if (navNotes) navNotes.addEventListener('click', () => switchView('notes'));
  if (navReminders) navReminders.addEventListener('click', () => switchView('reminders'));
}

export function switchView(view) {
  appState.setCurrentView(view);
  appState.showingAnalytics = (view === 'analytics');
  
  try {
    localStorage.setItem(constants.VIEW_KEY, view);
  } catch(_) {}
  
  // Hide all views
  if (mainView) mainView.classList.add('hidden');
  if (analyticsView) analyticsView.classList.add('hidden');
  if (tasksView) tasksView.classList.add('hidden');
  if (notesView) notesView.classList.add('hidden');
  if (remindersView) remindersView.classList.add('hidden');
  
  // Hide all category bars
  hideAllCategoryBars();
  
  // Remove active from all nav buttons
  [navShopping, navTasks, navNotes, navReminders].forEach(nav => {
    if (nav) nav.classList.remove('active');
  });
  
  // Hide all headers
  if (shoppingHeader) shoppingHeader.classList.add('hidden');
  if (tasksHeader) tasksHeader.classList.add('hidden');
  if (notesHeader) notesHeader.classList.add('hidden');
  if (remindersHeader) remindersHeader.classList.add('hidden');
  
  // Show appropriate view
  if (view === 'shopping') {
    if (mainView) mainView.classList.remove('hidden');
    if (navShopping) navShopping.classList.add('active');
    if (shoppingHeader) shoppingHeader.classList.remove('hidden');
    showCategoryBar('shoppingCategoriesNav');
  } else if (view === 'tasks') {
    if (tasksView) tasksView.classList.remove('hidden');
    if (navTasks) navTasks.classList.add('active');
    if (tasksHeader) tasksHeader.classList.remove('hidden');
    showCategoryBar('tasksCategoriesNav');
  } else if (view === 'notes') {
    if (notesView) notesView.classList.remove('hidden');
    if (navNotes) navNotes.classList.add('active');
    if (notesHeader) notesHeader.classList.remove('hidden');
    showCategoryBar('notesCategoriesNav');
  } else if (view === 'reminders') {
    if (remindersView) remindersView.classList.remove('hidden');
    if (navReminders) navReminders.classList.add('active');
    if (remindersHeader) remindersHeader.classList.remove('hidden');
    showCategoryBar('remindersCategoriesNav');
  } else if (view === 'analytics') {
    if (analyticsView) analyticsView.classList.remove('hidden');
    hideAllCategoryBars();
  }
  
  // Notify modules of view change
  appState.notify('viewChanged', view);
}

function hideAllCategoryBars() {
  const bars = [
    'shoppingCategoriesNav',
    'tasksCategoriesNav',
    'notesCategoriesNav',
    'remindersCategoriesNav'
  ];
  
  bars.forEach(barId => {
    const bar = document.getElementById(barId);
    if (bar) {
      bar.style.setProperty('display', 'none', 'important');
      bar.style.setProperty('visibility', 'hidden', 'important');
    }
  });
}

function showCategoryBar(barId) {
  const bar = document.getElementById(barId);
  if (bar) {
    bar.style.setProperty('display', 'block', 'important');
    bar.style.setProperty('visibility', 'visible', 'important');
  }
}

// Export for use by other modules
export { switchView };

