import { toast, showLoading, hideLoading } from '/utils/helpers.js';
import { uploadFileAndGetURL } from '../utils/upload.js';
import { 
  requestNotificationPermission, 
  showReminderNotification as showNotification,
  isNotificationEnabled 
} from '../utils/notifications.js';

const REMINDER_CATEGORY_KEY = 'selectedReminderCategory';

let householdRefRef;
let householdId; // Store household ID for storage paths
let firebaseFns;
let srefFn;
let storageRefInstance;
let getCurrentViewFn = () => 'reminders';
let getNotesSnapshotFn = () => [];

let remindersCol;
let reminderCategoriesCol;
let REMINDER_CATEGORIES = [];
let REMINDERS = [];
let selectedReminderCategory = null;
let remindersFilter = 'all';
let pendingReminderCategoryId = null;

let reminderCategoriesUnsub = null;
let remindersUnsub = null;
let timeCheckInterval = null;

const dom = {};
const selectors = {
  remindersContainer: '#remindersContainer',
  remindersCategoriesList: '#remindersCategoriesList',
  remindersCategoriesNav: '#remindersCategoriesNav',
  createReminderBtn: '#createReminderBtn',
  remindersFilterAll: '#remindersFilterAll',
  remindersFilterActive: '#remindersFilterActive',
  remindersFilterDone: '#remindersFilterDone',
  reminderEditModal: '#reminderEditModal',
  reminderId: '#reminderId',
  reminderTitle: '#reminderTitle',
  reminderTime: '#reminderTime',
  reminderCategory: '#reminderCategory',
  reminderNoteId: '#reminderNoteId',
  reminderFile: '#reminderFile',
  reminderFileName: '#reminderFileName',
  reminderPreview: '#reminderPreview',
  reminderSave: '#reminderSave',
  reminderDelete: '#reminderDelete',
  reminderNowBtn: '#reminderNowBtn',
  reminderTomorrowBtn: '#reminderTomorrowBtn',
  reminderWeekBtn: '#reminderWeekBtn',
  reminderCatModal: '#reminderCatModal',
  reminderCatId: '#reminderCatId',
  reminderCatName: '#reminderCatName',
  reminderCatPinned: '#reminderCatPinned',
  reminderCatFile: '#reminderCatFile',
  reminderCatPreview: '#reminderCatPreview',
  reminderCatFileName: '#reminderCatFileName',
  reminderCatColor: '#reminderCatColor',
  reminderCatSave: '#reminderCatSave',
  reminderCatDelete: '#reminderCatDelete',
  reminderCatModalTitle: '#reminderCatModalTitle'
};

export function initReminders({
  householdRef,
  firebase,
  sref,
  storage,
  getCurrentView,
  getNotesSnapshot
}) {
  householdRefRef = householdRef;
  householdId = householdRef?.id || null; // Extract household ID for storage paths
  firebaseFns = firebase;
  srefFn = sref;
  storageRefInstance = storage;
  getCurrentViewFn = getCurrentView || (() => 'reminders');
  getNotesSnapshotFn = getNotesSnapshot || (() => []);

  remindersCol = firebaseFns.collection(householdRefRef, 'reminders');
  reminderCategoriesCol = firebaseFns.collection(householdRefRef, 'reminderCategories');

  cacheDom();
  wireEvents();
  loadReminderCategories();
  loadReminders();
  handleViewChange(getCurrentViewFn());
  // Start global reminder checking so notifications work from any view
  startReminderChecking();

  // Make openReminderEditor globally accessible
  if (typeof window !== 'undefined') {
    window.openReminderEditor = openReminderEditor;
  }
  
  return {
    handleViewChange,
    getReminders: () => [...REMINDERS],
    openReminderEditor: openReminderEditor
  };
}

function cacheDom() {
  Object.entries(selectors).forEach(([key, selector]) => {
    dom[key] = document.querySelector(selector);
  });
}

