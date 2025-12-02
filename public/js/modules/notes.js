import { toast, showLoading, hideLoading } from '/utils/helpers.js';
import { uploadFileAndGetURL } from '../utils/upload.js';

const NOTE_CATEGORY_KEY = 'selectedNoteCategory';

let householdRefRef;
let householdId; // Store household ID for storage paths
let firebaseFns;
let srefFn;
let storageRefInstance;
let getCurrentViewFn = () => 'notes';

let notesCol;
let noteCategoriesCol;
let NOTE_CATEGORIES = [];
let NOTES = [];
let selectedNoteCategory = null;
let notesUnsub = null;
let noteCategoriesUnsub = null;
let notesViewMode = 'grid';

const dom = {};
const selectors = {
  notesSearch: '#search',
  notesContainer: '#notesContainer',
  notesFilterBtn: '#notesFilterBtn',
  notesFilters: '#notesFilters',
  notesViewToggle: '#notesViewToggle',
  addNoteBtn: '#addNoteBtn',
  filterPinned: '#filterPinned',
  filterArchived: '#filterArchived',
  filterTrash: '#filterTrash',
  notesCategoriesList: '#notesCategoriesList',
  notesCategoriesNav: '#notesCategoriesNav',
  noteEditModal: '#noteEditModal',
  noteId: '#noteId',
  noteTitle: '#noteTitle',
  noteContent: '#noteContent',
  notePinned: '#notePinned',
  noteArchived: '#noteArchived',
  noteLabels: '#noteLabels',
  noteColor: '#noteColor',
  noteFile: '#noteFile',
  noteFileName: '#noteFileName',
  notePreview: '#notePreview',
  noteSave: '#noteSave',
  noteDelete: '#noteDelete',
  noteDeleteForever: '#noteDeleteForever',
  noteCatModal: '#noteCatModal',
  noteCatId: '#noteCatId',
  noteCatName: '#noteCatName',
  noteCatPinned: '#noteCatPinned',
  noteCatFile: '#noteCatFile',
  noteCatFileName: '#noteCatFileName',
  noteCatPreview: '#noteCatPreview',
  noteCatColor: '#noteCatColor',
  noteCatSave: '#noteCatSave',
  noteCatDelete: '#noteCatDelete',
  noteCatModalTitle: '#noteCatModalTitle'
};

export function initNotes({
  householdRef,
  firebase,
  sref,
  storage,
  getCurrentView
}) {
  householdRefRef = householdRef;
  householdId = householdRef?.id || null; // Extract household ID for storage paths
  firebaseFns = firebase;
  srefFn = sref;
  storageRefInstance = storage;
  getCurrentViewFn = getCurrentView || (() => 'notes');

  // Load saved view mode preference
  try {
    const saved = localStorage.getItem('gsh-notes-view-mode');
    if (saved === 'grid' || saved === 'list') {
      notesViewMode = saved;
    }
  } catch (e) {}

  notesCol = firebaseFns.collection(householdRefRef, 'notes');
  noteCategoriesCol = firebaseFns.collection(householdRefRef, 'noteCategories');

  cacheDom();
  wireEvents();
  loadNoteCategories();
  loadNotes();
  
  // Update toggle button text based on current mode
  if (dom.notesViewToggle) {
    dom.notesViewToggle.textContent = notesViewMode === 'grid' ? 'תצוגת רשימה' : 'תצוגת רשת';
  }

  // Make openNoteEditor globally accessible
  if (typeof window !== 'undefined') {
    window.openNoteEditor = openNoteEditor;
  }
  
  return {
    handleViewChange: handleViewChange,
    getNotes: () => [...NOTES],
    openNoteEditor: openNoteEditor
  };
}

function cacheDom() {
  Object.entries(selectors).forEach(([key, selector]) => {
    dom[key] = document.querySelector(selector);
  });
}

