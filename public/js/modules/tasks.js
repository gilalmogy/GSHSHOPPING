import { toast, showLoading, hideLoading } from '/utils/helpers.js';
import { parseDateStr, iso } from '../utils/dateUtils.js';
import { uploadFileAndGetURL } from '../utils/upload.js';

const TASK_CATEGORY_KEY = 'gsh-task-category';
const GANTT_VIEW_START_KEY = 'gsh-gantt-view-start';
const GANTT_VIEW_END_KEY = 'gsh-gantt-view-end';
const GANTT_DIRECTION_KEY = 'gsh-gantt-direction'; // 'ltr' or 'rtl'

let householdRefRef;
let householdId; // Store household ID for storage paths
let firebaseFns;
let srefFn;
let storageRefInstance;
let getCurrentViewFn = () => 'tasks';
let dbInstance = null; // Store db instance for fetching user profiles

let TASK_CATEGORIES = [];
let TASKS = {};
let selectedTaskCategory = null;
let HOUSEHOLD_USERS = {}; // {userId: {id, firstName, lastName, nickname, photoURL, ...}}

let ganttViewStart = null;
let ganttViewEnd = null;
let ganttExpanded = true;
let ganttDirection = 'ltr'; // 'ltr' or 'rtl'

let _tasksUnsub = null;

const dom = {};
const selectors = {
  tasksView: '#tasksView',
  tasksTabList: '#tasksTabList',
  tasksTabGantt: '#tasksTabGantt',
  tasksListView: '#tasksListView',
  tasksGanttView: '#tasksGanttView',
  taskCatTitle: '#taskCatTitle',
  tasksList: '#tasksList',
  tasksCategoriesList: '#tasksCategoriesList',
  taskCatModal: '#taskCatModal',
  taskCatModalTitle: '#taskCatModalTitle',
  taskCatId: '#taskCatId',
  taskCatName: '#taskCatName',
  taskCatPinned: '#taskCatPinned',
  taskCatColor: '#taskCatColor',
  taskCatFile: '#taskCatFile',
  taskCatFileName: '#taskCatFileName',
  taskCatPreview: '#taskCatPreview',
  taskCatSave: '#taskCatSave',
  taskCatDelete: '#taskCatDelete',
  taskEditModal: '#taskEditModal',
  teId: '#teId',
  teName: '#teName',
  teStartDate: '#teStartDate',
  teEndDate: '#teEndDate',
  teResponsibility: '#teResponsibility',
  teResponsibilityBtn: '#teResponsibilityBtn',
  teResponsibilityText: '#teResponsibilityText',
  teResponsibilityDropdown: '#teResponsibilityDropdown',
  teStatus: '#teStatus',
  teCategory: '#teCategory',
  teDetails: '#teDetails',
  teFile: '#teFile',
  teFileName: '#teFileName',
  tePreview: '#tePreview',
  teSave: '#teSave',
  teDelete: '#teDelete',
  addTaskBtn: '#addTaskBtn',
  ganttTimeline: '#ganttTimeline',
  ganttContainer: '#ganttContainer',
  ganttFixedContainer: '#ganttFixedContainer',
  ganttToday: '#ganttToday',
  ganttJumpTo: '#ganttJumpTo',
  ganttPrev: '#ganttPrev',
  ganttNext: '#ganttNext',
  ganttPrevMonth: '#ganttPrevMonth',
  ganttNextMonth: '#ganttNextMonth',
  ganttPrevTask: '#ganttPrevTask',
  ganttNextTask: '#ganttNextTask',
  ganttZoomIn: '#ganttZoomIn',
  ganttZoomOut: '#ganttZoomOut',
  ganttViewToday: '#ganttViewToday',
  ganttViewWeek: '#ganttViewWeek',
  ganttViewMonth: '#ganttViewMonth',
  ganttViewYear: '#ganttViewYear',
  ganttFitAll: '#ganttFitAll',
  ganttDateRange: '#ganttDateRange',
  ganttDirectionToggle: '#ganttDirectionToggle'
};

function normalizeTaskDate(value, options = {}) {
  if (!value) return null;
  const { endOfDay = false } = options;

  let dateObj = null;
  if (value instanceof Date) {
    dateObj = new Date(value);
  } else if (typeof value === 'string') {
    dateObj = parseDateStr(value);
  } else if (typeof value === 'number') {
    dateObj = new Date(value);
  } else if (value?.seconds) {
    dateObj = new Date(value.seconds * 1000);
  } else if (value?.toDate) {
    // Firestore Timestamp - convert to local date
    dateObj = value.toDate();
  }

  if (!dateObj || Number.isNaN(dateObj.getTime())) return null;

  // Extract local date components to avoid timezone issues
  // This ensures we always get the correct local date, regardless of how it was stored
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();
  const day = dateObj.getDate();
  
  // Create a new date using local components at midnight
  const result = new Date(year, month, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  
  return result;
}

export function initTasks({
  householdRef,
  firebase,
  sref,
  storage,
  getCurrentView,
  db
}) {
  householdRefRef = householdRef;
  householdId = householdRef?.id || null; // Extract household ID for storage paths
  firebaseFns = firebase;
  srefFn = sref;
  storageRefInstance = storage;
  getCurrentViewFn = getCurrentView || (() => 'tasks');
  dbInstance = db;
  
  // Load household users (don't await, but ensure it runs)
  loadHouseholdUsers().catch(err => console.error('Failed to load household users:', err));
  
  // Reload users when household changes (if someone joins/leaves)
  if (householdRefRef) {
    firebaseFns.onSnapshot(householdRefRef, (doc) => {
      if (doc.exists()) {
        // Household changed, reload users
        loadHouseholdUsers().catch(err => console.error('Failed to reload household users:', err));
      }
    });
  }

  cacheDom();
  wireEvents();
  loadGanttViewState();
  loadTaskCategories();
  // Initialize with list tab
  switchTasksTab('list');
  
  // Set up view change handler to re-render tasks when view becomes visible
  // Check periodically if we're on tasks view and re-render if needed
  const checkAndRender = () => {
    if (getCurrentViewFn() === 'tasks') {
      // Re-cache DOM in case elements weren't available before
      cacheDom();
      // Ensure tasks are rendered when view is visible
      if (selectedTaskCategory && TASKS[selectedTaskCategory]) {
        renderTasks();
        renderTaskCategories();
      } else if (TASK_CATEGORIES.length > 0) {
        // Re-render categories which will trigger task loading
        renderTaskCategories();
      }
    }
  };
  
  // Check after a short delay to allow DOM to be ready
  setTimeout(checkAndRender, 100);
  // Also check when view changes
  if (typeof window !== 'undefined') {
    window.addEventListener('visibilitychange', () => {
      if (!document.hidden && getCurrentViewFn() === 'tasks') {
        setTimeout(checkAndRender, 50);
      }
    });
  }
  
  // Make renderGantt and gantt view state functions globally accessible for inline scripts
  if (typeof window !== 'undefined') {
    window.renderGantt = renderGantt;
    window.renderTasks = renderTasks;
    window.renderTaskCategories = renderTaskCategories;
    window.switchTasksTab = switchTasksTab;
    window.openTaskEditor = openTaskEditor;
    
    // Create wrapper functions that sync with module variables
    window.loadGanttViewState = function() {
      loadGanttViewState();
      // Sync with global variables if they exist
      if (window.ganttViewStart !== undefined) window.ganttViewStart = ganttViewStart;
      if (window.ganttViewEnd !== undefined) window.ganttViewEnd = ganttViewEnd;
    };
    
    window.saveGanttViewState = saveGanttViewState;
    
    // Make gantt view state variables accessible with getters/setters for synchronization
    Object.defineProperty(window, 'ganttViewStart', {
      get: () => ganttViewStart,
      set: (val) => { ganttViewStart = val; },
      configurable: true
    });
    
    Object.defineProperty(window, 'ganttViewEnd', {
      get: () => ganttViewEnd,
      set: (val) => { ganttViewEnd = val; },
      configurable: true
    });
  }
  
  // Return handleViewChange function for tasks
  return {
    handleViewChange: function(view) {
      if (view === 'tasks') {
        cacheDom();
        renderTaskCategories();
        if (selectedTaskCategory && TASKS[selectedTaskCategory]) {
          renderTasks();
        }
      } else {
        // Hide tasks categories when switching to other views
        const nav = document.getElementById('tasksCategoriesNav');
        if (nav) {
          nav.style.setProperty('display', 'none', 'important');
          nav.style.setProperty('visibility', 'hidden', 'important');
        }
        // Clear categories list to prevent showing wrong categories
        if (dom.tasksCategoriesList) {
          dom.tasksCategoriesList.innerHTML = '';
        }
      }
    }
  };
}

/**
 * Load household members with their user profiles
 */
async function loadHouseholdUsers() {
  if (!householdRefRef || !dbInstance || !firebaseFns) {
    console.warn('Cannot load household users: missing dependencies');
    return;
  }
  
  try {
    // Get household document to get members array
    const householdDoc = await firebaseFns.getDoc(householdRefRef);
    if (!householdDoc.exists()) {
      console.warn('Household document not found');
      return;
    }
    
    const householdData = householdDoc.data();
    const memberIds = householdData.members || [];
    
    if (memberIds.length === 0) {
      HOUSEHOLD_USERS = {};
      return;
    }
    
    // Fetch all user profiles in parallel
    const userPromises = memberIds.map(async (userId) => {
      try {
        const userRef = firebaseFns.doc(dbInstance, 'users', userId);
        const userDoc = await firebaseFns.getDoc(userRef);
        if (userDoc.exists()) {
          return { id: userId, ...userDoc.data() };
        }
        return null;
      } catch (error) {
        console.error(`Error loading user ${userId}:`, error);
        return null;
      }
    });
    
    const users = await Promise.all(userPromises);
    
    // Build users map
    HOUSEHOLD_USERS = {};
    users.forEach(user => {
      if (user) {
        HOUSEHOLD_USERS[user.id] = user;
      }
    });
    
    // Update responsibility dropdown if task editor is open
    updateResponsibilityDropdown();
  } catch (error) {
    console.error('Error loading household users:', error);
  }
}

/**
 * Get user display name
 */
function getUserDisplayName(user) {
  if (!user) return '';
  const parts = [];
  if (user.firstName) parts.push(user.firstName);
  if (user.lastName) parts.push(user.lastName);
  if (parts.length === 0 && user.nickname) parts.push(user.nickname);
  if (parts.length === 0) parts.push('משתמש');
  return parts.join(' ');
}

/**
 * Update responsibility dropdown with household users
 */
function updateResponsibilityDropdown() {
  const dropdown = dom.teResponsibilityDropdown;
  const hiddenInput = dom.teResponsibility;
  if (!dropdown || !hiddenInput) return;
  
  // Clear existing options
  dropdown.innerHTML = '<button type="button" class="w-full text-right px-3 py-2 hover:bg-gray-100 flex items-center gap-2" data-value="" style="color:var(--text);" onmouseover="this.style.background=\'var(--hover-bg)\'" onmouseout="this.style.background=\'transparent\'"><span>בחר</span></button>';
  
  // Check if users are loaded
  const users = Object.values(HOUSEHOLD_USERS);
  if (users.length === 0) {
    // Users not loaded yet, try loading them
    loadHouseholdUsers().then(() => {
      // Retry after loading
      updateResponsibilityDropdown();
    }).catch(err => console.error('Failed to load users for dropdown:', err));
    return;
  }
  
  // Add household users with chatheads
  users.forEach(user => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'w-full text-right px-3 py-2 hover:bg-gray-100 flex items-center gap-2';
    button.style.color = 'var(--text)';
    button.dataset.value = user.id;
    button.onmouseover = function() { this.style.background = 'var(--hover-bg)'; };
    button.onmouseout = function() { this.style.background = 'transparent'; };
    
    const photoURL = user.photoURL || '/GSH.png';
    button.innerHTML = `
      <img src="${photoURL}" alt="${getUserDisplayName(user)}" class="w-6 h-6 rounded-full object-cover flex-shrink-0" style="border: 1px solid var(--border);" onerror="this.src='/GSH.png'" />
      <span class="flex-1 text-right">${getUserDisplayName(user)}</span>
    `;
    
    button.addEventListener('click', () => {
      updateResponsibilityDisplay(user.id);
      dropdown.classList.add('hidden');
    });
    
    dropdown.appendChild(button);
  });
  
  // Add click handler for "בחר" option
  const clearBtn = dropdown.querySelector('button[data-value=""]');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      updateResponsibilityDisplay('');
      dropdown.classList.add('hidden');
    });
  }
  
  console.log('Updated responsibility dropdown with', users.length, 'users');
}