function wireEvents() {
  dom.reminderEditModal?.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', () => dom.reminderEditModal?.classList.remove('show'))
  );
  dom.reminderCatModal?.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', () => dom.reminderCatModal?.classList.remove('show'))
  );

  dom.reminderSave?.addEventListener('click', handleReminderSave);
  dom.reminderDelete?.addEventListener('click', handleReminderDelete);
  dom.createReminderBtn?.addEventListener('click', () => openReminderEditor('create'));

  dom.remindersFilterAll?.addEventListener('click', () => handleFilterChange('all'));
  dom.remindersFilterActive?.addEventListener('click', () => handleFilterChange('active'));
  dom.remindersFilterDone?.addEventListener('click', () => handleFilterChange('done'));

  dom.reminderCatFile?.addEventListener('change', handleReminderCatFileChange);
  dom.reminderCatSave?.addEventListener('click', handleReminderCategorySave);
  dom.reminderCatDelete?.addEventListener('click', handleReminderCategoryDelete);
  
  // Reminder image upload
  dom.reminderFile?.addEventListener('change', () => {
    dom.reminderFileName.textContent = dom.reminderFile.files?.[0]?.name || 'לא נבחרה תמונה';
    if (dom.reminderFile.files?.[0]) {
      dom.reminderPreview.src = URL.createObjectURL(dom.reminderFile.files[0]);
      dom.reminderPreview.classList.remove('hidden');
    } else {
      dom.reminderPreview.classList.add('hidden');
    }
  });
  dom.reminderCatModal
    ?.querySelectorAll('.color-option')
    .forEach(btn => btn.addEventListener('click', () => selectReminderCategoryColor(btn)));

  // Quick time preset buttons for reminder time
  const setReminderTime = (date) => {
    if (!dom.reminderTime) return;
    const pad = (n) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const h = pad(date.getHours());
    const min = pad(date.getMinutes());
    dom.reminderTime.value = `${y}-${m}-${d}T${h}:${min}`;
  };

  dom.reminderNowBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const now = new Date();
    now.setSeconds(0, 0);
    setReminderTime(now);
  });

  dom.reminderTomorrowBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setSeconds(0, 0);
    setReminderTime(d);
  });

  dom.reminderWeekBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setSeconds(0, 0);
    setReminderTime(d);
  });
}

function handleViewChange(view) {
  if (view === 'reminders') {
    // Re-cache DOM in case elements weren't available during initial load
    cacheDom();
    // Wire up the create reminder button
    const createBtn = document.getElementById('createReminderBtn');
    if (createBtn && !createBtn.hasAttribute('data-wired')) {
      createBtn.setAttribute('data-wired', 'true');
      createBtn.addEventListener('click', () => openReminderEditor('create'));
      dom.createReminderBtn = createBtn;
    }
    renderRemindersCategoriesBar();
    renderReminders();
  } else {
    // Hide reminders categories when switching to other views
    hideRemindersNav();
    // Also clear the categories list to prevent showing wrong categories
    if (dom.remindersCategoriesList) {
      dom.remindersCategoriesList.innerHTML = '';
    }
  }
}

function loadReminderCategories() {
  firebaseFns
    .getDocs(firebaseFns.query(reminderCategoriesCol, firebaseFns.orderBy('order', 'asc')))
    .then(qs => {
      REMINDER_CATEGORIES = qs.docs.map(normalizeReminderCategory);
      renderRemindersCategoriesBar();
      restoreReminderCategorySelection();
    })
    .catch(console.error);

  if (reminderCategoriesUnsub) {
    try {
      reminderCategoriesUnsub();
    } catch {
      /* noop */
    }
  }

  reminderCategoriesUnsub = firebaseFns.onSnapshot(
    firebaseFns.query(reminderCategoriesCol, firebaseFns.orderBy('order', 'asc')),
    qs => {
      REMINDER_CATEGORIES = qs.docs.map(normalizeReminderCategory);
      renderRemindersCategoriesBar();
      restoreReminderCategorySelection();
    }
  );
}

function normalizeReminderCategory(docSnap) {
  const data = docSnap.data();
  return {
    id: docSnap.id,
    label: data.label,
    img: data.img || '',
    order: data.order ?? 0,
    pinned: !!data.pinned,
    color: data.color || '#3b82f6'
  };
}