function wireEvents() {
  dom.noteCatModal?.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', () => dom.noteCatModal?.classList.remove('show'))
  );
  dom.noteEditModal?.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', () => dom.noteEditModal?.classList.remove('show'))
  );

  dom.noteCatFile?.addEventListener('change', () => {
    dom.noteCatFileName.textContent = dom.noteCatFile.files?.[0]?.name || 'לא נבחרה תמונה';
    if (dom.noteCatFile.files?.[0]) {
      dom.noteCatPreview.src = URL.createObjectURL(dom.noteCatFile.files[0]);
    }
  });
  
  // Note image upload
  dom.noteFile?.addEventListener('change', () => {
    dom.noteFileName.textContent = dom.noteFile.files?.[0]?.name || 'לא נבחרה תמונה';
    if (dom.noteFile.files?.[0]) {
      dom.notePreview.src = URL.createObjectURL(dom.noteFile.files[0]);
      dom.notePreview.classList.remove('hidden');
    } else {
      dom.notePreview.classList.add('hidden');
    }
  });

  dom.notesSearch?.addEventListener('input', renderNotes);
  dom.notesFilterBtn?.addEventListener('click', () => dom.notesFilters?.classList.toggle('hidden'));
  dom.filterPinned?.addEventListener('change', renderNotes);
  dom.filterArchived?.addEventListener('change', renderNotes);
  dom.filterTrash?.addEventListener('change', renderNotes);
  dom.notesViewToggle?.addEventListener('click', toggleNotesView);
  dom.addNoteBtn?.addEventListener('click', () => openNoteEditor('create'));

  dom.noteSave?.addEventListener('click', handleNoteSave);
  dom.noteDelete?.addEventListener('click', () => handleNoteDelete(false));
  dom.noteDeleteForever?.addEventListener('click', () => handleNoteDelete(true));

  dom.noteCatSave?.addEventListener('click', handleNoteCategorySave);
  dom.noteCatDelete?.addEventListener('click', handleNoteCategoryDelete);
  dom.noteCatModal?.querySelectorAll('.color-option').forEach(btn =>
    btn.addEventListener('click', () => selectNoteCategoryColor(btn.dataset.color))
  );
  
  // Wire up note editor color options
  dom.noteEditModal?.querySelectorAll('.note-color-option').forEach(btn =>
    btn.addEventListener('click', () => selectNoteColor(btn.dataset.color))
  );
}

function selectNoteColor(color) {
  dom.noteColor.value = color;
  dom.noteEditModal?.querySelectorAll('.note-color-option').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-4');
    const borderColor = btn.style.borderColor;
    btn.style.borderWidth = '2px';
    if (btn.dataset.color === color) {
      btn.classList.add('ring-4');
      btn.style.borderWidth = '3px';
    }
  });
}

function handleViewChange(view) {
  if (view === 'notes') {
    // Re-cache DOM in case elements weren't available during initial load
    cacheDom();
    // Wire up the view toggle button if it wasn't wired before
    const toggleBtn = document.getElementById('notesViewToggle');
    if (toggleBtn && !toggleBtn.hasAttribute('data-wired')) {
      toggleBtn.setAttribute('data-wired', 'true');
      toggleBtn.addEventListener('click', toggleNotesView);
      dom.notesViewToggle = toggleBtn;
      // Update button text based on current mode
      toggleBtn.textContent = notesViewMode === 'grid' ? 'תצוגת רשימה' : 'תצוגת רשת';
    }
    renderNotesCategoriesBar();
    renderNotes();
  } else {
    // Hide notes categories when switching to other views
    hideNotesNav();
    // Also clear the categories list to prevent showing wrong categories
    if (dom.notesCategoriesList) {
      dom.notesCategoriesList.innerHTML = '';
    }
  }
}

function loadNoteCategories() {
  firebaseFns
    .getDocs(firebaseFns.query(noteCategoriesCol, firebaseFns.orderBy('order', 'asc')))
    .then(qs => {
      NOTE_CATEGORIES = qs.docs.map(normalizeNoteCategory);
      renderNotesCategoriesBar();
      const saved = localStorage.getItem(NOTE_CATEGORY_KEY);
      if (saved && NOTE_CATEGORIES.find(c => c.id === saved)) {
        selectNoteCategory(saved);
      } else if (!selectedNoteCategory && NOTE_CATEGORIES.length) {
        selectNoteCategory(NOTE_CATEGORIES[0].id);
      }
    })
    .catch(console.error);

  noteCategoriesUnsub = firebaseFns.onSnapshot(
    firebaseFns.query(noteCategoriesCol, firebaseFns.orderBy('order', 'asc')),
    qs => {
      NOTE_CATEGORIES = qs.docs.map(normalizeNoteCategory);
      renderNotesCategoriesBar();
      const saved = localStorage.getItem(NOTE_CATEGORY_KEY);
      if (saved && NOTE_CATEGORIES.find(c => c.id === saved)) {
        selectNoteCategory(saved);
      } else if (!selectedNoteCategory && NOTE_CATEGORIES.length) {
        selectNoteCategory(NOTE_CATEGORIES[0].id);
      }
    }
  );
}