/**
 * Update responsibility display button
 */
function updateResponsibilityDisplay(selectedUserId) {
  if (!dom.teResponsibility || !dom.teResponsibilityText) return;
  
  selectedUserId = selectedUserId || dom.teResponsibility.value || '';
  dom.teResponsibility.value = selectedUserId;
  
  if (selectedUserId && HOUSEHOLD_USERS[selectedUserId]) {
    const user = HOUSEHOLD_USERS[selectedUserId];
    const photoURL = user.photoURL || '/GSH.png';
    dom.teResponsibilityText.innerHTML = `<img src="${photoURL}" alt="${getUserDisplayName(user)}" class="w-4 h-4 rounded-full object-cover inline-block mr-1" style="border: 1px solid var(--border); vertical-align: middle;" onerror="this.src='/GSH.png'" /> ${getUserDisplayName(user)}`;
  } else {
    dom.teResponsibilityText.textContent = 'בחר';
  }
}

function cacheDom() {
  Object.entries(selectors).forEach(([key, selector]) => {
    dom[key] = document.querySelector(selector);
  });
}

let currentTasksTab = 'list';

function wireEvents() {
  dom.addTaskBtn?.addEventListener('click', () => openTaskEditor(null));
  
  // Single toggle button for list / timeline
  if (dom.tasksTabList && dom.tasksTabGantt) {
    const toggleBtn = dom.tasksTabList; // Use list button as the single toggle
    // Hide the separate gantt button from UI but keep reference
    dom.tasksTabGantt.style.display = 'none';
    
    const applyToggleState = () => {
      if (currentTasksTab === 'list') {
        toggleBtn.textContent = 'תצוגת רשימה';
        toggleBtn.style.background = 'var(--accent)';
        toggleBtn.style.color = 'var(--bg)';
        toggleBtn.style.borderColor = 'var(--accent)';
      } else {
        toggleBtn.textContent = 'ציר זמן';
        toggleBtn.style.background = 'transparent';
        toggleBtn.style.color = 'var(--text)';
        toggleBtn.style.borderColor = 'var(--border)';
      }
    };
    
    toggleBtn.addEventListener('click', () => {
      const nextTab = currentTasksTab === 'list' ? 'gantt' : 'list';
      switchTasksTab(nextTab);
      applyToggleState();
    });
    
    // Initialize state
    applyToggleState();
  }

  document
    .querySelectorAll('#taskCatModal [data-close]')
    .forEach(el => el.addEventListener('click', () => dom.taskCatModal?.classList.remove('show')));

  document
    .querySelectorAll('#taskEditModal [data-close]')
    .forEach(el => el.addEventListener('click', () => dom.taskEditModal?.classList.remove('show')));

  dom.taskCatFile?.addEventListener('change', () => {
    dom.taskCatFileName.textContent = dom.taskCatFile.files?.[0]?.name || 'לא נבחרה תמונה';
    if (dom.taskCatFile.files?.[0]) dom.taskCatPreview.src = URL.createObjectURL(dom.taskCatFile.files[0]);
  });

  dom.taskCatSave?.addEventListener('click', handleTaskCategorySave);
  dom.taskCatDelete?.addEventListener('click', handleTaskCategoryDelete);
  
  // Task image upload
  dom.teFile?.addEventListener('change', () => {
    dom.teFileName.textContent = dom.teFile.files?.[0]?.name || 'לא נבחרה תמונה';
    if (dom.teFile.files?.[0]) {
      dom.tePreview.src = URL.createObjectURL(dom.teFile.files[0]);
      dom.tePreview.classList.remove('hidden');
    } else {
      dom.tePreview.classList.add('hidden');
    }
  });
  
  // Task category color selection
  dom.taskCatModal?.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => selectTaskCategoryColor(btn.dataset.color));
  });
  
  dom.teSave?.addEventListener('click', handleTaskSave);
  dom.teDelete?.addEventListener('click', handleTaskDelete);
  
  // Custom responsibility dropdown toggle
  dom.teResponsibilityBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = dom.teResponsibilityDropdown;
    if (dropdown) {
      dropdown.classList.toggle('hidden');
    }
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (dom.teResponsibilityDropdown && !dom.teResponsibilityBtn?.contains(e.target) && !dom.teResponsibilityDropdown.contains(e.target)) {
      dom.teResponsibilityDropdown.classList.add('hidden');
    }
  });

  dom.ganttToday?.addEventListener('click', ganttJumpToToday);
  dom.ganttJumpTo?.addEventListener('click', ganttJumpToDatePrompt);
  dom.ganttPrev?.addEventListener('click', () => ganttNavigate('prev'));
  dom.ganttNext?.addEventListener('click', () => ganttNavigate('next'));
  dom.ganttPrevMonth?.addEventListener('click', () => ganttNavigateMonth('prev'));
  dom.ganttNextMonth?.addEventListener('click', () => ganttNavigateMonth('next'));
  dom.ganttPrevTask?.addEventListener('click', () => ganttJumpToTask('prev'));
  dom.ganttNextTask?.addEventListener('click', () => ganttJumpToTask('next'));
  dom.ganttZoomIn?.addEventListener('click', () => ganttZoom('in'));
  dom.ganttZoomOut?.addEventListener('click', () => ganttZoom('out'));
  dom.ganttViewToday?.addEventListener('click', ganttViewTodayPreset);
  dom.ganttViewWeek?.addEventListener('click', ganttViewWeekPreset);
  dom.ganttViewMonth?.addEventListener('click', ganttViewMonthPreset);
  dom.ganttViewYear?.addEventListener('click', ganttViewYearPreset);
  dom.ganttFitAll?.addEventListener('click', ganttFitAllTasks);
  dom.ganttDirectionToggle?.addEventListener('click', toggleGanttDirection);
  
  // Keyboard shortcuts for gantt navigation
  setupGanttKeyboardShortcuts();
  
  // Set up scroll listener for infinite scrolling
  setupGanttScrollExtension();
}

function loadTaskCategories() {
  const taskCatsCol = firebaseFns.collection(householdRefRef, 'taskCategories');
  firebaseFns
    .getDocs(firebaseFns.query(taskCatsCol, firebaseFns.orderBy('order', 'asc')))
    .then(qs => {
      TASK_CATEGORIES = qs.docs.map(normalizeTaskCategory);
      renderTaskCategories();
      const saved = localStorage.getItem(TASK_CATEGORY_KEY);
      if (saved && TASK_CATEGORIES.find(c => c.id === saved)) {
        selectTaskCategory(saved);
      } else if (!selectedTaskCategory && TASK_CATEGORIES.length) {
        selectTaskCategory(TASK_CATEGORIES[0].id);
      }
    })
    .catch(console.error);

  firebaseFns.onSnapshot(
    firebaseFns.query(taskCatsCol, firebaseFns.orderBy('order', 'asc')),
    qs => {
      TASK_CATEGORIES = qs.docs.map(normalizeTaskCategory);
      renderTaskCategories();
      const saved = localStorage.getItem(TASK_CATEGORY_KEY);
      if (saved && TASK_CATEGORIES.find(c => c.id === saved)) {
        selectTaskCategory(saved);
      } else if (!selectedTaskCategory && TASK_CATEGORIES.length) {
        selectTaskCategory(TASK_CATEGORIES[0].id);
      }
    }
  );
}

function normalizeTaskCategory(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    label: data.label,
    color: data.color || '#3b82f6',
    img: data.img || null,
    pinned: !!data.pinned,
    order: data.order ?? 0
  };
}