function restoreReminderCategorySelection() {
  const saved = localStorage.getItem(REMINDER_CATEGORY_KEY);
  if (saved && REMINDER_CATEGORIES.find(c => c.id === saved)) {
    selectReminderCategory(saved);
  } else if (!selectedReminderCategory && REMINDER_CATEGORIES.length) {
    selectReminderCategory(REMINDER_CATEGORIES[0].id);
  } else {
    renderReminders();
  }
}

function loadReminders() {
  if (remindersUnsub) {
    try {
      remindersUnsub();
    } catch {
      /* noop */
    }
  }
  remindersUnsub = firebaseFns.onSnapshot(
    firebaseFns.query(remindersCol, firebaseFns.orderBy('createdAt', 'desc')),
    qs => {
      REMINDERS = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      renderReminders();
      renderRemindersCategoriesBar();
    }
  );
}

function renderReminders() {
  if (getCurrentViewFn() !== 'reminders') return;
  const container = dom.remindersContainer;
  if (!container) return;

  let filtered = [...REMINDERS];
  if (selectedReminderCategory) {
    filtered = filtered.filter(r => r.category === selectedReminderCategory);
  }
  if (remindersFilter === 'active') {
    filtered = filtered.filter(r => !r.isDone);
  } else if (remindersFilter === 'done') {
    filtered = filtered.filter(r => r.isDone);
  }

  container.innerHTML = '';
  if (!filtered.length) {
    container.innerHTML = '<div class="text-center p-8" style="color:var(--muted);">אין תזכורות להצגה</div>';
    return;
  }

  const sections = [
    { title: '', items: filtered.filter(r => r.type === 'time' && !r.isDone) },
    { title: 'הושלמו', items: filtered.filter(r => r.isDone) }
  ];

  sections.forEach(section => {
    if (!section.items.length) return;
    const wrapper = document.createElement('div');
    wrapper.className = section.title ? 'mb-4' : '';
    if (section.title) {
      wrapper.innerHTML = `<div class="font-semibold mb-2" style="color:var(--text);">${section.title}</div>`;
    }

    const list = document.createElement('div');
    list.className = 'flex flex-col gap-3';
    section.items.forEach(reminder => list.appendChild(createReminderCard(reminder)));
    if (section.title) {
      wrapper.appendChild(list);
      container.appendChild(wrapper);
    } else {
      container.appendChild(list);
    }
  });
}

function createReminderCard(reminder) {
  const card = document.createElement('div');
  card.className = 'row flex items-center justify-between';

  const info = document.createElement('div');
  info.className = 'flex-1';

  const title = document.createElement('div');
  title.className = 'font-semibold';
  title.textContent = reminder.title || 'ללא כותרת';
  info.appendChild(title);

  const details = document.createElement('div');
  details.className = 'text-sm mt-1';
  details.style.color = 'var(--muted)';

  if (reminder.type === 'time' && reminder.time?.toDate) {
    const time = reminder.time.toDate();
    details.textContent = `זמן: ${time.toLocaleString('he-IL')}`;
    if (time < new Date() && !reminder.isDone) {
      details.style.color = '#ef4444';
      details.textContent += ' (חריג!)';
    }
  }

  if (reminder.noteId) {
    const note = getNotesSnapshotFn().find(n => n.id === reminder.noteId);
    if (note) {
      const noteLink = document.createElement('div');
      noteLink.className = 'text-xs mt-1';
      noteLink.style.color = 'var(--muted)';
      noteLink.textContent = `קשור להערה: ${note.title || 'ללא כותרת'}`;
      info.appendChild(noteLink);
    }
  }
  
  // Add image if available
  if (reminder.img) {
    const imgDiv = document.createElement('div');
    imgDiv.className = 'mt-2';
    const img = document.createElement('img');
    img.src = reminder.img;
    img.className = 'w-full max-w-xs rounded border object-cover';
    img.style.maxHeight = '150px';
    img.style.borderColor = 'var(--border)';
    img.alt = reminder.title || '';
    imgDiv.appendChild(img);
    info.appendChild(imgDiv);
  }

  info.appendChild(details);

  const actions = document.createElement('div');
  actions.className = 'flex gap-2';

  if (!reminder.isDone) {
    const doneBtn = document.createElement('button');
    doneBtn.className = 'px-3 py-1 text-sm border rounded';
    doneBtn.style.color = 'var(--text)';
    doneBtn.style.borderColor = 'var(--border)';
    doneBtn.textContent = 'הושלם';
    doneBtn.addEventListener('click', async () => {
      await firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'reminders', reminder.id), {
        isDone: true,
        updatedAt: firebaseFns.serverTimestamp()
      });
    });
    actions.appendChild(doneBtn);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'px-3 py-1 text-sm border rounded';
  editBtn.style.color = 'var(--text)';
  editBtn.style.borderColor = 'var(--border)';
  editBtn.textContent = 'ערוך';
  editBtn.addEventListener('click', () => openReminderEditor('edit', reminder.id));
  actions.appendChild(editBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'px-3 py-1 text-sm border rounded bg-red-100';
  deleteBtn.style.color = 'var(--text)';
  deleteBtn.textContent = 'מחק';
  deleteBtn.addEventListener('click', async () => {
    if (!confirm('למחוק את התזכורת?')) return;
    await firebaseFns.deleteDoc(firebaseFns.doc(householdRefRef, 'reminders', reminder.id));
  });
  actions.appendChild(deleteBtn);

  card.appendChild(info);
  card.appendChild(actions);
  return card;
}