function normalizeNoteCategory(docSnap) {
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

function loadNotes() {
  notesUnsub = firebaseFns.onSnapshot(
    firebaseFns.query(notesCol, firebaseFns.orderBy('updatedAt', 'desc')),
    qs => {
      NOTES = qs.docs.map(d => ({ id: d.id, ...d.data() }));
      renderNotes();
      renderNotesCategoriesBar();
    }
  );
}

function renderNotes() {
  const container = dom.notesContainer;
  if (!container || getCurrentViewFn() !== 'notes') return;

  // Update container class based on view mode - clear first to ensure clean update
  container.className = '';
  if (notesViewMode === 'grid') {
    container.classList.add('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-3');
  } else {
    container.classList.add('flex', 'flex-col', 'gap-3');
  }

  const searchTerm = (dom.notesSearch?.value || '').trim().toLowerCase();
  const filterPinned = dom.filterPinned?.checked;
  const filterArchived = dom.filterArchived?.checked;
  const filterTrash = dom.filterTrash?.checked;

  let filtered = NOTES.filter(note => {
    if (selectedNoteCategory && note.category !== selectedNoteCategory) return false;
    if (note.isDeleted && !filterTrash) return false;
    if (!note.isDeleted && filterTrash) return false;
    if (note.isArchived && !filterArchived && !filterTrash) return false;
    if (!note.isArchived && filterArchived && !filterTrash) return false;
    if (filterPinned && !note.isPinned) return false;
    if (searchTerm) {
      const title = (note.title || '').toLowerCase();
      const content = (note.content || '').toLowerCase();
      return title.includes(searchTerm) || content.includes(searchTerm);
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    const ta = a.updatedAt?.toMillis?.() || 0;
    const tb = b.updatedAt?.toMillis?.() || 0;
    return tb - ta;
  });

  container.innerHTML = '';

  if (filtered.length === 0) {
    const emptyClass = notesViewMode === 'grid' ? 'col-span-full text-center p-8' : 'text-center p-8';
    container.innerHTML = `<div class="${emptyClass}" style="color:var(--muted);">אין הערות להצגה</div>`;
    return;
  }

  filtered.forEach(note => {
    const card = document.createElement('div');
    card.className = 'row cursor-pointer';
    if (notesViewMode === 'list') {
      card.style.width = '100%';
      card.style.maxWidth = '100%';
    }
    // Only override background if note has a custom color
    if (note.color && note.color !== '#ffffff') {
      card.style.background = note.color;
    }
    if (note.isPinned) card.style.borderLeft = '4px solid #fbbf24';

    const title = note.title || '';
    const content = (note.content || '').substring(0, 100);
    const labels = note.labels || [];

    card.innerHTML = `
      ${note.isPinned ? '<div class="text-xs mb-1" style="color:var(--muted);">📌 מוצמד</div>' : ''}
      ${title ? `<div class="font-semibold mb-1 text-sm">${title}</div>` : ''}
      ${content ? `<div class="text-xs mb-2" style="color:var(--muted);">${content}${note.content?.length > 100 ? '...' : ''}</div>` : ''}
      ${note.img ? `<img src="${note.img}" class="w-full rounded border object-cover mb-2" style="max-height:150px; border-color:var(--border);" alt="${title}">` : ''}
      ${
        labels.length > 0
          ? `<div class="flex flex-wrap gap-1 mb-2">
            ${labels.map(l => `<span class="text-xs px-2 py-0.5 rounded" style="background:var(--card); color:var(--text);">${l}</span>`).join('')}
          </div>`
          : ''
      }
      <div class="text-xs" style="color:var(--muted);">${note.updatedAt ? new Date(note.updatedAt.toMillis()).toLocaleDateString('he-IL') : ''}</div>
    `;

    card.addEventListener('click', () => openNoteEditor('edit', note.id));
    container.appendChild(card);
  });
}

function renderNotesCategoriesBar() {
  const list = dom.notesCategoriesList;
  if (!list) return;

  if (getCurrentViewFn() !== 'notes') {
    hideNotesNav();
    list.innerHTML = '';
    return;
  }

  const nav = dom.notesCategoriesNav;
  if (nav) {
    nav.style.setProperty('display', 'block', 'important');
    nav.style.setProperty('visibility', 'visible', 'important');
  }

  list.innerHTML = '';
  NOTE_CATEGORIES.forEach(cat => {
    const holder = document.createElement('button');
    holder.className = 'cat flex flex-col items-center w-16 relative';
    holder.dataset.id = cat.id;
    const count = NOTES.filter(n => n.category === cat.id && !n.isDeleted && !n.isArchived).length;
    holder.innerHTML = `
      ${cat.pinned ? '<span class="absolute top-0 left-1 text-amber-500 text-xs">★</span>' : ''}
      ${count > 0 ? `<span class="badge">${count}</span>` : '<span class="badge hidden" style="display:none;visibility:hidden;"></span>'}
      ${
        cat.img
          ? `<img class="w-14 h-14 rounded-full border object-cover ${cat.id === selectedNoteCategory ? 'selected' : ''}" src="${cat.img}" alt="">`
          : `<div class="w-14 h-14 rounded-full border-2 flex items-center justify-center ${cat.id === selectedNoteCategory ? 'selected' : ''}" style="border-color:${cat.color};background:${cat.color}20;">
              <div class="w-10 h-10 rounded-full" style="background:${cat.color};"></div>
            </div>`
      }
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
        selectNoteCategory(cat.id);
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
      openNoteCategoryEditor('edit', cat.id);
    });
    holder.addEventListener('contextmenu', e => {
      e.preventDefault();
      openNoteEditor('create', null, cat.id);
    });
    list.appendChild(holder);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'cat flex flex-col items-center w-16';
  addBtn.innerHTML = `<img class="w-14 h-14 rounded-full border object-cover" src="/add.png" alt=""><span class="text-[11px] mt-1">הוסף</span>`;
  addBtn.addEventListener('click', () => openNoteCategoryEditor('create'));
  list.appendChild(addBtn);
}

function selectNoteCategory(catId) {
  selectedNoteCategory = catId;
  try {
    localStorage.setItem(NOTE_CATEGORY_KEY, catId || '');
  } catch (_) {}
  renderNotes();
  renderNotesCategoriesBar();
}

function openNoteCategoryEditor(mode = 'create', catId = null) {
  if (!dom.noteCatModal) return;
  dom.noteCatId.value = catId || '';
  dom.noteCatName.value = '';
  dom.noteCatPreview.src = '/cat.png';
  dom.noteCatPinned.checked = false;
  dom.noteCatFile.value = '';
  dom.noteCatFileName.textContent = 'לא נבחרה תמונה';
  dom.noteCatColor.value = '#3b82f6';
  dom.noteCatDelete.classList.toggle('hidden', mode !== 'edit');
  dom.noteCatModalTitle.textContent = mode === 'edit' ? 'עריכת קטגוריית פתקים' : 'קטגוריית פתקים חדשה';

  dom.noteCatModal.querySelectorAll('.color-option').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2');
    btn.style.borderColor = 'var(--border)';
    if (btn.dataset.color === dom.noteCatColor.value) {
      btn.classList.add('ring-2', 'ring-offset-2');
      btn.style.borderColor = dom.noteCatColor.value;
    }
  });

  if (mode === 'edit' && catId) {
    const cat = NOTE_CATEGORIES.find(c => c.id === catId);
    if (cat) {
      dom.noteCatName.value = cat.label || '';
      dom.noteCatPreview.src = cat.img || '/cat.png';
      dom.noteCatPinned.checked = !!cat.pinned;
      dom.noteCatColor.value = cat.color || '#3b82f6';
    }
  }

  dom.noteCatModal.classList.add('show');
}

function selectNoteCategoryColor(color) {
  dom.noteCatColor.value = color;
  dom.noteCatModal?.querySelectorAll('.color-option').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-offset-2');
    btn.style.borderColor = 'var(--border)';
    if (btn.dataset.color === color) {
      btn.classList.add('ring-2', 'ring-offset-2');
      btn.style.borderColor = color;
    }
  });
}

function handleNoteCategorySave() {
  const name = (dom.noteCatName.value || '').trim();
  if (!name) {
    toast('צריך שם קטגוריה');
    return;
  }
  const pinned = dom.noteCatPinned.checked;
  const color = dom.noteCatColor.value || '#3b82f6';
  const id = dom.noteCatId.value || null;

  showLoading('שומר קטגוריה...');
  (async () => {
    try {
      let imgUrl = '';
      if (dom.noteCatFile.files?.[0]) {
        showLoading('מעלה תמונה...');
        const path = `households/${householdId}/noteCategories/${id || 'new'}-${Date.now()}.jpg`;
        const uploadRef = await uploadFileAndGetURL(srefFn(storageRefInstance, path), dom.noteCatFile.files[0]);
        imgUrl = await firebaseFns.getDownloadURL(uploadRef);
      } else if (id) {
        const existing = NOTE_CATEGORIES.find(c => c.id === id);
        if (existing) imgUrl = existing.img || '';
      }

      const data = { label: name, pinned, color, updatedAt: firebaseFns.serverTimestamp() };
      if (imgUrl) data.img = imgUrl;

      if (id) {
        await firebaseFns.setDoc(firebaseFns.doc(householdRefRef, 'noteCategories', id), data, { merge: true });
      } else {
        const maxOrder = NOTE_CATEGORIES.length > 0 ? Math.max(...NOTE_CATEGORIES.map(c => c.order || 0)) : 0;
        await firebaseFns.addDoc(noteCategoriesCol, { ...data, order: maxOrder + 1 });
      }
      dom.noteCatModal.classList.remove('show');
      toast('קטגוריה נשמרה בהצלחה');
    } catch (e) {
      console.error(e);
      toast('שגיאה בשמירת קטגוריה', 3000);
    } finally {
      hideLoading();
    }
  })();
}

function handleNoteCategoryDelete() {
  const id = dom.noteCatId.value;
  if (!id) return;
  if (!confirm('למחוק את הקטגוריה?')) return;
  showLoading('מוחק קטגוריה...');
  firebaseFns
    .deleteDoc(firebaseFns.doc(householdRefRef, 'noteCategories', id))
    .then(() => {
      dom.noteCatModal.classList.remove('show');
      toast('קטגוריה נמחקה');
    })
    .catch(e => {
      console.error(e);
      toast('שגיאה במחיקה', 3000);
    })
    .finally(hideLoading);
}

function openNoteEditor(mode = 'create', noteId = null, categoryId = null) {
  if (!dom.noteEditModal) return;
  dom.noteId.value = noteId || '';
  dom.noteTitle.value = '';
  dom.noteContent.value = '';
  dom.notePinned.checked = false;
  dom.noteArchived.checked = false;
  dom.noteLabels.value = '';
  dom.noteColor.value = '#dbeafe'; // Default to light blue pastel
  dom.noteDelete.classList.add('hidden');
  dom.noteDeleteForever.classList.add('hidden');
  
  // Reset image fields
  dom.noteFile.value = '';
  dom.noteFileName.textContent = 'לא נבחרה תמונה';
  dom.notePreview.classList.add('hidden');

  // Reset and highlight selected color
  dom.noteEditModal?.querySelectorAll('.note-color-option').forEach(btn => {
    btn.classList.remove('ring-2', 'ring-4');
    btn.style.borderWidth = '2px';
    if (btn.dataset.color === dom.noteColor.value) {
      btn.classList.add('ring-4');
      btn.style.borderWidth = '3px';
    }
  });
  
  // Ensure color options are wired up when modal opens
  dom.noteEditModal?.querySelectorAll('.note-color-option').forEach(btn => {
    // Remove existing listeners by cloning
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener('click', () => selectNoteColor(newBtn.dataset.color));
  });

  // Populate category dropdown
  if (dom.noteCategory) {
    dom.noteCategory.innerHTML = '';
    if (NOTE_CATEGORIES.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— אין קטגוריות —';
      dom.noteCategory.appendChild(opt);
    } else {
      for (const c of NOTE_CATEGORIES) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label || '—';
        dom.noteCategory.appendChild(opt);
      }
    }
  }

  if (mode === 'edit' && noteId) {
    const note = NOTES.find(n => n.id === noteId);
    if (note) {
      dom.noteTitle.value = note.title || '';
      dom.noteContent.value = note.content || '';
      dom.notePinned.checked = !!note.isPinned;
      dom.noteArchived.checked = !!note.isArchived;
      dom.noteLabels.value = (note.labels || []).join(', ');
      dom.noteColor.value = note.color || '#dbeafe';
      
      // Update color button selection
      dom.noteEditModal?.querySelectorAll('.note-color-option').forEach(btn => {
        btn.classList.remove('ring-2', 'ring-4');
        btn.style.borderWidth = '2px';
        if (btn.dataset.color === dom.noteColor.value) {
          btn.classList.add('ring-4');
          btn.style.borderWidth = '3px';
        }
      });
      if (note.category && dom.noteCategory) {
        dom.noteCategory.value = note.category;
      }
      
      // Show existing image if available
      if (note.img) {
        dom.notePreview.src = note.img;
        dom.notePreview.classList.remove('hidden');
      }

      if (note.isDeleted) {
        dom.noteDelete.classList.add('hidden');
        dom.noteDeleteForever.classList.remove('hidden');
      } else {
        dom.noteDelete.classList.remove('hidden');
        dom.noteDeleteForever.classList.add('hidden');
      }
    }
  } else {
    // For create mode, set default category
    const defaultCategoryId = categoryId || selectedNoteCategory;
    if (defaultCategoryId && dom.noteCategory) {
      dom.noteCategory.value = defaultCategoryId;
    }
  }

  dom.noteEditModal.classList.add('show');
}

function handleNoteSave() {
  const title = (dom.noteTitle.value || '').trim();
  const content = (dom.noteContent.value || '').trim();
  const labels = (dom.noteLabels.value || '').split(',').map(l => l.trim()).filter(l => l);
  const color = dom.noteColor.value || '#dbeafe';
  const pinned = dom.notePinned.checked;
  const archived = dom.noteArchived.checked;
  const id = dom.noteId.value || null;
  const category = dom.noteCategory?.value || selectedNoteCategory || null;

  if (!title && !content) {
    toast('הזן כותרת או תוכן');
    return;
  }

  const noteData = {
    title,
    content,
    labels,
    color,
    category: category || selectedNoteCategory || null,
    isPinned: pinned,
    isArchived: archived,
    isDeleted: false,
    updatedAt: firebaseFns.serverTimestamp()
  };

  showLoading('שומר הערה...');
  (async () => {
    try {
      let noteId = id;
      if (noteId) {
        await firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'notes', noteId), noteData);
      } else {
        const ref = await firebaseFns.addDoc(notesCol, { ...noteData, createdAt: firebaseFns.serverTimestamp() });
        noteId = ref.id;
      }
      
      // Upload image if provided
      if (dom.noteFile.files?.[0]) {
        showLoading('מעלה תמונה...');
        const path = `households/${householdId}/notes/${noteId}-${Date.now()}.jpg`;
        const uploadRef = await uploadFileAndGetURL(srefFn(storageRefInstance, path), dom.noteFile.files[0]);
        const url = await firebaseFns.getDownloadURL(uploadRef);
        await firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'notes', noteId), { img: url, updatedAt: firebaseFns.serverTimestamp() });
      }
      
      dom.noteEditModal.classList.remove('show');
      toast('הערה נשמרה');
    } catch (e) {
      console.error('Note save error:', e);
      const errorMsg = e.message || e.code || 'נסה שוב';
      toast('שגיאה בשמירת הערה: ' + errorMsg, 4000);
    } finally {
      hideLoading();
    }
  })();
}

function handleNoteDelete(permanent) {
  const id = dom.noteId.value;
  if (!id) return;
  if (!confirm(permanent ? 'למחוק לצמיתות?' : 'למחוק את ההערה?')) return;

  showLoading(permanent ? 'מוחק לצמיתות...' : 'מוחק הערה...');
  const op = permanent
    ? firebaseFns.deleteDoc(firebaseFns.doc(householdRefRef, 'notes', id))
    : firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'notes', id), {
        isDeleted: true,
        updatedAt: firebaseFns.serverTimestamp()
      });

  op.then(() => {
    dom.noteEditModal.classList.remove('show');
    toast(permanent ? 'הערה נמחקה לצמיתות' : 'הערה נמחקה');
  })
    .catch(e => {
      console.error(e);
      toast('שגיאה במחיקה', 3000);
    })
    .finally(hideLoading);
}

function toggleNotesView() {
  notesViewMode = notesViewMode === 'grid' ? 'list' : 'grid';
  // Save preference
  try {
    localStorage.setItem('gsh-notes-view-mode', notesViewMode);
  } catch (e) {}
  
  if (dom.notesViewToggle) {
    dom.notesViewToggle.textContent = notesViewMode === 'grid' ? 'תצוגת רשימה' : 'תצוגת רשת';
  }
  renderNotes();
}

function hideNotesNav() {
  const nav = dom.notesCategoriesNav;
  if (nav) {
    nav.style.setProperty('display', 'none', 'important');
    nav.style.setProperty('visibility', 'hidden', 'important');
  }
}