function renderTaskCategories() {
  const currentCat = TASK_CATEGORIES.find(c => c.id === selectedTaskCategory);
  if (dom.taskCatTitle) dom.taskCatTitle.textContent = currentCat ? currentCat.label : 'קטגוריות משימות';

  const listEl = dom.tasksCategoriesList;
  if (!listEl) {
    // DOM might not be cached yet, try again
    cacheDom();
    if (!dom.tasksCategoriesList) return;
  }

  // Only show categories when tasks view is active
    const nav = document.getElementById('tasksCategoriesNav');
  if (getCurrentViewFn() !== 'tasks') {
    if (nav) {
      nav.style.setProperty('display', 'none', 'important');
      nav.style.setProperty('visibility', 'hidden', 'important');
    }
    // Still render categories so data is ready when view is shown, but don't display
    listEl.innerHTML = '';
    return;
  }

  if (nav) {
    nav.style.setProperty('display', 'block', 'important');
    nav.style.setProperty('visibility', 'visible', 'important');
  }

  listEl.innerHTML = '';
  TASK_CATEGORIES.forEach(cat => {
    const holder = document.createElement('button');
    holder.className = 'cat flex flex-col items-center w-16 relative';
    holder.dataset.id = cat.id;
    const count = (TASKS[cat.id] || []).filter(t => !['finished', 'canceled'].includes(t.status)).length;
    holder.innerHTML = `
      ${cat.pinned ? '<span class="absolute top-0 left-1 text-amber-500 text-xs">★</span>' : ''}
      ${count > 0 ? `<span class="badge">${count}</span>` : '<span class="badge hidden" style="display:none;visibility:hidden;"></span>'}
      ${cat.img ? `
        <img class="w-14 h-14 rounded-full border object-cover ${cat.id === selectedTaskCategory ? 'selected' : ''}" 
             src="${cat.img}" alt="">
      ` : `
        <div class="w-14 h-14 rounded-full border-2 flex items-center justify-center ${cat.id === selectedTaskCategory ? 'selected' : ''}" style="border-color:${cat.color};background:${cat.color}20;">
          <div class="w-10 h-10 rounded-full" style="background:${cat.color};"></div>
        </div>
      `}
      <span class="text-[11px] mt-1 text-center truncate">${cat.label || ''}</span>
    `;
    let clickTimer = null;
    holder.addEventListener('click', () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        return;
      }
      clickTimer = setTimeout(() => {
        selectTaskCategory(cat.id);
        clickTimer = null;
      }, 250);
    });
    holder.addEventListener('dblclick', e => {
      e.preventDefault();
      e.stopPropagation();
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      openTaskCategoryEditor('edit', cat.id);
    });
    holder.addEventListener('contextmenu', e => {
      e.preventDefault();
      openTaskEditor(null);
    });
    listEl.appendChild(holder);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'cat flex flex-col items-center w-16';
  addBtn.innerHTML = `<img class="w-14 h-14 rounded-full border" src="/add.png" alt=""><span class="text-[11px] mt-1">הוסף</span>`;
  addBtn.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    openTaskCategoryEditor('create');
  });
  listEl.appendChild(addBtn);

  renderTasks();
  // Only render gantt if we're on the gantt tab
  if (currentTasksTab === 'gantt') {
  renderGantt();
  }
}

function selectTaskCategory(catId) {
  selectedTaskCategory = catId;
  try {
    localStorage.setItem(TASK_CATEGORY_KEY, catId || '');
  } catch (_) {}
  renderTaskCategories();
  attachTasksListener(catId);
}

function attachTasksListener(catId) {
  if (!catId) return;
  if (_tasksUnsub) {
    try { _tasksUnsub(); } catch (_) {}
  }
  const tasksCol = firebaseFns.collection(householdRefRef, 'tasks');
  _tasksUnsub = firebaseFns.onSnapshot(
    firebaseFns.query(tasksCol, firebaseFns.where('category', '==', catId)),
    qs => {
      TASKS[catId] = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      TASKS[catId].sort(sortTasks);
      // Always render tasks when data arrives
      // Use setTimeout to ensure DOM is ready and view might be visible
      setTimeout(() => {
      renderTasks();
        renderTaskCategories(); // Update category badges
        if (currentTasksTab === 'gantt') {
      renderGantt();
        }
      }, 0);
    }
  );
}

function sortTasks(a, b) {
  const overdueDiff = (isTaskOverdue(b) ? 1 : 0) - (isTaskOverdue(a) ? 1 : 0);
  if (overdueDiff) return overdueDiff;
  const order = { todo: 0, in_progress: 1, finished: 2, canceled: 3 };
  const statusDiff = (order[a.status] ?? 0) - (order[b.status] ?? 0);
  if (statusDiff) return statusDiff;
  const aDate = normalizeTaskDate(a.startDate) || new Date(0);
  const bDate = normalizeTaskDate(b.startDate) || new Date(0);
  return aDate - bDate;
}

function switchTasksTab(tab) {
  currentTasksTab = tab;
  
  if (tab === 'list') {
    dom.tasksListView?.classList.remove('hidden');
    dom.tasksGanttView?.classList.add('hidden');
  } else {
    dom.tasksListView?.classList.add('hidden');
    dom.tasksGanttView?.classList.remove('hidden');
    
    // Ensure DOM is cached before rendering
    if (!dom.ganttTimeline) {
      cacheDom();
    }
    
    // Render gantt when switching to gantt tab
    // Use double requestAnimationFrame to ensure the view is fully visible before rendering
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
      // Re-cache DOM elements in case they weren't available before
      if (!dom.ganttTimeline) {
        cacheDom();
      }
      
        // Double-check that we're still on the gantt tab and view is visible
        if (currentTasksTab === 'gantt' && dom.tasksGanttView && !dom.tasksGanttView.classList.contains('hidden')) {
      // Always initialize gantt view dates if not set or invalid
      if (!ganttViewStart || !ganttViewEnd || isNaN(ganttViewStart.getTime()) || isNaN(ganttViewEnd.getTime())) {
        // Default to current week on first load
        setCurrentWeekRange();
      }
      // Render gantt
        renderGantt();
      // Auto-scroll to current week after initial render (only on first load)
      // Check if this is first load by checking if dates were just initialized
      const wasInitialized = !ganttViewStart || !ganttViewEnd;
      if (wasInitialized) {
        setTimeout(() => {
          if (currentTasksTab === 'gantt') {
            const now = new Date();
            now.setHours(0, 0, 0, 0);
            scrollToDate(now);
          }
        }, 500);
      }
      // Ensure scroll extension is set up
      setupGanttScrollExtension();
        }
      });
    });
  }
}

function renderTasks() {
  const list = dom.tasksList;
  if (!list) {
    // DOM might not be cached yet, try again
    cacheDom();
    if (!dom.tasksList) return;
  }
  const tasks = selectedTaskCategory ? (TASKS[selectedTaskCategory] || []) : [];

  // Ensure the list has the correct flex layout for spacing
  list.className = 'flex flex-col gap-3 mb-4';
  list.style.display = 'flex';
  list.style.flexDirection = 'column';
  list.style.gap = '12px';

  list.innerHTML = '';
  if (!selectedTaskCategory) {
    list.innerHTML = '<div class="p-4 text-center" style="color:var(--muted);">בחר קטגוריה</div>';
    return;
  }
  if (!tasks.length) {
    list.innerHTML = '<div class="p-4 text-center" style="color:var(--muted);">אין משימות בקטגוריה זו</div>';
    return;
  }

  tasks.forEach((task, index) => {
    const overdue = isTaskOverdue(task);
    const isFinished = ['finished','canceled'].includes(task.status);
    const card = document.createElement('div');
    card.className = `row cursor-pointer task-row ${overdue ? 'task-overdue' : ''} ${isFinished ? 'opacity-70' : ''}`;
    // Spacing is handled by parent gap
    card.dataset.id = task.id;

    const taskName = task.name || 'ללא שם';
    const startDate = normalizeTaskDate(task.startDate);
    const endDate = normalizeTaskDate(task.endDate);
    // Get responsibility user info
    const responsibleUser = task.responsibility ? HOUSEHOLD_USERS[task.responsibility] : null;
    const responsibilityName = responsibleUser ? getUserDisplayName(responsibleUser) : '';
    const responsibilityPhoto = responsibleUser?.photoURL || '/GSH.png';
    const statusLabel = getStatusLabel(task.status);
    const details = task.details ? formatTaskDetails(task.details) : '';

    card.innerHTML = `
      <div class="flex items-center justify-between gap-2 mb-1">
        ${taskName ? `<div class="font-semibold text-sm ${isFinished ? 'line-through' : ''}">${taskName}</div>` : ''}
        <div class="text-xs px-2 py-0.5 rounded" style="background:var(--card); color:var(--text);">${statusLabel}</div>
      </div>
      ${task.img ? `<img src="${task.img}" class="w-full rounded border object-cover mb-2" style="max-height:150px; border-color:var(--border);" alt="${taskName}">` : ''}
      ${startDate ? `<div class="text-xs mb-0.5" style="color:var(--muted);">מתחיל: ${startDate.toLocaleDateString('he-IL')}</div>` : ''}
      ${endDate ? `<div class="text-xs mb-0.5 ${overdue ? 'font-semibold' : ''}" style="color:${overdue ? '#ef4444' : 'var(--muted)'};">${overdue ? '⚠️ ' : ''}מסתיים: ${endDate.toLocaleDateString('he-IL')}</div>` : ''}
      ${responsibilityName ? `<div class="flex items-center gap-1.5 text-xs mb-0.5" style="color:var(--muted);">
        <span>אחריות:</span>
        <div class="flex items-center gap-1">
          <img src="${responsibilityPhoto}" alt="${responsibilityName}" class="w-4 h-4 rounded-full object-cover" style="border: 1px solid var(--border);" onerror="this.src='/GSH.png'" />
          <span>${responsibilityName}</span>
        </div>
      </div>` : ''}
      ${details ? `<div class="task-details text-xs mt-2 p-2 rounded" style="background:var(--card); color:var(--text);">${details}</div>` : ''}
    `;

    card.addEventListener('click', e => {
      if (e.target.tagName === 'A') return;
      openTaskEditor(task);
    });
    list.appendChild(card);
  });
  
  // Ensure spacing is maintained
  if (list.children.length > 0) {
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '12px';
  }
}