function renderRemindersCategoriesBar() {
  const list = dom.remindersCategoriesList;
  const nav = dom.remindersCategoriesNav;
  if (!list || !nav) return;

  if (getCurrentViewFn() !== 'reminders') {
    hideRemindersNav();
    list.innerHTML = '';
    return;
  }

  nav.style.setProperty('display', 'block', 'important');
  nav.style.setProperty('visibility', 'visible', 'important');
  list.innerHTML = '';

  REMINDER_CATEGORIES.forEach(cat => {
    const holder = document.createElement('button');
    holder.className = 'cat flex flex-col items-center w-16 relative';
    holder.dataset.id = cat.id;
    const reminderCount = REMINDERS.filter(r => r.category === cat.id && !r.isDone).length;
    holder.innerHTML = `
      ${cat.pinned ? '<span class="absolute top-0 left-1 text-amber-500 text-xs">★</span>' : ''}
      ${
        reminderCount > 0
          ? `<span class="badge">${reminderCount}</span>`
          : '<span class="badge hidden" style="display:none;visibility:hidden;"></span>'
      }
      ${
        cat.img
          ? `<img class="w-14 h-14 rounded-full border object-cover ${cat.id === selectedReminderCategory ? 'selected' : ''}" src="${cat.img}" alt="">`
          : `<div class="w-14 h-14 rounded-full border-2 flex items-center justify-center ${
              cat.id === selectedReminderCategory ? 'selected' : ''
            }" style="border-color:${cat.color};background:${cat.color}20;">
                <div class="w-10 h-10 rounded-full" style="background:${cat.color};"></div>
             </div>`
      }
      <span class="text-[11px] mt-1 text-center truncate" style="color:var(--text);">${cat.label || ''}</span>
    `;

    let clickTimer = null;
    holder.addEventListener('click', e => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
        return;
      }
      clickTimer = setTimeout(() => {
        selectReminderCategory(cat.id);
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
      openReminderCategoryEditor('edit', cat.id);
    });
    holder.addEventListener('contextmenu', e => {
      e.preventDefault();
      e.stopPropagation();
      selectReminderCategory(cat.id);
      openReminderEditor('create', null, cat.id);
    });

    list.appendChild(holder);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'cat flex flex-col items-center w-16';
  addBtn.innerHTML = `<img class="w-14 h-14 rounded-full border object-cover" src="/add.png" alt=""><span class="text-[11px] mt-1">הוסף</span>`;
  addBtn.addEventListener('click', () => openReminderCategoryEditor('create'));
  list.appendChild(addBtn);
}

function hideRemindersNav() {
  const nav = dom.remindersCategoriesNav;
  if (!nav) return;
  nav.style.setProperty('display', 'none', 'important');
  nav.style.setProperty('visibility', 'hidden', 'important');
}

function selectReminderCategory(catId) {
  selectedReminderCategory = catId || null;
  try {
    localStorage.setItem(REMINDER_CATEGORY_KEY, selectedReminderCategory || '');
  } catch {
    /* noop */
  }
  renderReminders();
  renderRemindersCategoriesBar();
}

function openReminderCategoryEditor(mode = 'create', catId = null) {
  if (!dom.reminderCatModal) return;
  dom.reminderCatId.value = catId || '';
  dom.reminderCatName.value = '';
  dom.reminderCatPreview.src = '/cat.png';
  dom.reminderCatPinned.checked = false;
  if (dom.reminderCatFile) dom.reminderCatFile.value = '';
  if (dom.reminderCatFileName) dom.reminderCatFileName.textContent = 'לא נבחרה תמונה';
  dom.reminderCatColor.value = '#3b82f6';
  dom.reminderCatDelete.classList.toggle('hidden', mode !== 'edit');
  dom.reminderCatModalTitle.textContent =
    mode === 'edit' ? 'עריכת קטגוריית תזכורות' : 'קטגוריית תזכורות חדשה';

  resetColorSelection(dom.reminderCatColor.value);

  if (mode === 'edit' && catId) {
    const cat = REMINDER_CATEGORIES.find(c => c.id === catId);
    if (cat) {
      dom.reminderCatName.value = cat.label || '';
      dom.reminderCatPreview.src = cat.img || '/cat.png';
      dom.reminderCatPinned.checked = !!cat.pinned;
      dom.reminderCatColor.value = cat.color || '#3b82f6';
      resetColorSelection(dom.reminderCatColor.value);
    }
  }

  dom.reminderCatModal.classList.add('show');
}

function handleReminderCatFileChange() {
  if (!dom.reminderCatFile || !dom.reminderCatPreview || !dom.reminderCatFileName) return;
  dom.reminderCatFileName.textContent =
    dom.reminderCatFile.files?.[0]?.name || 'לא נבחרה תמונה';
  if (dom.reminderCatFile.files?.[0]) {
    dom.reminderCatPreview.src = URL.createObjectURL(dom.reminderCatFile.files[0]);
  }
}

function selectReminderCategoryColor(btn) {
  if (!btn || !dom.reminderCatModal) return;
  dom.reminderCatColor.value = btn.dataset.color || '#3b82f6';
  resetColorSelection(dom.reminderCatColor.value);
}

function resetColorSelection(activeColor) {
  dom.reminderCatModal
    ?.querySelectorAll('.color-option')
    .forEach(button => {
      button.classList.remove('ring-2', 'ring-offset-2');
      button.style.borderColor = 'var(--border)';
      if (button.dataset.color === activeColor) {
        button.classList.add('ring-2', 'ring-offset-2');
        button.style.borderColor = activeColor;
      }
    });
}

async function handleReminderCategorySave() {
  const name = (dom.reminderCatName?.value || '').trim();
  if (!name) {
    toast('צריך שם קטגוריה');
    return;
  }
  const pinned = !!dom.reminderCatPinned?.checked;
  const color = dom.reminderCatColor?.value || '#3b82f6';
  const id = dom.reminderCatId?.value || null;

  showLoading('שומר קטגוריה...');
  try {
    if (id) {
      await firebaseFns.setDoc(
        firebaseFns.doc(householdRefRef, 'reminderCategories', id),
        { label: name, pinned, color, updatedAt: firebaseFns.serverTimestamp() },
        { merge: true }
      );
      if (dom.reminderCatFile?.files?.[0]) {
        await uploadReminderCategoryImage(id, dom.reminderCatFile.files[0]);
      }
    } else {
      const docRef = await firebaseFns.addDoc(reminderCategoriesCol, {
        label: name,
        pinned,
        color,
        img: null,
        order: Date.now(),
        createdAt: firebaseFns.serverTimestamp()
      });
      if (dom.reminderCatFile?.files?.[0]) {
        await uploadReminderCategoryImage(docRef.id, dom.reminderCatFile.files[0]);
      }
      selectReminderCategory(docRef.id);
    }
    dom.reminderCatModal?.classList.remove('show');
    toast('קטגוריה נשמרה בהצלחה');
  } catch (err) {
    console.error(err);
    toast('שגיאה בשמירת קטגוריה', 3000);
  } finally {
    hideLoading();
  }
}

async function uploadReminderCategoryImage(catId, file) {
  const path = `households/${householdId}/reminderCategories/${catId}-${Date.now()}.jpg`;
  const uploadRef = await uploadFileAndGetURL(srefFn(storageRefInstance, path), file);
  const url = await firebaseFns.getDownloadURL(uploadRef);
  await firebaseFns.updateDoc(
    firebaseFns.doc(householdRefRef, 'reminderCategories', catId),
    { img: url, updatedAt: firebaseFns.serverTimestamp() }
  );
}

async function handleReminderCategoryDelete() {
  const id = dom.reminderCatId?.value;
  if (!id) return;
  if (!confirm('למחוק את הקטגוריה? כל התזכורות יישארו ללא קטגוריה.')) return;

  showLoading('מוחק קטגוריה...');
  try {
    await firebaseFns.deleteDoc(firebaseFns.doc(householdRefRef, 'reminderCategories', id));
    dom.reminderCatModal?.classList.remove('show');
    if (selectedReminderCategory === id) {
      selectedReminderCategory = null;
      localStorage.removeItem(REMINDER_CATEGORY_KEY);
    }
    toast('קטגוריה נמחקה');
  } catch (err) {
    console.error(err);
    toast('שגיאה במחיקת קטגוריה', 3000);
  } finally {
    hideLoading();
  }
}

function openReminderEditor(mode = 'create', reminderId = null, categoryId = null) {
  pendingReminderCategoryId = categoryId || null;
  if (categoryId) {
    selectReminderCategory(categoryId);
  }

  if (!dom.reminderEditModal) return;
  dom.reminderId.value = reminderId || '';
  dom.reminderTitle.value = '';
  dom.reminderTime.value = '';
  dom.reminderNoteId.value = '';
  dom.reminderDelete.classList.add('hidden');
  
  // Reset image fields
  dom.reminderFile.value = '';
  dom.reminderFileName.textContent = 'לא נבחרה תמונה';
  dom.reminderPreview.classList.add('hidden');

  // Populate category dropdown
  if (dom.reminderCategory) {
    dom.reminderCategory.innerHTML = '';
    if (REMINDER_CATEGORIES.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— אין קטגוריות —';
      dom.reminderCategory.appendChild(opt);
    } else {
      for (const c of REMINDER_CATEGORIES) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label || '—';
        dom.reminderCategory.appendChild(opt);
      }
    }
  }

  populateReminderNotesDropdown();

  if (mode === 'edit' && reminderId) {
    const reminder = REMINDERS.find(r => r.id === reminderId);
    if (reminder) {
      dom.reminderTitle.value = reminder.title || '';
      if (reminder.time?.toDate) {
        dom.reminderTime.value = reminder.time.toDate().toISOString().slice(0, 16);
      }
      dom.reminderNoteId.value = reminder.noteId || '';
      if (reminder.category && dom.reminderCategory) {
        dom.reminderCategory.value = reminder.category;
      }
      
      // Show existing image if available
      if (reminder.img) {
        dom.reminderPreview.src = reminder.img;
        dom.reminderPreview.classList.remove('hidden');
      }
      
      dom.reminderDelete.classList.remove('hidden');
    }
  } else {
    // For create mode, set default category
    const defaultCategoryId = categoryId || selectedReminderCategory;
    if (defaultCategoryId && dom.reminderCategory) {
      dom.reminderCategory.value = defaultCategoryId;
    }
  }

  dom.reminderEditModal.classList.add('show');
}

function populateReminderNotesDropdown() {
  if (!dom.reminderNoteId) return;
  dom.reminderNoteId.innerHTML = '<option value="">ללא הערה</option>';
  getNotesSnapshotFn()
    .filter(note => !note.isDeleted && !note.isArchived)
    .forEach(note => {
      const option = document.createElement('option');
      option.value = note.id;
      option.textContent = note.title || 'ללא כותרת';
      dom.reminderNoteId.appendChild(option);
    });
}


async function handleReminderSave() {
  const title = (dom.reminderTitle?.value || '').trim();
  if (!title) {
    toast('הזן כותרת');
    return;
  }

  const noteId = dom.reminderNoteId?.value || null;
  const category = dom.reminderCategory?.value || pendingReminderCategoryId || selectedReminderCategory || null;

  if (!dom.reminderTime?.value) {
    toast('הזן תאריך ושעה');
    return;
  }
  
  const date = new Date(dom.reminderTime.value);
  if (Number.isNaN(date.getTime())) {
    toast('תאריך לא תקין');
    return;
  }

  showLoading('שומר תזכורת...');
  try {
    const reminderData = {
      title,
      type: 'time',
      time: firebaseFns.Timestamp.fromDate(date),
      noteId,
      isDone: false,
      category,
      updatedAt: firebaseFns.serverTimestamp()
    };

    let reminderId = dom.reminderId?.value || null;
    if (reminderId) {
      await firebaseFns.updateDoc(
        firebaseFns.doc(householdRefRef, 'reminders', reminderId),
        reminderData
      );
    } else {
      const ref = await firebaseFns.addDoc(remindersCol, { ...reminderData, createdAt: firebaseFns.serverTimestamp() });
      reminderId = ref.id;
    }
    
    // Upload image if provided
    if (dom.reminderFile?.files?.[0]) {
      showLoading('מעלה תמונה...');
      const path = `households/${householdId}/reminders/${reminderId}-${Date.now()}.jpg`;
      const uploadRef = await uploadFileAndGetURL(srefFn(storageRefInstance, path), dom.reminderFile.files[0]);
      const url = await firebaseFns.getDownloadURL(uploadRef);
      await firebaseFns.updateDoc(
        firebaseFns.doc(householdRefRef, 'reminders', reminderId),
        { img: url, updatedAt: firebaseFns.serverTimestamp() }
      );
    }

    dom.reminderEditModal?.classList.remove('show');
    pendingReminderCategoryId = null;
    toast('תזכורת נשמרה');
  } catch (err) {
    console.error(err);
    toast('שגיאה בשמירת תזכורת', 3000);
  } finally {
    hideLoading();
  }
}