function formatTaskDetails(text) {
  if (!text) return '';
  let output = text;
  output = output.replace(/(\+?972|0)?-?([0-9]{2})-?([0-9]{3})-?([0-9]{4})/g, '<a href="tel:$&">$&</a>');
  output = output.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
  output = output.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g, '<a href="mailto:$1">$1</a>');
  return output;
}

function getStatusLabel(status) {
  const labels = {
    todo: 'לעשות',
    in_progress: 'בתהליך',
    finished: 'הושלם',
    canceled: 'בוטל'
  };
  return labels[status] || labels.todo;
}

function isTaskOverdue(task) {
  if (!task.endDate || ['finished', 'canceled'].includes(task.status)) return false;
  const end = new Date(task.endDate.seconds * 1000);
  end.setHours(23, 59, 59);
  return new Date() > end;
}

function openTaskCategoryEditor(mode = 'create', catId = null) {
  if (!dom.taskCatModal) return;
  dom.taskCatId.value = catId || '';
  dom.taskCatName.value = '';
  dom.taskCatPreview.src = '/cat.png';
  dom.taskCatPinned.checked = false;
  dom.taskCatFile.value = '';
  dom.taskCatFileName.textContent = 'לא נבחרה תמונה';
  dom.taskCatColor.value = '#3b82f6';
  dom.taskCatDelete.classList.toggle('hidden', mode !== 'edit');
  dom.taskCatModalTitle.textContent = mode === 'edit' ? 'עריכת קטגוריית משימות' : 'קטגוריית משימות חדשה';

  // Reset color selection
  dom.taskCatModal.querySelectorAll('.color-option').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2');
    btn.style.borderColor = 'var(--border)';
  });

  if (mode === 'edit' && catId) {
    const cat = TASK_CATEGORIES.find(c => c.id === catId);
    if (cat) {
      dom.taskCatName.value = cat.label || '';
      dom.taskCatPreview.src = cat.img || '/cat.png';
      dom.taskCatPinned.checked = !!cat.pinned;
      dom.taskCatColor.value = cat.color || '#3b82f6';
    }
  }

  // Set default color button as selected
  const defaultColorBtn = dom.taskCatModal.querySelector(`.color-option[data-color="${dom.taskCatColor.value}"]`);
  if (defaultColorBtn) {
    defaultColorBtn.classList.add('ring-2', 'ring-offset-2');
    defaultColorBtn.style.borderColor = dom.taskCatColor.value;
  }

  // Ensure color option buttons are wired up
  dom.taskCatModal.querySelectorAll('.color-option').forEach(btn => {
    // Remove existing listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => selectTaskCategoryColor(newBtn.dataset.color));
  });

  dom.taskCatModal.classList.add('show');
}

function selectTaskCategoryColor(color) {
  dom.taskCatColor.value = color;
  dom.taskCatModal?.querySelectorAll('.color-option').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2');
    btn.style.borderColor = 'var(--border)';
    if (btn.dataset.color === color) {
      btn.classList.add('ring-2', 'ring-offset-2');
      btn.style.borderColor = color;
    }
  });
}

function handleTaskCategorySave() {
  const name = (dom.taskCatName.value || '').trim();
  if (!name) {
    toast('צריך שם קטגוריה');
    return;
  }
  const pinned = dom.taskCatPinned.checked;
  const color = dom.taskCatColor.value || '#3b82f6';
  const id = dom.taskCatId.value || null;
  const now = firebaseFns.serverTimestamp();
  const data = { label: name, pinned, color, updatedAt: now };
  const catsCol = firebaseFns.collection(householdRefRef, 'taskCategories');

  showLoading('שומר קטגוריה...');
  (async () => {
    try {
      if (id) {
        await firebaseFns.setDoc(firebaseFns.doc(householdRefRef, 'taskCategories', id), data, { merge: true });
        if (dom.taskCatFile.files?.[0]) {
          const path = `households/${householdId}/taskCategories/${id}-${Date.now()}.jpg`;
          const uploadRef = await uploadFileAndGetURL(srefFn(storageRefInstance, path), dom.taskCatFile.files[0]);
          const url = await firebaseFns.getDownloadURL(uploadRef);
          await firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'taskCategories', id), { img: url, updatedAt: firebaseFns.serverTimestamp() });
        }
      } else {
        const ref = await firebaseFns.addDoc(catsCol, { ...data, order: Date.now(), createdAt: now, img: null });
        if (dom.taskCatFile.files?.[0]) {
          const path = `households/${householdId}/taskCategories/${ref.id}-${Date.now()}.jpg`;
          const uploadRef = await uploadFileAndGetURL(srefFn(storageRefInstance, path), dom.taskCatFile.files[0]);
          const url = await firebaseFns.getDownloadURL(uploadRef);
          await firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'taskCategories', ref.id), { img: url, updatedAt: firebaseFns.serverTimestamp() });
        }
        selectTaskCategory(ref.id);
      }
      dom.taskCatModal.classList.remove('show');
      toast('קטגוריה נשמרה בהצלחה');
    } catch (e) {
      console.error(e);
      toast('שגיאה בשמירת קטגוריה', 3000);
    } finally {
      hideLoading();
    }
  })();
}

function handleTaskCategoryDelete() {
  const id = dom.taskCatId.value;
  if (!id) return;
  if (!confirm('למחוק את הקטגוריה?')) return;
  showLoading('מוחק קטגוריה...');
  firebaseFns.deleteDoc(firebaseFns.doc(householdRefRef, 'taskCategories', id))
    .then(() => {
      dom.taskCatModal.classList.remove('show');
      toast('קטגוריה נמחקה');
    })
    .catch(e => {
      console.error(e);
      toast('שגיאה במחיקה', 3000);
    })
    .finally(hideLoading);
}

function openTaskEditor(task) {
  if (!dom.taskEditModal) return;
  dom.teId.value = task?.id || '';
  dom.teName.value = task?.name || '';
  
  // Format dates using local date components to avoid timezone shifts
  const formatDateForInput = (timestamp) => {
    if (!timestamp) return '';
    let date;
    if (timestamp.toDate) {
      // Firestore Timestamp
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      // Firestore Timestamp-like object with seconds
      date = new Date(timestamp.seconds * 1000);
    } else if (timestamp instanceof Date) {
      // Already a Date object
      date = timestamp;
    } else {
      return '';
    }
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  dom.teStartDate.value = task?.startDate ? formatDateForInput(task.startDate) : '';
  dom.teEndDate.value = task?.endDate ? formatDateForInput(task.endDate) : '';
  dom.teResponsibility.value = task?.responsibility || '';
  dom.teStatus.value = task?.status || 'todo';
  dom.teDetails.value = task?.details || '';
  dom.teDelete.classList.toggle('hidden', !task);
  
  // Reset image fields
  dom.teFile.value = '';
  dom.teFileName.textContent = 'לא נבחרה תמונה';
  if (task?.img) {
    dom.tePreview.src = task.img;
    dom.tePreview.classList.remove('hidden');
  } else {
    dom.tePreview.classList.add('hidden');
  }

  dom.teCategory.innerHTML = '';
  TASK_CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.label || '';
    if ((task?.category || selectedTaskCategory) === cat.id) opt.selected = true;
    dom.teCategory.appendChild(opt);
  });

  // Ensure users are loaded before showing dropdown
  if (Object.keys(HOUSEHOLD_USERS).length === 0) {
    // Users not loaded yet, wait for them
    loadHouseholdUsers().then(() => {
      updateResponsibilityDropdown();
      updateResponsibilityDisplay(task?.responsibility);
    }).catch(err => console.error('Failed to load users:', err));
  } else {
    updateResponsibilityDropdown();
    updateResponsibilityDisplay(task?.responsibility);
  }

  dom.taskEditModal.classList.add('show');
}

function handleTaskSave() {
  const name = (dom.teName.value || '').trim();
  if (!name) {
    toast('צריך שם משימה');
    return;
  }
  const category = dom.teCategory.value || selectedTaskCategory;
  if (!category) {
    toast('בחר קטגוריה');
    return;
  }
  const data = {
    name,
    category,
    responsibility: dom.teResponsibility.value || null,
    status: dom.teStatus.value || 'todo',
    details: dom.teDetails.value?.trim() || null,
    updatedAt: firebaseFns.serverTimestamp()
  };

  // Handle start date - use current date if not provided
  let startDateObj = null;
  if (dom.teStartDate.value) {
    // Parse date string (YYYY-MM-DD) explicitly to avoid timezone issues
    const dateParts = dom.teStartDate.value.split('-').map(Number);
    if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
      // Create date in local timezone at midnight
      startDateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 0, 0, 0, 0);
      if (!isNaN(startDateObj.getTime())) {
        data.startDate = firebaseFns.Timestamp.fromDate(startDateObj);
      }
    }
  }
  
  // If no start date provided, use current date
  if (!startDateObj || !data.startDate) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    startDateObj = new Date(now);
    data.startDate = firebaseFns.Timestamp.fromDate(now);
  }

  // Handle end date - use start date if not provided
  if (dom.teEndDate.value) {
    // Parse date string (YYYY-MM-DD) explicitly to avoid timezone issues
    const dateParts = dom.teEndDate.value.split('-').map(Number);
    if (dateParts.length === 3 && !isNaN(dateParts[0]) && !isNaN(dateParts[1]) && !isNaN(dateParts[2])) {
      // Create date in local timezone at end of day
      const endDateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2], 23, 59, 59, 999);
      if (!isNaN(endDateObj.getTime())) {
        data.endDate = firebaseFns.Timestamp.fromDate(endDateObj);
  } else {
        // Invalid end date, use start date
        const endDateDefault = new Date(startDateObj);
        endDateDefault.setHours(23, 59, 59, 999);
        data.endDate = firebaseFns.Timestamp.fromDate(endDateDefault);
      }
    } else {
      // Invalid end date, use start date
      const endDateDefault = new Date(startDateObj);
      endDateDefault.setHours(23, 59, 59, 999);
      data.endDate = firebaseFns.Timestamp.fromDate(endDateDefault);
    }
  } else {
    // No end date provided, use start date
    const endDateDefault = new Date(startDateObj);
    endDateDefault.setHours(23, 59, 59, 999);
    data.endDate = firebaseFns.Timestamp.fromDate(endDateDefault);
  }

  const tasksCol = firebaseFns.collection(householdRefRef, 'tasks');

  showLoading('שומר משימה...');
  (async () => {
    try {
      let taskId = dom.teId.value;
      if (taskId) {
        await firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'tasks', taskId), data);
      } else {
        const ref = await firebaseFns.addDoc(tasksCol, { ...data, createdAt: firebaseFns.serverTimestamp() });
        taskId = ref.id;
      }
      
      // Upload image if provided
      if (dom.teFile.files?.[0]) {
        showLoading('מעלה תמונה...');
        const path = `households/${householdId}/tasks/${taskId}-${Date.now()}.jpg`;
        const uploadRef = await uploadFileAndGetURL(srefFn(storageRefInstance, path), dom.teFile.files[0]);
        const url = await firebaseFns.getDownloadURL(uploadRef);
        await firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'tasks', taskId), { img: url, updatedAt: firebaseFns.serverTimestamp() });
      }
      
    dom.taskEditModal.classList.remove('show');
      toast(taskId === dom.teId.value ? 'משימה עודכנה' : 'משימה נוספה');
    } catch (e) {
      console.error(e);
      toast('שגיאה בשמירת משימה', 3000);
    } finally {
      hideLoading();
    }
  })();
}

function handleTaskDelete() {
  const id = dom.teId.value;
  if (!id) return;
  if (!confirm('למחוק את המשימה?')) return;
  showLoading('מוחק משימה...');
  firebaseFns.deleteDoc(firebaseFns.doc(householdRefRef, 'tasks', id))
    .then(() => {
      dom.taskEditModal.classList.remove('show');
      toast('משימה נמחקה');
    })
    .catch(e => {
      console.error(e);
      toast('שגיאה במחיקה', 3000);
    })
    .finally(hideLoading);
}

function renderGantt() {
  const timeline = dom.ganttTimeline;
  if (!timeline) {
    console.warn('Gantt timeline element not found');
    return;
  }
  // Use saved direction preference
  timeline.setAttribute('dir', ganttDirection);
  timeline.style.direction = ganttDirection;
  dom.ganttContainer?.setAttribute('dir', ganttDirection);
  dom.ganttContainer?.style.setProperty('direction', ganttDirection, 'important');
  dom.ganttFixedContainer?.setAttribute('dir', ganttDirection);
  dom.ganttFixedContainer?.style.setProperty('direction', ganttDirection, 'important');

  // Only render content if we're on the gantt tab and view is visible
  if (currentTasksTab !== 'gantt') {
    return;
  }
  
  if (dom.tasksGanttView?.classList.contains('hidden')) {
    return;
  }

  const msPerDay = 86400000;
  const now = new Date();

  const allTasks = Object.values(TASKS)
    .flat()
    .filter(task => normalizeTaskDate(task.startDate) || normalizeTaskDate(task.endDate));

  // Always initialize view dates if not set
  if (!ganttViewStart || !ganttViewEnd) {
    const taskDates = allTasks
      .flatMap(task => [normalizeTaskDate(task.startDate), normalizeTaskDate(task.endDate)])
      .filter(Boolean)
      .map(d => d.getTime());

    if (taskDates.length) {
      const minDate = new Date(Math.min(...taskDates));
      const maxDate = new Date(Math.max(...taskDates));
      minDate.setHours(0, 0, 0, 0);
      maxDate.setHours(0, 0, 0, 0);
      
      // Use millisecond arithmetic for reliable date calculations
      ganttViewStart = new Date(minDate.getTime() - (3 * msPerDay));
      ganttViewStart.setHours(0, 0, 0, 0);
      
      ganttViewEnd = new Date(maxDate.getTime() + (3 * msPerDay));
      ganttViewEnd.setHours(23, 59, 59, 999);
    } else {
      now.setHours(0, 0, 0, 0);
      
      // Use millisecond arithmetic for reliable date calculations
      ganttViewStart = new Date(now.getTime() - (7 * msPerDay));
      ganttViewStart.setHours(0, 0, 0, 0);

      ganttViewEnd = new Date(now.getTime() + (30 * msPerDay));
      ganttViewEnd.setHours(23, 59, 59, 999);
    }
  }

  const start = normalizeTaskDate(ganttViewStart) || normalizeTaskDate(now);
  const end = normalizeTaskDate(ganttViewEnd, { endOfDay: true }) || normalizeTaskDate(now, { endOfDay: true });

  if (!start || !end || end <= start) {
    timeline.innerHTML = '<div class="p-4 text-center" style="color:var(--muted); min-height: 200px; display: flex; align-items: center; justify-content: center;">לא ניתן להציג ציר זמן</div>';
    return;
  }

  const days = [];
  // Generate days array, ensuring each day is normalized to midnight
  // Use millisecond arithmetic to reliably handle year/month boundaries
  const daysStartTime = start.getTime();
  const daysEndTime = end.getTime();
  
  for (let currentTime = daysStartTime; currentTime <= daysEndTime; currentTime += msPerDay) {
    const dayCopy = new Date(currentTime);
    dayCopy.setHours(0, 0, 0, 0); // Normalize to midnight for consistency
    days.push(dayCopy);
  }

  if (!days.length) {
    timeline.innerHTML = '<div class="p-4 text-center" style="color:var(--muted); min-height: 200px; display: flex; align-items: center; justify-content: center;">לא ניתן להציג ציר זמן</div>';
    return;
  }

  timeline.innerHTML = '';

  // Set timeline width dynamically based on number of days
  // Each day gets at least 50px width, but allow it to grow naturally
  const minDayWidth = 50;
  const calculatedWidth = Math.max(1200, days.length * minDayWidth);
  timeline.style.width = `${calculatedWidth}px`;
  timeline.style.minWidth = `${calculatedWidth}px`;

  // Always render the header, even if there are no tasks
  // Create a multi-row header with Year, Month, and Day rows
  const header = document.createElement('div');
  header.className = 'gantt-header';
  header.setAttribute('dir', ganttDirection);
  header.style.direction = ganttDirection;
  header.style.display = 'flex';
  header.style.flexDirection = 'column';
  
  const dayCellWidth = (calculatedWidth / days.length);
  
  // Hebrew month names
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
  
  // Create Year row
  const yearRow = document.createElement('div');
  yearRow.className = 'gantt-header-row gantt-header-year-row';
  yearRow.style.display = 'flex';
  yearRow.style.flexDirection = 'row';
  yearRow.style.direction = ganttDirection;
  yearRow.style.width = `${calculatedWidth}px`;
  yearRow.style.minWidth = `${calculatedWidth}px`;
  
  // Create Month row
  const monthRow = document.createElement('div');
  monthRow.className = 'gantt-header-row gantt-header-month-row';
  monthRow.style.display = 'flex';
  monthRow.style.flexDirection = 'row';
  monthRow.style.direction = ganttDirection;
  monthRow.style.width = `${calculatedWidth}px`;
  monthRow.style.minWidth = `${calculatedWidth}px`;
  
  // Create Day row
  const dayRow = document.createElement('div');
  dayRow.className = 'gantt-header-row gantt-header-day-row';
  dayRow.style.display = 'flex';
  dayRow.style.flexDirection = 'row';
  dayRow.style.direction = ganttDirection;
  dayRow.style.width = `${calculatedWidth}px`;
  dayRow.style.minWidth = `${calculatedWidth}px`;
  
  // Group days by year and month
  let currentYear = null;
  let currentMonth = null;
  let yearStartIdx = 0;
  let monthStartIdx = 0;
  
  days.forEach((day, dayIdx) => {
    const year = day.getFullYear();
    const month = day.getMonth();
    
    // Year grouping
    if (currentYear !== year) {
      if (currentYear !== null) {
        // Create year cell for previous year
        const yearCell = document.createElement('div');
        yearCell.className = 'gantt-header-year';
        yearCell.style.width = `${(dayIdx - yearStartIdx) * dayCellWidth}px`;
        yearCell.style.minWidth = `${(dayIdx - yearStartIdx) * dayCellWidth}px`;
        yearCell.textContent = currentYear;
        yearRow.appendChild(yearCell);
      }
      currentYear = year;
      yearStartIdx = dayIdx;
    }
    
    // Month grouping - reset when year changes too
    if (currentMonth !== month || (currentYear !== null && currentYear !== year)) {
      if (currentMonth !== null) {
        // Create month cell for previous month
        const monthCell = document.createElement('div');
        monthCell.className = 'gantt-header-month';
        monthCell.style.width = `${(dayIdx - monthStartIdx) * dayCellWidth}px`;
        monthCell.style.minWidth = `${(dayIdx - monthStartIdx) * dayCellWidth}px`;
        monthCell.textContent = monthNames[currentMonth];
        monthRow.appendChild(monthCell);
      }
      currentMonth = month;
      monthStartIdx = dayIdx;
    }
    
    // Day cell
    const dayCell = document.createElement('div');
    dayCell.className = 'gantt-header-day';
    dayCell.style.width = `${dayCellWidth}px`;
    dayCell.style.minWidth = `${dayCellWidth}px`;
    dayCell.style.flexShrink = '0';
    dayCell.style.direction = ganttDirection;
    dayCell.style.position = 'relative';
    dayCell.innerHTML = `
      <div class="gantt-header-day-name">${dayNames[day.getDay()]}</div>
      <div class="gantt-header-day-num">${day.getDate()}</div>
    `;
    if (day.toDateString() === now.toDateString()) dayCell.classList.add('today');
    dayRow.appendChild(dayCell);
  });
  
  // Add final year and month cells
  if (currentYear !== null) {
    const yearCell = document.createElement('div');
    yearCell.className = 'gantt-header-year';
    yearCell.style.width = `${(days.length - yearStartIdx) * dayCellWidth}px`;
    yearCell.style.minWidth = `${(days.length - yearStartIdx) * dayCellWidth}px`;
    yearCell.textContent = currentYear;
    yearRow.appendChild(yearCell);
  }
  
  if (currentMonth !== null) {
    const monthCell = document.createElement('div');
    monthCell.className = 'gantt-header-month';
    monthCell.style.width = `${(days.length - monthStartIdx) * dayCellWidth}px`;
    monthCell.style.minWidth = `${(days.length - monthStartIdx) * dayCellWidth}px`;
    monthCell.textContent = monthNames[currentMonth];
    monthRow.appendChild(monthCell);
  }
  
  header.appendChild(yearRow);
  header.appendChild(monthRow);
  header.appendChild(dayRow);
  timeline.appendChild(header);

  // Show message if no tasks, but still show the timeline
  if (!allTasks.length) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'gantt-tasks-container';
    emptyMessage.style.height = '100px';
    emptyMessage.style.display = 'flex';
    emptyMessage.style.alignItems = 'center';
    emptyMessage.style.justifyContent = 'center';
    emptyMessage.innerHTML = '<div class="p-4 text-center" style="color:var(--muted);">אין משימות עם תאריכים להצגה</div>';
    timeline.appendChild(emptyMessage);
    return;
  }

  const tasksLayer = document.createElement('div');
  tasksLayer.className = 'gantt-tasks-container';
  const rowHeight = 44; // Increased for two-line task bars
  tasksLayer.style.height = `${allTasks.length * rowHeight}px`;
  tasksLayer.style.width = `${calculatedWidth}px`;
  tasksLayer.setAttribute('dir', ganttDirection);

  const totalDays = days.length;
  const dayCellWidthPx = calculatedWidth / totalDays;
  
  allTasks.forEach((task, idx) => {
    // Get task dates - normalize properly
    let taskStartDate = normalizeTaskDate(task.startDate);
    let taskEndDate = normalizeTaskDate(task.endDate);
    
    // Handle missing dates
    if (!taskStartDate && taskEndDate) {
      taskStartDate = taskEndDate;
    }
    if (!taskEndDate && taskStartDate) {
      taskEndDate = taskStartDate;
    }
    
    if (!taskStartDate || !taskEndDate) return;

    // normalizeTaskDate already returns dates normalized to midnight with correct local date components
    // Extract date components for comparison
    const taskStartYear = taskStartDate.getFullYear();
    const taskStartMonth = taskStartDate.getMonth();
    const taskStartDay = taskStartDate.getDate();
    
    const taskEndYear = taskEndDate.getFullYear();
    const taskEndMonth = taskEndDate.getMonth();
    const taskEndDay = taskEndDate.getDate();
    
    // Calculate day indices by finding matching days in the days array
    // Compare using local date components to avoid timezone issues
    let startDayIndex = days.findIndex(day => 
      day.getFullYear() === taskStartYear &&
      day.getMonth() === taskStartMonth &&
      day.getDate() === taskStartDay
    );
    
    let endDayIndex = days.findIndex(day =>
      day.getFullYear() === taskEndYear &&
      day.getMonth() === taskEndMonth &&
      day.getDate() === taskEndDay
    );
    
    // If dates aren't in the visible range, skip this task
    if (startDayIndex === -1 && endDayIndex === -1) return;
    
    // Ensure end date is not before start date (fix any invalid data)
    if (startDayIndex !== -1 && endDayIndex !== -1 && endDayIndex < startDayIndex) {
      endDayIndex = startDayIndex;
    }
    
    // Handle tasks that extend beyond visible range
    if (startDayIndex === -1) {
      // Task starts before visible range, clamp to start
      startDayIndex = 0;
    }
    if (endDayIndex === -1) {
      // Task ends after visible range, clamp to end
      endDayIndex = totalDays - 1;
    }
    
    // Ensure indices are valid
    startDayIndex = Math.max(0, Math.min(startDayIndex, totalDays - 1));
    endDayIndex = Math.max(startDayIndex, Math.min(endDayIndex, totalDays - 1));
    
    // Calculate width - endDayIndex is inclusive, so we add 1
    const width = endDayIndex - startDayIndex + 1;

    // Get task category color if available (for subtle indicator)
    const taskCategory = TASK_CATEGORIES.find(c => c.id === task.category);
    const categoryColor = taskCategory?.color || '#3b82f6';
    
    // Determine status-based color as primary background (priority order matters)
    let barColor = '#3b82f6'; // Default blue
    if (task.status === 'finished') {
      barColor = '#10b981'; // Green for finished
    } else if (task.status === 'canceled') {
      barColor = '#6b7280'; // Gray for canceled
    } else if (isTaskOverdue(task)) {
      barColor = '#ef4444'; // Red for overdue
    } else if (task.endDate && !['finished', 'canceled'].includes(task.status)) {
      // Check if approaching due date (within 3 days)
      const endDate = normalizeTaskDate(task.endDate);
      if (endDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(0, 0, 0, 0);
        const daysUntilDue = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilDue >= 0 && daysUntilDue <= 3) {
          barColor = '#f59e0b'; // Amber/warning for approaching due date (3 days or less)
        }
      }
    }
    
    // Get responsibility user info
    const responsibleUser = task.responsibility ? HOUSEHOLD_USERS[task.responsibility] : null;
    const responsibilityName = responsibleUser ? getUserDisplayName(responsibleUser) : '';
    const responsibilityPhoto = responsibleUser?.photoURL || '/GSH.png';
    
    // Create task bar container
    const bar = document.createElement('div');
    bar.className = 'gantt-task';
    bar.style.position = 'absolute';
    const leftPx = startDayIndex * dayCellWidthPx;
    const widthPx = width * dayCellWidthPx;
    bar.style.left = `${leftPx}px`;
    bar.style.width = `${widthPx}px`;
    bar.style.top = `${idx * rowHeight}px`;
    bar.style.height = '40px';
    bar.style.backgroundColor = barColor;
    bar.style.color = '#fff';
    bar.style.display = 'flex';
    bar.style.flexDirection = 'column';
    bar.style.justifyContent = 'center';
    bar.style.padding = '0';
    bar.style.fontSize = '11px';
    bar.style.fontWeight = '500';
    bar.style.cursor = 'pointer';
    bar.style.borderRadius = '6px';
    bar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
    bar.style.overflow = 'hidden';
    bar.style.direction = 'rtl';
    bar.style.lineHeight = '1.3';
    
    // Always add subtle left border stripe (2px) to show category color
    if (taskCategory && categoryColor) {
      bar.style.borderLeft = `2px solid ${categoryColor}`;
    }
    
    // Create inner content container with padding
    const contentDiv = document.createElement('div');
    contentDiv.style.display = 'flex';
    contentDiv.style.flexDirection = 'column';
    contentDiv.style.gap = '2px';
    contentDiv.style.width = '100%';
    contentDiv.style.padding = '4px 8px';
    contentDiv.style.overflow = 'hidden';
    contentDiv.style.boxSizing = 'border-box';
    
    // Task name (main text)
    const nameDiv = document.createElement('div');
    nameDiv.style.fontWeight = '600';
    nameDiv.style.fontSize = '12px';
    nameDiv.style.whiteSpace = 'nowrap';
    nameDiv.style.overflow = 'hidden';
    nameDiv.style.textOverflow = 'ellipsis';
    nameDiv.textContent = task.name || 'ללא שם';
    
    // Secondary info container (responsibility + status)
    const infoDiv = document.createElement('div');
    infoDiv.style.display = 'flex';
    infoDiv.style.gap = '6px';
    infoDiv.style.fontSize = '10px';
    infoDiv.style.opacity = '0.9';
    infoDiv.style.alignItems = 'center';
    infoDiv.style.flexWrap = 'nowrap';
    
    // Add responsibility with chathead if available
    if (responsibilityName) {
      const respContainer = document.createElement('span');
      respContainer.style.display = 'inline-flex';
      respContainer.style.alignItems = 'center';
      respContainer.style.gap = '4px';
      respContainer.style.whiteSpace = 'nowrap';
      
      const respImg = document.createElement('img');
      respImg.src = responsibilityPhoto;
      respImg.alt = responsibilityName;
      respImg.style.width = '14px';
      respImg.style.height = '14px';
      respImg.style.borderRadius = '50%';
      respImg.style.objectFit = 'cover';
      respImg.style.border = '1px solid rgba(255,255,255,0.3)';
      respImg.onerror = () => { respImg.src = '/GSH.png'; };
      
      const respText = document.createElement('span');
      respText.textContent = responsibilityName;
      
      respContainer.appendChild(respImg);
      respContainer.appendChild(respText);
      infoDiv.appendChild(respContainer);
    }
    
    // Add status badge if not default
    if (task.status && task.status !== 'todo') {
      const statusSpan = document.createElement('span');
      statusSpan.textContent = getStatusLabel(task.status);
      statusSpan.style.whiteSpace = 'nowrap';
      statusSpan.style.padding = '0 4px';
      statusSpan.style.borderRadius = '3px';
      statusSpan.style.backgroundColor = 'rgba(255,255,255,0.2)';
      infoDiv.appendChild(statusSpan);
    }
    
    contentDiv.appendChild(nameDiv);
    if (infoDiv.children.length > 0) {
      contentDiv.appendChild(infoDiv);
    }
    bar.appendChild(contentDiv);
    
    // Enhanced tooltip
    const tooltipParts = [task.name || 'ללא שם'];
    if (taskCategory) {
      tooltipParts.push(`קטגוריה: ${taskCategory.label}`);
    }
    if (responsibilityName) {
      tooltipParts.push(`אחריות: ${responsibilityName}`);
    }
    if (taskStartDate) {
      tooltipParts.push(`מתחיל: ${taskStartDate.toLocaleDateString('he-IL')}`);
    }
    if (taskEndDate) {
      tooltipParts.push(`מסתיים: ${taskEndDate.toLocaleDateString('he-IL')}`);
    }
    if (task.status && task.status !== 'todo') {
      tooltipParts.push(`סטטוס: ${getStatusLabel(task.status)}`);
    }
    bar.title = tooltipParts.join(' | ');
    
    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      openTaskEditor(task);
    });
    tasksLayer.appendChild(bar);
  });

  timeline.appendChild(tasksLayer);
  
  // Update date range display
  updateGanttDateRangeDisplay();
}