async function handleReminderDelete() {
  const id = dom.reminderId?.value;
  if (!id) return;
  if (!confirm('למחוק את התזכורת?')) return;

  showLoading('מוחק תזכורת...');
  try {
    await firebaseFns.deleteDoc(firebaseFns.doc(householdRefRef, 'reminders', id));
    dom.reminderEditModal?.classList.remove('show');
    toast('תזכורת נמחקה');
  } catch (err) {
    console.error(err);
    toast('שגיאה במחיקה', 3000);
  } finally {
    hideLoading();
  }
}

function handleFilterChange(filter) {
  remindersFilter = filter;
  dom.remindersFilterAll?.classList.remove('active');
  dom.remindersFilterActive?.classList.remove('active');
  dom.remindersFilterDone?.classList.remove('active');
  if (filter === 'all') dom.remindersFilterAll?.classList.add('active');
  if (filter === 'active') dom.remindersFilterActive?.classList.add('active');
  if (filter === 'done') dom.remindersFilterDone?.classList.add('active');
  renderReminders();
}

// Notification functions are now imported from notifications.js

async function checkTimeReminders() {
  const now = new Date();
  REMINDERS.filter(r => r.type === 'time' && !r.isDone && r.time?.toDate).forEach(async reminder => {
    const reminderTime = reminder.time.toDate();
    if (reminderTime <= now) {
      // Show notification
      if (isNotificationEnabled()) {
        await showNotification(reminder, 'time');
      }
      // Mark as done
      firebaseFns
        .updateDoc(firebaseFns.doc(householdRefRef, 'reminders', reminder.id), {
          isDone: true,
          updatedAt: firebaseFns.serverTimestamp()
        })
        .catch(console.error);
    }
  });
}

async function startReminderChecking() {
  // Request notification permission if not already granted
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    console.warn('Notification permission not granted. Reminders will still work but without notifications.');
  }
  
  if (timeCheckInterval) clearInterval(timeCheckInterval);
  timeCheckInterval = setInterval(checkTimeReminders, 60000);
  checkTimeReminders();
}

function stopReminderChecking() {
  if (timeCheckInterval) clearInterval(timeCheckInterval);
}