function getTaskColor(task) {
  if (task.status === 'finished') return '#10b981';
  if (task.status === 'canceled') return '#6b7280';
  if (isTaskOverdue(task)) return '#ef4444';
  return '#3b82f6';
}

function ganttJumpToToday() {
  // Use current week by default for better context
  setCurrentWeekRange({ save: true });
  
  renderGantt();
  // Scroll to today after render
  setTimeout(() => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
    scrollToDate(now);
  }, 350);
}

function ganttJumpToDatePrompt() {
  const msPerDay = 86400000;
  const value = prompt('הזן תאריך (YYYY-MM-DD):', iso(new Date()));
  if (!value) return;
  const date = new Date(value + 'T00:00:00');
  if (isNaN(date.getTime())) {
    toast('תאריך לא תקין');
    return;
  }
  date.setHours(0, 0, 0, 0);
  
  ganttViewStart = new Date(date.getTime() - (7 * msPerDay));
  ganttViewStart.setHours(0, 0, 0, 0);
  
  ganttViewEnd = new Date(date.getTime() + (30 * msPerDay));
  ganttViewEnd.setHours(23, 59, 59, 999);
  
  saveGanttViewState();
  renderGantt();
}

function ganttNavigate(direction) {
  if (!ganttViewStart || !ganttViewEnd) {
    ganttJumpToToday();
    return;
  }
  const msPerDay = 86400000;
  const delta = direction === 'prev' ? -7 : 7;
  const deltaMs = delta * msPerDay;
  
  // Calculate current view duration to maintain zoom level
  const currentRange = ganttViewEnd.getTime() - ganttViewStart.getTime();
  
  // Shift view by delta while maintaining range
  ganttViewStart = new Date(ganttViewStart.getTime() + deltaMs);
  ganttViewStart.setHours(0, 0, 0, 0);
  
  ganttViewEnd = new Date(ganttViewStart.getTime() + currentRange);
  ganttViewEnd.setHours(23, 59, 59, 999);
  
  saveGanttViewState();
  renderGantt();
  // Don't scroll - maintain user's scroll position relative to content
}

function ganttJumpToTask(direction) {
  const allTasks = Object.values(TASKS)
    .flat()
    .filter(task => normalizeTaskDate(task.startDate) || normalizeTaskDate(task.endDate));
  if (!allTasks.length) {
    toast('אין משימות עם תאריכים');
    return;
  }
  allTasks.sort((a, b) => {
    const aDate = normalizeTaskDate(a.startDate) || normalizeTaskDate(a.endDate);
    const bDate = normalizeTaskDate(b.startDate) || normalizeTaskDate(b.endDate);
    return (aDate?.getTime() || 0) - (bDate?.getTime() || 0);
  });
  const nowSeconds = Date.now();

  let target = null;
  if (direction === 'next') {
    target = allTasks.find(t => {
      const startTime = normalizeTaskDate(t.startDate)?.getTime() || normalizeTaskDate(t.endDate)?.getTime() || 0;
      return startTime > nowSeconds;
    }) || allTasks[0];
  } else {
    const candidates = allTasks.filter(t => {
      const startTime = normalizeTaskDate(t.startDate)?.getTime() || normalizeTaskDate(t.endDate)?.getTime() || 0;
      return startTime < nowSeconds;
    });
    target = candidates.length ? candidates[candidates.length - 1] : allTasks[allTasks.length - 1];
  }
  if (!target) return;

  const pivot = normalizeTaskDate(target.startDate) || normalizeTaskDate(target.endDate);
  if (!pivot) return;

  const msPerDay = 86400000;
  pivot.setHours(0, 0, 0, 0);

  ganttViewStart = new Date(pivot.getTime() - (7 * msPerDay));
  ganttViewStart.setHours(0, 0, 0, 0);

  ganttViewEnd = new Date(pivot.getTime() + (30 * msPerDay));
  ganttViewEnd.setHours(23, 59, 59, 999);

  saveGanttViewState();
  renderGantt();
}

let ganttZoomLevel = 37; // Default: 37 days (7 before + 30 after)

function ganttZoom(direction) {
  if (!ganttViewStart || !ganttViewEnd) {
    ganttJumpToToday();
    return;
  }
  
  const msPerDay = 86400000;
  const center = new Date((ganttViewStart.getTime() + ganttViewEnd.getTime()) / 2);
  const currentDays = Math.ceil((ganttViewEnd.getTime() - ganttViewStart.getTime()) / msPerDay);
  
  if (direction === 'in') {
    ganttZoomLevel = Math.max(7, Math.floor(currentDays * 0.7)); // Zoom in (reduce days)
  } else {
    // Remove the 365 day limit - allow zooming out much further
    ganttZoomLevel = Math.ceil(currentDays * 1.3); // Zoom out (increase days) - no upper limit
  }
  
  const halfDays = Math.floor(ganttZoomLevel / 2);
  const halfDaysMs = halfDays * msPerDay;
  
  ganttViewStart = new Date(center.getTime() - halfDaysMs);
  ganttViewStart.setHours(0, 0, 0, 0);
  
  ganttViewEnd = new Date(center.getTime() + halfDaysMs);
  ganttViewEnd.setHours(23, 59, 59, 999);
  
  saveGanttViewState();
  renderGantt();
}

function loadGanttViewState() {
  try {
    const savedStart = localStorage.getItem(GANTT_VIEW_START_KEY);
    const savedEnd = localStorage.getItem(GANTT_VIEW_END_KEY);
    if (savedStart) ganttViewStart = new Date(parseInt(savedStart, 10));
    if (savedEnd) ganttViewEnd = new Date(parseInt(savedEnd, 10));
    
    // Load direction preference
    const savedDirection = localStorage.getItem(GANTT_DIRECTION_KEY);
    if (savedDirection === 'rtl' || savedDirection === 'ltr') {
      ganttDirection = savedDirection;
    } else {
      ganttDirection = 'ltr'; // Default to LTR
    }
  } catch (_) {}

  // If there's no saved state, default to the current week so the view is meaningful on first load
  if (!ganttViewStart || !ganttViewEnd || isNaN(ganttViewStart.getTime()) || isNaN(ganttViewEnd.getTime())) {
    setCurrentWeekRange();
  }
  
  // Update toggle button display
  updateDirectionToggleButton();
}

function saveGanttViewState() {
  try {
    if (ganttViewStart) localStorage.setItem(GANTT_VIEW_START_KEY, String(ganttViewStart.getTime()));
    if (ganttViewEnd) localStorage.setItem(GANTT_VIEW_END_KEY, String(ganttViewEnd.getTime()));
    if (ganttDirection) localStorage.setItem(GANTT_DIRECTION_KEY, ganttDirection);
  } catch (_) {}
}

function toggleGanttDirection() {
  ganttDirection = ganttDirection === 'ltr' ? 'rtl' : 'ltr';
  saveGanttViewState();
  updateDirectionToggleButton();
  renderGantt();
}

function updateDirectionToggleButton() {
  if (dom.ganttDirectionToggle) {
    const label = ganttDirection === 'ltr' ? '→ LTR' : '← RTL';
    dom.ganttDirectionToggle.textContent = `⇄ ${label}`;
    dom.ganttDirectionToggle.title = ganttDirection === 'ltr' ? 'החלף לימין-לשמאל (RTL)' : 'החלף לשמאל-לימין (LTR)';
  }
}

function setCurrentWeekRange(options = {}) {
  const msPerDay = 86400000;
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Start of week (Sunday = 0)
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(now.getTime() - (dayOfWeek * msPerDay));
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek.getTime() + (6 * msPerDay));
  endOfWeek.setHours(23, 59, 59, 999);

  ganttViewStart = startOfWeek;
  ganttViewEnd = endOfWeek;

  if (options.save) {
    saveGanttViewState();
  }

  return { startOfWeek, endOfWeek };
}

// View preset functions - common in calendar apps
function ganttViewTodayPreset() {
  const msPerDay = 86400000;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  // Show today with context: 7 days before, 14 days after (better context)
  ganttViewStart = new Date(now.getTime() - (7 * msPerDay));
  ganttViewStart.setHours(0, 0, 0, 0);
  
  ganttViewEnd = new Date(now.getTime() + (14 * msPerDay));
  ganttViewEnd.setHours(23, 59, 59, 999);
  
  saveGanttViewState();
  renderGantt();
  // Wait a bit for render, then scroll to today
  setTimeout(() => {
    scrollToToday();
  }, 350);
}

function ganttViewWeekPreset() {
  const { startOfWeek } = setCurrentWeekRange({ save: true });
  renderGantt();
  // Wait for render, then scroll to start of week (centered)
  setTimeout(() => {
    scrollToDate(startOfWeek);
  }, 350);
}

function ganttViewMonthPreset() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  // First day of current month
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
  firstDay.setHours(0, 0, 0, 0);
  
  ganttViewStart = firstDay;
  
  // Last day of current month
  ganttViewEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  ganttViewEnd.setHours(23, 59, 59, 999);
  
  saveGanttViewState();
  renderGantt();
  // Wait for render, then scroll to today (centered in view)
  setTimeout(() => {
    scrollToDate(now);
  }, 350);
}

function ganttViewYearPreset() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  // First day of current year
  ganttViewStart = new Date(now.getFullYear(), 0, 1);
  ganttViewStart.setHours(0, 0, 0, 0);
  
  // Last day of current year
  ganttViewEnd = new Date(now.getFullYear(), 11, 31);
  ganttViewEnd.setHours(23, 59, 59, 999);
  
  saveGanttViewState();
  renderGantt();
  // Wait for render, then scroll to today (centered in view)
  setTimeout(() => {
    scrollToDate(now);
  }, 350);
}

function ganttFitAllTasks() {
  const allTasks = Object.values(TASKS)
    .flat()
    .filter(task => normalizeTaskDate(task.startDate) || normalizeTaskDate(task.endDate));
  
  if (!allTasks.length) {
    toast('אין משימות עם תאריכים');
    ganttJumpToToday();
    return;
  }
  
  // Get all task dates
  const taskDates = allTasks
    .flatMap(task => [
      normalizeTaskDate(task.startDate),
      normalizeTaskDate(task.endDate)
    ])
    .filter(Boolean)
    .map(d => d.getTime());
  
  if (!taskDates.length) {
    toast('אין משימות עם תאריכים');
    ganttJumpToToday();
    return;
  }
  
  const minDate = new Date(Math.min(...taskDates));
  const maxDate = new Date(Math.max(...taskDates));
  minDate.setHours(0, 0, 0, 0);
  maxDate.setHours(23, 59, 59, 999);
  
  // Add padding: 10% before and after
  const msPerDay = 86400000;
  const totalRange = maxDate.getTime() - minDate.getTime();
  const padding = Math.max(7 * msPerDay, totalRange * 0.1); // At least 7 days padding
  
  ganttViewStart = new Date(minDate.getTime() - padding);
  ganttViewStart.setHours(0, 0, 0, 0);
  
  ganttViewEnd = new Date(maxDate.getTime() + padding);
  ganttViewEnd.setHours(23, 59, 59, 999);
  
  saveGanttViewState();
  renderGantt();
  // Scroll to the earliest task date
  scrollToDate(minDate);
}

function ganttNavigateMonth(direction) {
  if (!ganttViewStart || !ganttViewEnd) {
    ganttJumpToToday();
    return;
  }
  
  // Navigate to the next/previous month while maintaining day of month context
  const center = new Date((ganttViewStart.getTime() + ganttViewEnd.getTime()) / 2);
  const currentYear = center.getFullYear();
  const currentMonth = center.getMonth();
  
  // Calculate new month
  let newYear = currentYear;
  let newMonth = currentMonth + (direction === 'prev' ? -1 : 1);
  
  // Handle year boundaries
  if (newMonth < 0) {
    newMonth = 11;
    newYear--;
  } else if (newMonth > 11) {
    newMonth = 0;
    newYear++;
  }
  
  // First day of the month
  ganttViewStart = new Date(newYear, newMonth, 1);
  ganttViewStart.setHours(0, 0, 0, 0);
  
  // Last day of the month
  ganttViewEnd = new Date(newYear, newMonth + 1, 0);
  ganttViewEnd.setHours(23, 59, 59, 999);
  
  saveGanttViewState();
  renderGantt();
  // Scroll to first day of the month
  setTimeout(() => {
    scrollToDate(ganttViewStart);
  }, 350);
}

function scrollToDate(targetDate, retryCount = 0) {
  if (!targetDate) {
    targetDate = new Date();
    targetDate.setHours(0, 0, 0, 0);
  }
  
  // Prevent infinite recursion
  if (retryCount > 5) {
    console.warn('scrollToDate: Max retries reached');
    return;
  }
  
  // Wait a bit to ensure DOM is ready
  const delay = retryCount === 0 ? 300 : 200; // Longer initial delay
  
  setTimeout(() => {
    const container = dom.ganttContainer;
    if (!container || !ganttViewStart || !ganttViewEnd) {
      if (retryCount < 3) {
        setTimeout(() => scrollToDate(targetDate, retryCount + 1), delay);
      }
      return;
    }
    
    const timeline = dom.ganttTimeline;
    if (!timeline) {
      if (retryCount < 3) {
        setTimeout(() => scrollToDate(targetDate, retryCount + 1), delay);
      }
      return;
    }
    
    // Calculate target date's position in the timeline
    const msPerDay = 86400000;
    const normalizedTarget = normalizeTaskDate(targetDate);
    if (!normalizedTarget) {
      if (retryCount < 2) {
        setTimeout(() => scrollToDate(targetDate, retryCount + 1), delay);
      }
      return;
    }
    
    const targetTime = normalizedTarget.getTime();
    const startTime = normalizeTaskDate(ganttViewStart).getTime();
    const endTime = normalizeTaskDate(ganttViewEnd, { endOfDay: true }).getTime();
    
    // Check if target date is within current view range (with buffer)
    const buffer = 2 * msPerDay; // 2 day buffer
    
    if (targetTime < (startTime - buffer) || targetTime > (endTime + buffer)) {
      // Date is outside current view, need to adjust view first
      const daysRange = Math.ceil((endTime - startTime) / msPerDay);
      
      // Center the target date in the view with reasonable padding
      const padding = Math.max(7, Math.floor(daysRange / 2));
      ganttViewStart = new Date(targetTime - (padding * msPerDay));
      ganttViewStart.setHours(0, 0, 0, 0);
      
      ganttViewEnd = new Date(targetTime + (padding * msPerDay));
      ganttViewEnd.setHours(23, 59, 59, 999);
      
      saveGanttViewState();
      renderGantt();
      
      // Wait for render to complete, then scroll
      setTimeout(() => scrollToDate(targetDate, retryCount + 1), 400);
      return;
    }
    
    // Calculate scroll position based on date position
    const daysFromStart = Math.floor((targetTime - startTime) / msPerDay);
    const totalDays = Math.ceil((endTime - startTime) / msPerDay);
    
    if (totalDays <= 0) {
      if (retryCount < 2) {
        setTimeout(() => scrollToDate(targetDate, retryCount + 1), delay);
      }
      return;
    }
    
    // Get actual timeline width after render - try multiple sources
    const timelineWidth = timeline.scrollWidth || timeline.offsetWidth || container.scrollWidth || 0;
    
    if (!timelineWidth || timelineWidth === 0) {
      // Timeline not fully rendered yet, retry
      if (retryCount < 4) {
        setTimeout(() => scrollToDate(targetDate, retryCount + 1), delay);
      }
      return;
    }
    
    const dayCellWidth = timelineWidth / totalDays;
    if (!dayCellWidth || dayCellWidth <= 0) {
      if (retryCount < 2) {
        setTimeout(() => scrollToDate(targetDate, retryCount + 1), delay);
      }
      return;
    }
    
    // Calculate target scroll position (center the date in viewport)
    const datePosition = daysFromStart * dayCellWidth;
    const viewportCenter = container.clientWidth / 2;
    let targetScrollLeft = datePosition - viewportCenter + (dayCellWidth / 2);
    
    // Clamp to valid scroll range (LTR base)
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, maxScroll));
    
    // If RTL, mirror the scroll position from the right edge
    const isRTL = ganttDirection === 'rtl';
    const finalScrollLeft = isRTL ? (maxScroll - targetScrollLeft) : targetScrollLeft;
    
    // Smooth scroll to position
    if (container.scrollTo) {
      container.scrollTo({
        left: finalScrollLeft,
        behavior: 'smooth'
      });
    } else {
      container.scrollLeft = finalScrollLeft;
    }
  }, delay);
}

function scrollToToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  scrollToDate(now);
}

function updateGanttDateRangeDisplay() {
  if (!dom.ganttDateRange || !ganttViewStart || !ganttViewEnd) return;
  
  const formatDate = (date) => {
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  const startStr = formatDate(ganttViewStart);
  const endStr = formatDate(ganttViewEnd);
  
  dom.ganttDateRange.textContent = `${startStr} - ${endStr}`;
}

function setupGanttKeyboardShortcuts() {
  // Only handle keyboard shortcuts when gantt view is visible
  document.addEventListener('keydown', (e) => {
    // Check if we're on the gantt tab and view is visible
    if (currentTasksTab !== 'gantt') return;
    if (dom.tasksGanttView?.classList.contains('hidden')) return;
    
    // Don't handle shortcuts if user is typing in an input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    const key = e.key;
    
    // Arrow keys for navigation
    if (key === 'ArrowLeft' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      ganttNavigate('prev');
    } else if (key === 'ArrowRight' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      ganttNavigate('next');
    } else if (key === 'ArrowUp' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      ganttNavigateMonth('prev');
    } else if (key === 'ArrowDown' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      ganttNavigateMonth('next');
    }
    // Home key - jump to today
    else if (key === 'Home' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      ganttJumpToToday();
    }
    // End key - fit all tasks
    else if (key === 'End' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      ganttFitAllTasks();
    }
    // 'T' key - jump to today
    else if ((key === 't' || key === 'T') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      ganttJumpToToday();
    }
    // 'F' key - fit all tasks
    else if ((key === 'f' || key === 'F') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      ganttFitAllTasks();
    }
  });
}

let _ganttScrollListener = null;
let _isExtending = false;

function setupGanttScrollExtension() {
  if (!dom.ganttContainer) return;
  
  // Remove existing listener if any
  if (_ganttScrollListener) {
    dom.ganttContainer.removeEventListener('scroll', _ganttScrollListener);
  }
  
  _ganttScrollListener = () => {
    if (_isExtending) return;
    if (currentTasksTab !== 'gantt') return;
    if (dom.tasksGanttView?.classList.contains('hidden')) return;
    
    const container = dom.ganttContainer;
    if (!container) return;
    
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    
    // Threshold: extend when within 300px of edges
    const threshold = 300;
    const msPerDay = 86400000;
    const extensionDays = 30;
    
    // Check if near left edge (start of timeline)
    if (scrollLeft < threshold && ganttViewStart) {
      _isExtending = true;
      
      // Calculate current day width
      const currentDays = Math.ceil((ganttViewEnd.getTime() - ganttViewStart.getTime()) / msPerDay);
      const dayCellWidth = scrollWidth / currentDays;
      const extensionWidth = extensionDays * dayCellWidth;
      
      // Save current scroll position
      const currentScrollLeft = scrollLeft;
      
      // Extend backward by 30 days
      ganttViewStart = new Date(ganttViewStart.getTime() - (extensionDays * msPerDay));
      ganttViewStart.setHours(0, 0, 0, 0);
      
      saveGanttViewState();
      renderGantt();
      
      // Restore scroll position after render (add the extension width to maintain position)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (container) {
            container.scrollLeft = currentScrollLeft + extensionWidth;
          }
          _isExtending = false;
        });
      });
    }
    // Check if near right edge (end of timeline)
    else if (scrollLeft + clientWidth > scrollWidth - threshold && ganttViewEnd) {
      _isExtending = true;
      
      // Extend forward by 30 days
      ganttViewEnd = new Date(ganttViewEnd.getTime() + (extensionDays * msPerDay));
      ganttViewEnd.setHours(23, 59, 59, 999);
      
      saveGanttViewState();
      renderGantt();
      
      // Maintain scroll position (don't jump)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          _isExtending = false;
        });
      });
    }
  };
  
  dom.ganttContainer.addEventListener('scroll', _ganttScrollListener, { passive: true });
}

