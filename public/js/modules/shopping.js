import { loadImageWithCache } from '../utils/imageCache.js';
import { uploadFileAndGetURL } from '../utils/upload.js';
import { parseDateStr, iso } from '../utils/dateUtils.js';
import { toast, showLoading, hideLoading, fmtMoney, validateName, validatePrice, validateQuantity } from '/utils/helpers.js';
import { createElement, setTextContent } from '../utils/dom.js';

let CATEGORIES = [];
const CATEGORY_TODO_COUNTS = {};
const CATEGORY_URGENT_COUNTS = {};
// BEST PRACTICE: Store only items for the currently selected category
// This prevents mixing items from different categories
let CURRENT_ITEMS = []; // Simple array, only items for current category
let selectedCategory = null;
let _itemsUnsub = null;
let _listeningForCategory = null; // Track which category the listener is for
let _loadingCategory = null; // Track which category is currently loading to prevent duplicate calls
let _todoUnsubs = [];
let parsedImportItems = [];
let userTemplates = [];
let summaryStatsRef = null;
let updateSummaryUIFn = () => {};
let getCurrentViewFn = () => 'shopping';

let householdRefRef;
let householdId; // Store household ID for storage paths
let storageRef;
let firebaseFns;
let srefFn;

// DOM references
let catTitle;
let importBtn;
let templatesBtn;
let searchEl;
let clearSearchBtn;
let openCountEl;
let mainView;
let shoppingCategoriesList;
let catModal;
let catIdEl;
let catName;
let catPinned;
let catFile;
let catFileName;
let catPreview;
let catSave;
let catDelete;
let catModalTitle;
let qaModal;
let qaName;
let qaDesc;
let qaNote;
let qaQty;
let qaPrice;
let qaFile;
let qaFileName;
let qaCategory;
let qaSave;
let ieModal;
let ieId;
let ieName;
let ieDesc;
let ieNote;
let ieQty;
let iePrice;
let ieFile;
let ieFileName;
let iePreview;
let ieCategory;
let ieSave;
let ieDelete;
let importModal;
let importCategorySelect;
let importTextArea;
let importPreview;
let importCountEl;
let importErrorsEl;
let importAddBtn;
let templatesModal;
let templateCategorySelect;
let userTemplatesList;
let presetTemplatesList;
let templateNameInput;
let templateSaveBtn;

const rowCleanups = new WeakMap();

export function initShopping({
  householdRef,
  storage,
  firebase,
  sref,
  summaryStats,
  updateSummaryUI,
  getCurrentView
}) {
  householdRefRef = householdRef;
  householdId = householdRef?.id || null; // Extract household ID for storage paths
  storageRef = storage;
  firebaseFns = firebase;
  srefFn = sref;
  summaryStatsRef = summaryStats;
  updateSummaryUIFn = updateSummaryUI || (() => {});
  getCurrentViewFn = getCurrentView || (() => 'shopping');

  cacheDomReferences();
  setupEventListeners();
  primeCategories();
}

function cacheDomReferences() {
  catTitle = document.getElementById('catTitle');
  importBtn = document.getElementById('importBtn');
  templatesBtn = document.getElementById('templatesBtn');
  searchEl = document.getElementById('search');
  clearSearchBtn = document.getElementById('clearSearch');
  openCountEl = document.getElementById('openCount');
  mainView = document.getElementById('mainView');
  shoppingCategoriesList = document.getElementById('shoppingCategoriesList');
  catModal = document.getElementById('catModal');
  catIdEl = document.getElementById('catId');
  catName = document.getElementById('catName');
  catPinned = document.getElementById('catPinned');
  catFile = document.getElementById('catFile');
  catFileName = document.getElementById('catFileName');
  catPreview = document.getElementById('catPreview');
  catSave = document.getElementById('catSave');
  catDelete = document.getElementById('catDelete');
  catModalTitle = document.getElementById('catModalTitle');
  qaModal = document.getElementById('quickAddModal');
  qaName = document.getElementById('qaName');
  qaDesc = document.getElementById('qaDesc');
  qaNote = document.getElementById('qaNote');
  qaQty = document.getElementById('qaQty');
  qaPrice = document.getElementById('qaPrice');
  qaFile = document.getElementById('qaFile');
  qaFileName = document.getElementById('qaFileName');
  qaCategory = document.getElementById('qaCategory');
  qaSave = document.getElementById('qaSave');
  ieModal = document.getElementById('itemEditModal');
  ieId = document.getElementById('ieId');
  ieName = document.getElementById('ieName');
  ieDesc = document.getElementById('ieDesc');
  ieNote = document.getElementById('ieNote');
  ieQty = document.getElementById('ieQty');
  iePrice = document.getElementById('iePrice');
  ieFile = document.getElementById('ieFile');
  ieFileName = document.getElementById('ieFileName');
  iePreview = document.getElementById('iePreview');
  ieCategory = document.getElementById('ieCategory');
  ieSave = document.getElementById('ieSave');
  ieDelete = document.getElementById('ieDelete');
  importModal = document.getElementById('importModal');
  importCategorySelect = document.getElementById('importCategory');
  importTextArea = document.getElementById('importText');
  importPreview = document.getElementById('importPreview');
  importCountEl = document.getElementById('importCount');
  importErrorsEl = document.getElementById('importErrors');
  importAddBtn = document.getElementById('importAddBtn');
  templatesModal = document.getElementById('templatesModal');
  templateCategorySelect = document.getElementById('templateCategorySelect');
  userTemplatesList = document.getElementById('userTemplatesList');
  presetTemplatesList = document.getElementById('presetTemplatesList');
  templateNameInput = document.getElementById('templateNameInput');
  templateSaveBtn = document.getElementById('templateSaveBtn');
}

function setupEventListeners() {
  document.querySelectorAll('#catModal [data-close]').forEach(el =>
    el.addEventListener('click', () => catModal?.classList.remove('show'))
  );

  catFile?.addEventListener('change', () => {
    catFileName.textContent = catFile.files?.[0]?.name || 'לא נבחרה תמונה';
    if (catFile.files?.[0]) catPreview.src = URL.createObjectURL(catFile.files[0]);
  });

  catSave?.addEventListener('click', handleSaveCategory);
  catDelete?.addEventListener('click', handleDeleteCategory);

  document.querySelectorAll('#quickAddModal [data-close]').forEach(el =>
    el.addEventListener('click', () => qaModal?.classList.remove('show'))
  );
  qaFile?.addEventListener('change', () => {
    qaFileName.textContent = qaFile.files?.[0]?.name || 'לא נבחרה תמונה';
  });
  qaSave?.addEventListener('click', handleQuickAddSave);

  document.querySelectorAll('#itemEditModal [data-close]').forEach(el =>
    el.addEventListener('click', () => ieModal?.classList.remove('show'))
  );
  ieFile?.addEventListener('change', () => {
    ieFileName.textContent = ieFile.files?.[0]?.name || 'לא נבחרה תמונה';
    if (ieFile.files?.[0]) iePreview.src = URL.createObjectURL(ieFile.files[0]);
  });
  ieSave?.addEventListener('click', handleItemSave);
  ieDelete?.addEventListener('click', handleItemDelete);

  importBtn?.addEventListener('click', openImportModal);
  document.querySelectorAll('#importModal [data-close]').forEach(el =>
    el.addEventListener('click', closeImportModal)
  );
  importCategorySelect?.addEventListener('change', () => updateImportPreview(importTextArea.value));
  importTextArea?.addEventListener('input', () => updateImportPreview(importTextArea.value));
  importAddBtn?.addEventListener('click', importParsedItems);

  document.getElementById('addShoppingItemBtn')?.addEventListener('click', () => {
    if (selectedCategory) {
      openQuickAdd(selectedCategory);
    } else if (CATEGORIES.length > 0) {
      openQuickAdd(CATEGORIES[0].id);
    } else {
      toast('אין קטגוריות זמינות');
    }
  });

  templatesBtn?.addEventListener('click', openTemplatesModal);
  document.querySelectorAll('#templatesModal [data-close]').forEach(el =>
    el.addEventListener('click', closeTemplatesModal)
  );
  templateSaveBtn?.addEventListener('click', saveTemplateFromCurrent);
  userTemplatesList?.addEventListener('click', handleTemplateListClick);
  presetTemplatesList?.addEventListener('click', handleTemplateListClick);

  if (searchEl) {
    ['input', 'change', 'keyup', 'search'].forEach(ev =>
      searchEl.addEventListener(ev, debouncedDrawItems)
    );
  }
  clearSearchBtn?.addEventListener('click', () => {
    searchEl.value = '';
    drawItems();
    searchEl.focus();
  });
}

// REBUILT: Simple category loading
function primeCategories() {
  // Start real-time listener immediately
  onCategoriesSnapshot();
}

// MIGRATION FUNCTION: Ensure all items have a category field and fix wrong categories
async function migrateItemsWithoutCategory() {
  if (CATEGORIES.length === 0) {
    return; // No categories yet, can't migrate
  }
  
  const { collection, query, getDocs, doc, updateDoc, serverTimestamp, where } = firebaseFns;
  const itemsCol = collection(householdRefRef, 'items');
  
  try {
    // Get ALL items (no category filter) to audit all items
    const allItemsSnapshot = await getDocs(itemsCol);
    const itemsToFix = [];
    const itemsWithInvalidCategory = [];
    
    // Get valid category IDs
    const validCategoryIds = CATEGORIES.map(c => c.id);
    
    allItemsSnapshot.forEach((itemDoc) => {
      const data = itemDoc.data();
      
      // Check if item is missing category field
      if (!data.category) {
        itemsToFix.push({ id: itemDoc.id, data, reason: 'missing category' });
      }
      // Check if item has invalid category (category doesn't exist)
      else if (!validCategoryIds.includes(data.category)) {
        itemsWithInvalidCategory.push({ id: itemDoc.id, data, invalidCategory: data.category, reason: 'invalid category' });
      }
    });
    
    if (itemsToFix.length === 0 && itemsWithInvalidCategory.length === 0) {
      console.log('[Migration] All items have valid category fields');
      return;
    }
    
    console.log('[Migration] Found', itemsToFix.length, 'items without category and', itemsWithInvalidCategory.length, 'items with invalid category');
    
    // Assign items without category or with invalid category to the first category
    const defaultCategoryId = CATEGORIES[0].id;
    
    // Fix items without category
    for (const item of itemsToFix) {
      try {
        await updateDoc(doc(householdRefRef, 'items', item.id), {
          category: defaultCategoryId,
          updatedAt: serverTimestamp()
        });
        console.log('[Migration] Fixed item', item.id, '- assigned to category:', defaultCategoryId, '(was missing category)');
      } catch (err) {
        console.error('[Migration] Error fixing item', item.id, ':', err);
      }
    }
    
    // Fix items with invalid category
    for (const item of itemsWithInvalidCategory) {
      try {
        await updateDoc(doc(householdRefRef, 'items', item.id), {
          category: defaultCategoryId,
          updatedAt: serverTimestamp()
        });
        console.log('[Migration] Fixed item', item.id, '- changed category from', item.invalidCategory, 'to', defaultCategoryId);
      } catch (err) {
        console.error('[Migration] Error fixing item', item.id, ':', err);
      }
    }
    
    const totalFixed = itemsToFix.length + itemsWithInvalidCategory.length;
    if (totalFixed > 0) {
      console.log('[Migration] Migration complete - fixed', totalFixed, 'items');
      toast(`תוקנו ${totalFixed} פריטים`, 2000);
    }
  } catch (error) {
    console.error('[Migration] Error during migration:', error);
  }
}

// COMPREHENSIVE AUDIT: Check ALL items across ALL categories to find wrong assignments
async function auditAllItemsByCategory() {
  if (CATEGORIES.length === 0) return;
  
  console.log('[Audit] ========== STARTING COMPREHENSIVE ITEM CATEGORY AUDIT ==========');
  const { collection, getDocs, doc, getDoc } = firebaseFns;
  const itemsCol = collection(householdRefRef, 'items');
  
  try {
    // Get ALL items from database (no filter)
    const allItemsSnapshot = await getDocs(itemsCol);
    const itemsByCategory = {};
    const validCategoryIds = CATEGORIES.map(c => String(c.id));
    
    console.log('[Audit] Total items in database:', allItemsSnapshot.size);
    console.log('[Audit] Valid category IDs:', validCategoryIds);
    
    // Group all items by their category field value
    allItemsSnapshot.forEach((itemDoc) => {
      const data = itemDoc.data();
      const itemCategory = String(data.category || '').trim();
      const itemName = data.name || 'Unknown';
      
      if (!itemsByCategory[itemCategory]) {
        itemsByCategory[itemCategory] = [];
      }
      
      itemsByCategory[itemCategory].push({
        id: itemDoc.id,
        name: itemName,
        category: itemCategory || '(missing)'
      });
    });
    
    console.log('[Audit] Items grouped by category field:', itemsByCategory);
    
    // Check each category and see what items it has
    for (const cat of CATEGORIES) {
      const catId = String(cat.id);
      const itemsInThisCategory = itemsByCategory[catId] || [];
      console.log(`[Audit] Category "${cat.label}" (${catId}) has ${itemsInThisCategory.length} items:`, itemsInThisCategory.map(i => i.name));
    }
    
    // Check for items with invalid/missing categories
    const invalidItems = [];
    Object.keys(itemsByCategory).forEach(catId => {
      if (!validCategoryIds.includes(catId) && catId !== '(missing)') {
        invalidItems.push(...itemsByCategory[catId].map(item => ({ ...item, invalidCategory: catId })));
      }
    });
    
    if (itemsByCategory['(missing)']) {
      invalidItems.push(...itemsByCategory['(missing)'].map(item => ({ ...item, invalidCategory: 'missing' })));
    }
    
    if (invalidItems.length > 0) {
      console.warn('[Audit] ⚠️ Found', invalidItems.length, 'items with invalid/missing categories:', invalidItems);
      
      // Fix invalid items - assign to first category
      const defaultCatId = CATEGORIES[0].id;
      const { updateDoc, serverTimestamp } = firebaseFns;
      
      for (const item of invalidItems) {
        try {
          await updateDoc(doc(householdRefRef, 'items', item.id), {
            category: defaultCatId,
            updatedAt: serverTimestamp()
          });
          console.log('[Audit] ✅ Fixed item:', item.name, '- assigned to category:', defaultCatId);
        } catch (err) {
          console.error('[Audit] ❌ Error fixing item:', item.name, err);
        }
      }
      
      // Reload current category
      if (selectedCategory) {
        setTimeout(() => selectCategory(selectedCategory), 1000);
      }
    } else {
      console.log('[Audit] ✅ All items have valid category assignments');
    }
    
    console.log('[Audit] ========== AUDIT COMPLETE ==========');
  } catch (error) {
    console.error('[Audit] Error during audit:', error);
  }
}

// Removed - normalization is now inline in onCategoriesSnapshot

// REBUILT: Simple real-time category updates
function onCategoriesSnapshot() {
  const { collection, orderBy, query, onSnapshot } = firebaseFns;
  const catsCol = collection(householdRefRef, 'categories');

  onSnapshot(query(catsCol, orderBy('order', 'asc')), qs => {
    // Simple category normalization
    CATEGORIES = qs.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        label: data.label || '',
        img: data.img || '/cat.png',
        pinned: !!data.pinned,
        order: data.order ?? 0
      };
    }).sort((a, b) => {
      if (b.pinned && !a.pinned) return 1;
      if (a.pinned && !b.pinned) return -1;
      return (a.order ?? 0) - (b.order ?? 0);
    });
    
    renderCategories();
    attachCategoryTodoCounters();
    showShoppingBar();
    
    // Select category if none selected
    if (!selectedCategory && CATEGORIES.length > 0) {
      const saved = localStorage.getItem('gsh-shopping-category');
      const cat = CATEGORIES.find(c => c.id === saved) || CATEGORIES[0];
      selectCategory(cat.id);
    } else if (selectedCategory) {
      // Reload items for current category
      selectCategory(selectedCategory);
    }
  }, err => {
    console.error('Error loading categories:', err);
  });
}

// Removed - category restoration is now inline in onCategoriesSnapshot

function showShoppingBar() {
  if (getCurrentViewFn() === 'shopping') {
    const shoppingNavEl = document.getElementById('shoppingCategoriesNav');
    if (shoppingNavEl) {
      shoppingNavEl.style.setProperty('display', 'block', 'important');
      shoppingNavEl.style.setProperty('visibility', 'visible', 'important');
    }
  }
}

function renderCategories() {
  if (!shoppingCategoriesList) return;
  
    const shoppingNavEl = document.getElementById('shoppingCategoriesNav');
  if (getCurrentViewFn() !== 'shopping') {
    if (shoppingNavEl) {
      shoppingNavEl.style.setProperty('display', 'none', 'important');
      shoppingNavEl.style.setProperty('visibility', 'hidden', 'important');
    }
    shoppingCategoriesList.innerHTML = '';
    return;
  }
  
  // Show shopping categories nav when on shopping view
  if (shoppingNavEl) {
    shoppingNavEl.style.setProperty('display', 'block', 'important');
    shoppingNavEl.style.setProperty('visibility', 'visible', 'important');
  }

  shoppingCategoriesList.innerHTML = '';
  for (const c of CATEGORIES) {
    const holder = document.createElement('button');
    holder.className = 'cat flex flex-col items-center w-16 relative';
    holder.dataset.id = c.id;
    holder.innerHTML = `
      ${c.pinned ? '<span class="absolute top-0 left-1 text-amber-500 text-xs">★</span>' : ''}
      <span class="badge hidden"></span>
      <img class="w-14 h-14 rounded-full border object-cover ${c.id === selectedCategory ? 'selected' : ''}" src="${c.img || '/cat.png'}" alt="">
      <span class="text-[11px] mt-1 text-center truncate">${c.label || ''}</span>
    `;
    applyCategoryBadge(holder, c.id);
    holder.addEventListener('click', () => selectCategory(c.id));
    holder.addEventListener('dblclick', () => openCatEditor('edit', c.id));
    holder.addEventListener('contextmenu', e => {
      e.preventDefault();
      openQuickAdd(c.id);
    });

    // Support long-press (mouse or touch) to open quick add
    let longPressTimer = null;
    const LONG_PRESS_MS = 550;
    const startLongPress = () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        openQuickAdd(c.id);
        navigator.vibrate?.(15);
      }, LONG_PRESS_MS);
    };
    const cancelLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    holder.addEventListener('pointerdown', startLongPress);
    holder.addEventListener('pointerup', cancelLongPress);
    holder.addEventListener('pointerleave', cancelLongPress);
    holder.addEventListener('touchstart', startLongPress, { passive: true });
    holder.addEventListener('touchend', cancelLongPress);
    holder.addEventListener('touchcancel', cancelLongPress);

    const catImg = holder.querySelector('img');
    if (catImg && c.img && !c.img.startsWith('/')) {
      loadImageWithCache(catImg, c.img);
    }
    shoppingCategoriesList.appendChild(holder);
  }

  const addBtn = document.createElement('button');
  addBtn.className = 'cat flex flex-col items-center w-16';
  addBtn.innerHTML = `<img class="w-14 h-14 rounded-full border object-cover" src="/add.png" alt=""><span class="text-[11px] mt-1">הוסף</span>`;
  addBtn.addEventListener('click', () => openCatEditor('create'));
  shoppingCategoriesList.appendChild(addBtn);

  const cur = CATEGORIES.find(c => c.id === selectedCategory);
  if (catTitle) catTitle.textContent = cur ? cur.label : 'קטגוריות';
  // Don't call drawItems() here - it will be called by loadItemsForCategory when items are loaded
  // Only draw if we're not currently loading items (to avoid showing empty state during load)
  if (!_loadingCategory && selectedCategory) {
  drawItems();
  }
  populateImportCategoryOptions();
  populateTemplateCategoryOptions();
  refreshAllCategoryBadges();
}

function attachCategoryTodoCounters() {
  const { collection, where, query, onSnapshot } = firebaseFns;
  const itemsCol = collection(householdRefRef, 'items');

  _todoUnsubs.forEach(fn => {
    try { fn(); } catch (_) {}
  });
  _todoUnsubs = [];

  for (const c of CATEGORIES) {
    // Ensure category ID is a string for consistent comparison
    const catId = String(c.id);
    const qref = query(itemsCol, where('category', '==', catId), where('status', '==', 'todo'));
    const unsub = onSnapshot(qref, qs => {
      // Double-check items actually belong to this category (client-side validation)
      let validCount = 0;
      let urgentCount = 0;
      qs.forEach(docSnap => {
        const data = docSnap.data();
        // Ensure exact match - handle potential type mismatches
        const itemCategory = String(data.category || '').trim();
        if (itemCategory === catId) {
          validCount++;
        if (data?.urgent) urgentCount++;
        } else {
          console.warn('[BadgeCounter] Item with wrong category in query:', {
            itemId: docSnap.id,
            itemName: data.name,
            expected: catId,
            got: itemCategory
          });
        }
      });
      // Use normalized string as key for consistency
      CATEGORY_TODO_COUNTS[catId] = validCount;
      CATEGORY_URGENT_COUNTS[catId] = urgentCount;
      // Also store with original ID for backward compatibility
      if (c.id !== catId) {
        CATEGORY_TODO_COUNTS[c.id] = validCount;
      CATEGORY_URGENT_COUNTS[c.id] = urgentCount;
      }
      refreshAllCategoryBadges();
      updateSummaryFromCounters();
    });
    _todoUnsubs.push(unsub);
  }
}

// REBUILT: Simple, clean category selection
function selectCategory(catId) {
  // Prevent duplicate calls
  if (selectedCategory === catId && _loadingCategory === String(catId)) {
    console.log('[SelectCategory] Already selected and loading category:', catId, '- skipping');
    return;
  }
  
  // 1. Stop old listener
  if (_itemsUnsub) {
    _itemsUnsub();
    _itemsUnsub = null;
  }
  
  // 2. Clear state and update selected category FIRST
  CURRENT_ITEMS = [];
  _listeningForCategory = null;
  _loadingCategory = null; // Clear loading flag
  selectedCategory = catId; // Update selected category BEFORE loading
  
  // 3. Clear view
  if (mainView) {
    mainView.innerHTML = '<div class="p-4" style="color:var(--muted);">טוען פריטים...</div>';
  }
  
  // 4. Save selection
  try {
    localStorage.setItem('gsh-shopping-category', catId || '');
  } catch (_) {}
  
  // 5. Update UI (quick update first)
  const cat = CATEGORIES.find(c => c.id === catId);
  if (catTitle) catTitle.textContent = cat ? cat.label : 'קטגוריות';
  
  // 6. Load items for new category IMMEDIATELY (before renderCategories to avoid delay)
  if (catId) {
    loadItemsForCategory(catId);
  } else {
    drawItems();
  }
  
  // 7. Update category UI (after starting item load)
  renderCategories();
}

function applyCategoryBadge(holder, catId) {
  if (!holder) return;
  const badge = holder.querySelector('.badge');
  if (!badge) return;
  // Normalize category ID to string for consistent lookup
  const normalizedCatId = String(catId);
  const count = CATEGORY_TODO_COUNTS[normalizedCatId] || CATEGORY_TODO_COUNTS[catId] || 0;
  if (count > 0) {
    badge.textContent = String(count);
    badge.classList.remove('hidden');
    // Use setProperty with !important to override any inline styles
    badge.style.setProperty('display', 'flex', 'important');
    badge.style.setProperty('visibility', 'visible', 'important');
  } else {
    badge.textContent = '';
    badge.classList.add('hidden');
    badge.style.setProperty('display', 'none', 'important');
    badge.style.setProperty('visibility', 'hidden', 'important');
  }
}

function refreshAllCategoryBadges() {
  shoppingCategoriesList?.querySelectorAll('.cat[data-id]').forEach(holder => {
    const id = holder.dataset.id;
    applyCategoryBadge(holder, id);
  });
}

function populateImportCategoryOptions() {
  if (!importCategorySelect) return;
  importCategorySelect.innerHTML = '';
  if (!CATEGORIES.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'אין קטגוריות זמינות';
    importCategorySelect.appendChild(opt);
    importCategorySelect.disabled = true;
    return;
  }
  importCategorySelect.disabled = false;
  for (const c of CATEGORIES) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label || '—';
    importCategorySelect.appendChild(opt);
  }
  const defaultId = selectedCategory || CATEGORIES[0]?.id || '';
  if (defaultId) importCategorySelect.value = defaultId;
}

function populateTemplateCategoryOptions() {
  if (!templateCategorySelect) return;
  templateCategorySelect.innerHTML = '';
  if (!CATEGORIES.length) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'אין קטגוריות זמינות';
    templateCategorySelect.appendChild(opt);
    templateCategorySelect.disabled = true;
    return;
  }
  templateCategorySelect.disabled = false;
  for (const c of CATEGORIES) {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label || '—';
    templateCategorySelect.appendChild(opt);
  }
  const defaultId = selectedCategory || CATEGORIES[0]?.id || '';
  if (defaultId) templateCategorySelect.value = defaultId;
}

function openCatEditor(mode = 'create', catId = null) {
  if (!catModal) return;
  catIdEl.value = catId || '';
  catName.value = '';
  catPreview.src = '/cat.png';
  catPinned.checked = false;
  if (catFile) catFile.value = '';
  catFileName.textContent = 'לא נבחרה תמונה';
  catDelete.classList.toggle('hidden', mode !== 'edit');
  catModalTitle.textContent = mode === 'edit' ? 'עריכת קטגוריה' : 'קטגוריה חדשה';
  if (mode === 'edit' && catId) {
    const c = CATEGORIES.find(x => x.id === catId);
    if (c) {
      catName.value = c.label || '';
      catPreview.src = c.img || '/cat.png';
      catPinned.checked = !!c.pinned;
    }
  }
  catModal.classList.add('show');
}

function handleSaveCategory() {
  const { collection, doc, setDoc, addDoc, updateDoc, serverTimestamp } = firebaseFns;
  const catsCol = collection(householdRefRef, 'categories');
  const name = (catName.value || '').trim();
  if (!name) {
    toast('צריך שם קטגוריה');
    return;
  }
  const pinned = !!catPinned?.checked;
  const id = catIdEl.value || null;
  showLoading('שומר קטגוריה...');
  (async () => {
    try {
      if (id) {
        await setDoc(doc(householdRefRef, 'categories', id), { label: name, pinned, updatedAt: serverTimestamp() }, { merge: true });
        if (catFile.files?.[0]) {
          showLoading('מעלה תמונה...');
          const path = `households/${householdId}/categories/${id}-${Date.now()}.jpg`;
          const ref = await uploadFileAndGetURL(srefFn(storageRef, path), catFile.files[0]);
          const url = await firebaseFns.getDownloadURL(ref);
          await updateDoc(doc(householdRefRef, 'categories', id), { img: url, updatedAt: serverTimestamp() });
        }
      } else {
        const ref = await addDoc(catsCol, { label: name, pinned, img: '/cat.png', order: Date.now(), createdAt: serverTimestamp() });
        const newId = ref.id;
        if (catFile.files?.[0]) {
          showLoading('מעלה תמונה...');
          const path = `households/${householdId}/categories/${newId}-${Date.now()}.jpg`;
          const storageRefChild = await uploadFileAndGetURL(srefFn(storageRef, path), catFile.files[0]);
          const url = await firebaseFns.getDownloadURL(storageRefChild);
          await updateDoc(doc(householdRefRef, 'categories', newId), { img: url, updatedAt: serverTimestamp() });
        }
        selectCategory(newId);
      }
      catModal.classList.remove('show');
      toast('קטגוריה נשמרה בהצלחה');
    } catch (e) {
      console.error(e);
      toast('שגיאה בשמירת קטגוריה', 3000);
    } finally {
      hideLoading();
    }
  })();
}

function handleDeleteCategory() {
  const { collection, doc, deleteDoc, query, where, getDocs } = firebaseFns;
  const itemsCol = collection(householdRefRef, 'items');
  const id = catIdEl.value;
  if (!id) return;
  if (!confirm('למחוק את הקטגוריה וכל הפריטים בה?')) return;
  showLoading('מוחק קטגוריה...');
  (async () => {
    try {
      const qs = await getDocs(query(itemsCol, where('category', '==', id)));
      for (const d of qs.docs) {
        await deleteDoc(doc(householdRefRef, 'items', d.id));
      }
      await deleteDoc(doc(householdRefRef, 'categories', id));
      selectedCategory = null;
      catModal.classList.remove('show');
      toast('קטגוריה נמחקה');
    } catch (e) {
      console.error(e);
      toast('שגיאה במחיקה', 3000);
    } finally {
      hideLoading();
    }
  })();
}

function openQuickAdd(catId) {
  if (!qaModal) return;
  
  // Populate category dropdown
  if (qaCategory) {
    qaCategory.innerHTML = '';
    if (CATEGORIES.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— אין קטגוריות —';
      qaCategory.appendChild(opt);
    } else {
      for (const c of CATEGORIES) {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label || '—';
        if ((catId || selectedCategory) === c.id) opt.selected = true;
        qaCategory.appendChild(opt);
      }
    }
  }
  
  qaName.value = '';
  qaDesc.value = '';
  qaQty.value = '';
  qaPrice.value = '';
  qaNote.value = '';
  qaFile.value = '';
  qaFileName.textContent = 'לא נבחרה תמונה';
  qaModal.classList.add('show');
}

function handleQuickAddSave() {
  const { collection, addDoc, doc, updateDoc, serverTimestamp } = firebaseFns;
  const itemsCol = collection(householdRefRef, 'items');
  const nameVal = validateName(qaName.value);
  if (!nameVal.valid) {
    toast(nameVal.error);
    return;
  }
  const categoryId = qaCategory?.value || selectedCategory;
  if (!categoryId) {
    toast('לא נבחרה קטגוריה');
    return;
  }
  const qtyVal = validateQuantity(qaQty.value || 1);
  if (!qtyVal.valid) {
    toast(qtyVal.error);
    return;
  }
  const priceVal = validatePrice(qaPrice.value || 0);
  if (!priceVal.valid) {
    toast(priceVal.error);
    return;
  }
  const desc = (qaDesc.value || '').trim();
  const note = (qaNote.value || '').trim();
  let imgUrl = '/buy.png';
  showLoading('מוסיף פריט...');
  (async () => {
    try {
      // CRITICAL: Category field is REQUIRED - must be present and valid
      const ref = await addDoc(itemsCol, {
        name: nameVal.value,
        desc,
        note,
        qty: qtyVal.value,
        price: priceVal.value,
        img: imgUrl,
        status: 'todo',
        category: categoryId, // REQUIRED FIELD - must always be set
        createdAt: serverTimestamp()
      });
      if (qaFile.files?.[0]) {
        showLoading('מעלה תמונה...');
        const path = `households/${householdId}/items/${ref.id}-${Date.now()}.jpg`;
        const uploadRef = await uploadFileAndGetURL(srefFn(storageRef, path), qaFile.files[0]);
        imgUrl = await firebaseFns.getDownloadURL(uploadRef);
        // CRITICAL: Preserve category field when updating image
        const existingItem = CURRENT_ITEMS.find(i => i.id === ref.id);
        await updateDoc(doc(householdRefRef, 'items', ref.id), { 
          img: imgUrl, 
          category: existingItem?.category || categoryId, // Preserve category
          updatedAt: serverTimestamp() 
        });
      }
      qaModal.classList.remove('show');
      toast('פריט נוסף בהצלחה');
    } catch (e) {
      console.error(e);
      toast(e.message?.includes('network') ? 'בעיית רשת - נסה שוב' : 'שגיאה בשמירת פריט', 3000);
    } finally {
      hideLoading();
    }
  })();
}

// Helper function to process items from a snapshot
function processItemsSnapshot(snapshot, exactCategoryId, catId) {
  const items = [];
  const wrongCategoryItems = [];
  
  snapshot.forEach(doc => {
    const data = doc.data();
    // Normalize category for comparison - handle type mismatches
    const itemCategory = String(data.category || '').trim();
    const itemName = data.name || 'Unknown';
    
    // ABSOLUTE CHECK: Category must match EXACTLY (string comparison after normalization)
    if (itemCategory === exactCategoryId) {
      items.push({
        id: doc.id,
        ...data,
        category: exactCategoryId // Force exact category
      });
    } else {
      wrongCategoryItems.push({
        id: doc.id,
        name: itemName,
        expected: exactCategoryId,
        got: itemCategory
      });
      console.error('[LoadItems] ⚠️ WRONG CATEGORY ITEM:', itemName, 'Expected:', exactCategoryId, 'Got:', itemCategory);
    }
  });
  
  if (wrongCategoryItems.length > 0) {
    console.error('[LoadItems] Found', wrongCategoryItems.length, 'items with WRONG category in query results!');
  }
  
  return items;
}

// REBUILT: ABSOLUTE item loading - ONLY items with exact category match
// Now uses getDocs for immediate loading, then onSnapshot for real-time updates
function loadItemsForCategory(catId) {
  if (!catId) {
    CURRENT_ITEMS = [];
    drawItems();
    return;
  }
  
  const exactCategoryId = String(catId);
  
  // Prevent duplicate calls for the same category
  if (_loadingCategory === exactCategoryId) {
    console.log('[LoadItems] Already loading category:', exactCategoryId, '- skipping duplicate call');
    return;
  }
  
  // Stop any existing listener FIRST
  if (_itemsUnsub) {
    _itemsUnsub();
    _itemsUnsub = null;
  }
  
  // CRITICAL: Clear items and set listening category BEFORE creating new listener
  CURRENT_ITEMS = [];
  _listeningForCategory = catId;
  _loadingCategory = exactCategoryId; // Mark as loading
  
  // Clear view
  if (mainView) {
    mainView.innerHTML = '<div class="p-4" style="color:var(--muted);">טוען פריטים...</div>';
  }
  
  const { collection, query, where, onSnapshot, getDocs } = firebaseFns;
  const itemsCol = collection(householdRefRef, 'items');
  
  // Debug: Log what we're querying for
  console.log('[LoadItems] Querying for category:', exactCategoryId, 'Type:', typeof exactCategoryId);
  console.log('[LoadItems] Selected category:', selectedCategory);
  console.log('[LoadItems] Available categories:', CATEGORIES.map(c => ({ id: c.id, label: c.label })));
  
  const itemsQuery = query(itemsCol, where('category', '==', exactCategoryId));
  
  // STEP 1: Immediately fetch items using getDocs (uses cache if available)
  getDocs(itemsQuery).then((snapshot) => {
    // Check if this is still the category we want - use the catId parameter, not selectedCategory
    if (_loadingCategory !== exactCategoryId) {
      console.log('[LoadItems] getDocs result ignored - category changed. Loading:', _loadingCategory, 'Expected:', exactCategoryId);
      return;
    }
    
    console.log('[LoadItems] getDocs returned', snapshot.size, 'documents for category:', catId);
    
    const items = processItemsSnapshot(snapshot, exactCategoryId, catId);
    
    console.log('[LoadItems] Loaded', items.length, 'correct items for category:', catId);
    
    // Update items immediately if still the correct category
    if (_loadingCategory === exactCategoryId) {
      CURRENT_ITEMS = items; // Replace, don't merge
      console.log('[LoadItems] Updated CURRENT_ITEMS with', items.length, 'items (immediate)');
      drawItems();
      } else {
      console.log('[LoadItems] Category changed - not updating items');
    }
  }).catch((error) => {
    console.error('[LoadItems] Error in getDocs:', error);
    _loadingCategory = null; // Clear loading flag on error
  });
  
  // STEP 2: Set up real-time listener for updates
  console.log('[LoadItems] Setting up listener for category:', catId);
  
  _itemsUnsub = onSnapshot(itemsQuery, (snapshot) => {
    // Check if this is still the category we want - use the catId parameter
    if (_loadingCategory !== exactCategoryId) {
      console.log('[LoadItems] Snapshot ignored - category changed. Loading:', _loadingCategory, 'Expected:', exactCategoryId);
      return;
    }
    
    console.log('[LoadItems] Received snapshot with', snapshot.size, 'documents for category:', catId);
    
    const items = processItemsSnapshot(snapshot, exactCategoryId, catId);
    
    console.log('[LoadItems] Loaded', items.length, 'correct items for category:', catId);
    
    // Update items if still the correct category
    if (_loadingCategory === exactCategoryId) {
      CURRENT_ITEMS = items; // Replace, don't merge
      console.log('[LoadItems] Updated CURRENT_ITEMS with', items.length, 'items (real-time)');
      drawItems();
    } else {
      console.log('[LoadItems] Category changed - not updating items');
    }
  }, (error) => {
    console.error('[LoadItems] Error in onSnapshot:', error);
    _loadingCategory = null; // Clear loading flag on error
  });
}

let searchTimeout = null;
const debouncedDrawItems = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(drawItems, 300);
};

function drawItems() {
  if (!mainView) return;

  // MEMORY LEAK PREVENTION: Clear old content (which will remove old event listeners)
  // Since we're replacing innerHTML below, old listeners will be garbage collected

  // No category selected - show empty state
  if (!selectedCategory) {
    if (openCountEl) openCountEl.textContent = '—';
    mainView.innerHTML = '<div class="p-4" style="color:var(--muted);">בחר קטגוריה.</div>';
    return;
  }
  
  // CRITICAL: Get items - CURRENT_ITEMS should already be filtered by category in loadItemsForCategory
  // Use _loadingCategory if available (more reliable than selectedCategory during transitions)
  let items = Array.isArray(CURRENT_ITEMS) ? CURRENT_ITEMS : [];
  const expectedCat = _loadingCategory || String(selectedCategory);
  
  // Additional safety filter: Only items with EXACT category match (defensive check)
  // This should rarely be needed since loadItemsForCategory already filters, but it's a safety net
  const filteredItems = [];
  const wrongItems = [];
  
  items.forEach(item => {
    if (!item || !item.id) {
      console.warn('[Draw] Skipping invalid item - missing id');
      return;
    }
    
    if (!item.category) {
      console.warn('[Draw] Skipping item - missing category:', item.id, item.name);
      return;
    }
    
    // ABSOLUTE EXACT MATCH: Normalize both sides for comparison
    const itemCategory = String(item.category).trim();
    if (itemCategory === expectedCat) {
      filteredItems.push(item);
    } else {
      wrongItems.push({
        id: item.id,
        name: item.name,
        expected: expectedCat,
        got: itemCategory
      });
      console.error('[Draw] ⚠️ REMOVING item with WRONG category!', 
        'Item:', item.name,
        'Item ID:', item.id, 
        'Expected category:', expectedCat, 
        'Item category:', itemCategory);
    }
  });
  
  if (wrongItems.length > 0) {
    console.error('[Draw] ⚠️⚠️⚠️ REMOVED', wrongItems.length, 'items with WRONG categories!');
  }
  
  items = filteredItems;
  
  console.log('[Draw] Rendering', items.length, 'items for category:', expectedCat);
  
  // Apply search filter if there's a search term
  const searchTerm = (searchEl?.value || '').trim().toLowerCase();
  if (searchTerm) {
    items = items.filter(item => {
      const name = (item.name || '').toLowerCase();
      return name.includes(searchTerm);
    });
  }

  clearSearchBtn?.classList.toggle('hidden', !searchTerm);

  // No items to show - display empty state
  if (items.length === 0) {
    if (openCountEl) openCountEl.textContent = searchTerm ? 'לא נמצאו תוצאות' : 'אין פריטים';
    const emptyMsg = searchTerm 
      ? 'לא נמצאו תוצאות עבור החיפוש.'
      : 'אין פריטים בקטגוריה הזו.';
    mainView.innerHTML = `<div class="p-4" style="color:var(--muted);">${emptyMsg}</div>`;
    return;
  }

  // Create container for items
  mainView.innerHTML = '';
  const itemsContainer = document.createElement('div');
  itemsContainer.style.display = 'flex';
  itemsContainer.style.flexDirection = 'column';
  itemsContainer.style.gap = '12px';
  itemsContainer.style.width = '100%';
  itemsContainer.className = 'flex flex-col gap-3';
  mainView.appendChild(itemsContainer);

  // Sort items: undone first, then by creation date (newest first)
  items.sort((a, b) => {
    const sa = a.status === 'done' ? 1 : 0;
    const sb = b.status === 'done' ? 1 : 0;
    if (sa !== sb) return sa - sb;
    const ta = a.createdAt?.toMillis?.() || 0;
    const tb = b.createdAt?.toMillis?.() || 0;
    return tb - ta;
  });

  // Count open (not done) items
  const openCount = items.filter(i => i.status !== 'done').length;
  if (openCountEl) openCountEl.textContent = `${openCount} פריטים`;

  // Render each item
  items.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'row cursor-pointer ' + (item.status === 'done' ? 'purchased' : '');
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '12px';
    // Spacing is handled by parent gap
    if (item.urgent && item.status !== 'done') {
      card.classList.add('urgent');
      card.style.borderLeft = '4px solid #dc2626';
    }
    card.dataset.id = item.id;

    const itemImg = item.img || '/buy.png';
    const itemName = item.name || '';
    const itemDesc = item.desc || '';
    const itemNote = item.note || '';
    const itemQty = Number(item.qty || 0);
    const itemPrice = fmtMoney(Number(item.price || 0));
    const isDone = item.status === 'done';
    const isUrgent = item.urgent && !isDone;

    // Left side: Content - SAFE DOM CREATION (prevents XSS)
    const contentDiv = document.createElement('div');
    contentDiv.className = 'flex-1 min-w-0';
    
    // Item image (if exists)
    if (itemImg) {
      const img = createElement('img', {
        className: 'w-12 h-12 rounded-full border object-cover mb-2',
        style: { borderColor: 'var(--border)' },
        alt: itemName || ''
      });
      img.src = itemImg;
      img.addEventListener('contextmenu', (e) => e.preventDefault());
      contentDiv.appendChild(img);
    }
    
    // Item name (safe text content)
    if (itemName) {
      const nameDiv = createElement('div', {
        className: `font-semibold mb-1 text-sm ${isDone ? 'line-through opacity-60' : ''} ${isUrgent ? 'text-[#dc2626] font-bold' : ''}`
      }, itemName);
      contentDiv.appendChild(nameDiv);
    }
    
    // Item description (safe text content)
    if (itemDesc) {
      const descDiv = createElement('div', {
        className: 'text-xs mb-1',
        style: {
          color: 'var(--muted)',
          opacity: isDone ? '0.6' : '1'
        }
      }, itemDesc);
      contentDiv.appendChild(descDiv);
    }
    
    // Item note (safe text content)
    if (itemNote) {
      const noteDiv = createElement('div', {
        className: 'text-[11px] text-amber-600 mb-1'
      }, itemNote);
      contentDiv.appendChild(noteDiv);
    }
    
    // Quantity and price controls
    const controlsDiv = createElement('div', {
      className: 'flex items-center gap-2 mt-1'
    });
    
    const qtyMinusBtn = createElement('button', {
      className: 'qty-minus w-7 h-7 border rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
      style: {
        color: 'var(--text)',
        borderColor: 'var(--border)',
        opacity: isDone ? '0.6' : '1'
      }
    }, '−');
    controlsDiv.appendChild(qtyMinusBtn);
    
    const qtyDisplay = createElement('div', {
      className: 'qty-display min-w-[28px] text-center font-semibold text-xs',
      style: { opacity: isDone ? '0.6' : '1' }
    }, String(itemQty));
    controlsDiv.appendChild(qtyDisplay);
    
    const qtyPlusBtn = createElement('button', {
      className: 'qty-plus w-7 h-7 border rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
      style: {
        color: 'var(--text)',
        borderColor: 'var(--border)',
        opacity: isDone ? '0.6' : '1'
      }
    }, '+');
    controlsDiv.appendChild(qtyPlusBtn);
    
    const priceDisplay = createElement('div', {
      className: 'price-display px-2 py-0.5 border rounded text-center text-xs',
      style: {
        borderColor: 'var(--border)',
        opacity: isDone ? '0.6' : '1'
      }
    }, itemPrice);
    controlsDiv.appendChild(priceDisplay);
    
    contentDiv.appendChild(controlsDiv);

    // Right side: Big urgent/regular button, vertically centered
    const buttonDiv = document.createElement('div');
    buttonDiv.className = 'flex items-center justify-center flex-shrink-0';
    const statusButton = document.createElement('button');
    statusButton.className = 'status-btn font-bold rounded-lg transition-all';
    // Buying button: red \"לקנות\" when not done, green \"נקנה\" when done
    if (isDone) {
      statusButton.textContent = 'נקנה';
      statusButton.style.background = '#10b981';
      statusButton.style.color = '#fff';
    } else {
      statusButton.textContent = 'לקנות';
      statusButton.style.background = '#dc2626';
      statusButton.style.color = '#fff';
    }
    statusButton.style.padding = '24px 16px';
    statusButton.style.fontSize = '14px';
    
    statusButton.addEventListener('click', async (e) => {
      e.stopPropagation();
      navigator.vibrate?.(10);
      await setPurchased(item, !isDone);
    });
    
    buttonDiv.appendChild(statusButton);

    card.appendChild(contentDiv);
    card.appendChild(buttonDiv);

    // Wire up event listeners (using direct references from creation above)
    qtyMinusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.vibrate?.(8);
      const current = Number(qtyDisplay.textContent || itemQty || 0);
      const nextQty = Math.max(0, current - 1);
      setTextContent(qtyDisplay, String(nextQty));
      // CRITICAL: Preserve category field when updating quantity
      firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'items', item.id), { 
        qty: nextQty, 
        category: item.category, // Preserve category
        updatedAt: firebaseFns.serverTimestamp() 
      });
    });

    qtyPlusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.vibrate?.(8);
      const current = Number(qtyDisplay.textContent || itemQty || 0);
      const nextQty = current + 1;
      setTextContent(qtyDisplay, String(nextQty));
      // CRITICAL: Preserve category field when updating quantity
      firebaseFns.updateDoc(firebaseFns.doc(householdRefRef, 'items', item.id), { 
        qty: nextQty, 
        category: item.category, // Preserve category
        updatedAt: firebaseFns.serverTimestamp() 
      });
    });

    priceDisplay.addEventListener('dblclick', (e) => {
        e.stopPropagation();
      const currentPrice = item.price ?? 0;
      const input = prompt('עדכון מחיר ליחידה (₪):', currentPrice);
      if (input === null) return;
      const priceVal = validatePrice(input);
      if (!priceVal.valid) {
        toast(priceVal.error);
        return;
      }
      // CRITICAL: Preserve category field when updating price
      firebaseFns
        .updateDoc(firebaseFns.doc(householdRefRef, 'items', item.id), { 
          price: priceVal.value, 
          category: item.category, // Preserve category
          updatedAt: firebaseFns.serverTimestamp() 
        })
        .catch(e => {
          console.error(e);
          toast('שגיאה בעדכון מחיר');
        });
    });

    // Long press to edit
    let longPressTimer = null;
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') return;
    });
    card.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'BUTTON') return;
      longPressTimer = setTimeout(() => {
      openItemEditor(item);
        navigator.vibrate?.(20);
      }, 500);
    });
    card.addEventListener('pointerup', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });
    card.addEventListener('pointerleave', () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    // Load image with cache
    const imgEl = card.querySelector('img');
    if (imgEl && itemImg && !itemImg.startsWith('/')) {
      loadImageWithCache(imgEl, itemImg);
    }

    itemsContainer.appendChild(card);
  });
}

// Swipe functionality removed - replaced with buy/bought button

async function setPurchased(item, done) {
  const { doc, updateDoc, serverTimestamp } = firebaseFns;
  
  // CRITICAL: Always preserve category field when updating status
  const currentCategory = item.category || selectedCategory;
  
  if (!currentCategory) {
    console.error('[setPurchased] Missing category for item:', item.id, item.name);
    toast('שגיאה: קטגוריה חסרה');
    return;
  }
  
  const updateData = {
    status: done ? 'done' : 'todo',
    category: currentCategory, // ALWAYS include category
    updatedAt: serverTimestamp()
  };
  
  await updateDoc(doc(householdRefRef, 'items', item.id), updateData);
  if (done) await logPurchase(item);
  toast(done ? 'סומן כנקנה' : 'הוחזר ללא נקנה');
}

async function logPurchase(item) {
  const { collection, addDoc, doc, serverTimestamp } = firebaseFns;
  const qty = Math.max(0, Number(item.qty || 0));
  const price = Math.max(0, Number(item.price || 0));
  const cost = +(qty * price).toFixed(2);
  const d = new Date();
  const date = iso(d);
  const cat = CATEGORIES.find(c => c.id === item.category);
  await addDoc(collection(householdRefRef, 'purchaseEvents'), {
    ts: serverTimestamp(),
    date,
    itemId: item.id,
    itemNameSnapshot: item.name || '',
    itemImgSnapshot: item.img || '/buy.png',
    categoryId: item.category || '',
    categoryNameSnapshot: cat?.label || '',
    categoryImgSnapshot: cat?.img || '/cat.png',
    qtyAtPurchase: qty,
    unitPrice: price,
    cost
  });
}

function openItemEditor(item) {
  if (!ieModal) return;
  ieId.value = item.id;
  ieName.value = item.name || '';
  ieDesc.value = item.desc || '';
  ieNote.value = item.note || '';
  ieQty.value = Number(item.qty || 0);
  iePrice.value = Number(item.price || 0);
  ieFile.value = '';
  ieFileName.textContent = 'לא נבחרה תמונה';
  iePreview.src = item.img || '/buy.png';

  ieCategory.innerHTML = '';
  if (CATEGORIES.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— אין קטגוריות —';
    ieCategory.appendChild(opt);
  } else {
    for (const c of CATEGORIES) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label || '—';
      if ((item.category || selectedCategory) === c.id) opt.selected = true;
      ieCategory.appendChild(opt);
    }
  }
  ieModal.classList.add('show');
}

function handleItemSave() {
  const { doc, updateDoc, serverTimestamp } = firebaseFns;
  const id = ieId.value;
  if (!id) {
    toast('שגיאה: אין מזהה פריט');
    return;
  }
  const nameVal = validateName(ieName.value);
  if (!nameVal.valid) {
    toast(nameVal.error);
    return;
  }
  const qtyVal = validateQuantity(ieQty.value || 0);
  if (!qtyVal.valid) {
    toast(qtyVal.error);
    return;
  }
  const priceVal = validatePrice(iePrice.value || 0);
  if (!priceVal.valid) {
    toast(priceVal.error);
    return;
  }
  const desc = (ieDesc.value || '').trim();
  const note = (ieNote.value || '').trim();
  const newCatId = ieCategory?.value || selectedCategory || null;
  
  // CRITICAL: Category field is REQUIRED - ensure it's always set
  if (!newCatId) {
    toast('קטגוריה נדרשת - אנא בחר קטגוריה');
    return;
  }
  
  showLoading('מעדכן פריט...');
  (async () => {
    try {
      // CRITICAL: Always include category field - it's required
      await updateDoc(doc(householdRefRef, 'items', id), {
        name: nameVal.value,
        desc,
        note,
        qty: qtyVal.value,
        price: priceVal.value,
        category: newCatId, // REQUIRED - always set category field
        updatedAt: serverTimestamp()
      });
      if (ieFile.files?.[0]) {
        showLoading('דוחס ומעלה תמונה...');
        const path = `households/${householdId}/items/${id}-${Date.now()}.jpg`;
        const uploadRef = await uploadFileAndGetURL(srefFn(storageRef, path), ieFile.files[0]);
        const url = await firebaseFns.getDownloadURL(uploadRef);
        // CRITICAL: Preserve category field when updating image
        const existingItem = CURRENT_ITEMS.find(i => i.id === id);
        await updateDoc(doc(householdRefRef, 'items', id), { 
          img: url, 
          category: existingItem?.category || newCatId, // Preserve category
          updatedAt: serverTimestamp() 
        });
      }
      ieModal.classList.remove('show');
      if (newCatId && newCatId !== selectedCategory) toast('הפריט הועבר לקטגוריה חדשה');
      else toast('פריט עודכן בהצלחה');
    } catch (e) {
      console.error(e);
      toast(e.message?.includes('network') ? 'בעיית רשת - נסה שוב' : 'שגיאה בעדכון', 3000);
    } finally {
      hideLoading();
    }
  })();
}

function handleItemDelete() {
  const { doc, deleteDoc } = firebaseFns;
  const id = ieId.value;
  if (!id) return;
  if (!confirm('למחוק את הפריט?')) return;
  showLoading('מוחק פריט...');
  (async () => {
    try {
      await deleteDoc(doc(householdRefRef, 'items', id));
      ieModal.classList.remove('show');
      toast('פריט נמחק');
    } catch (e) {
      console.error(e);
      toast('שגיאה במחיקה', 3000);
    } finally {
      hideLoading();
    }
  })();
}

function openImportModal() {
  if (!importModal) return;
  importCategorySelect.value = selectedCategory || '';
  importTextArea.value = '';
  importPreview.innerHTML = '';
  importErrorsEl.textContent = '';
  importCountEl.textContent = '0 פריטים';
  parsedImportItems = [];
  importAddBtn.disabled = true;
  importModal.classList.add('show');
}

function closeImportModal() {
  importModal?.classList.remove('show');
}

function updateImportPreview(text) {
  parsedImportItems = [];
  importErrorsEl.textContent = '';
  if (!text) {
    importPreview.innerHTML = '';
    importCountEl.textContent = '0 פריטים';
    importAddBtn.disabled = true;
    return;
  }
  parsedImportItems = parseImportText(text || '');
  if (parsedImportItems.length > 100) {
    importErrorsEl.textContent = 'מגבלה: ניתן להוסיף עד 100 פריטים בכל פעולת ייבוא.';
    parsedImportItems = parsedImportItems.slice(0, 100);
  }
  importCountEl.textContent = `${parsedImportItems.length} פריטים`;
  importAddBtn.disabled = parsedImportItems.length === 0 || (importCategorySelect?.disabled || false);
  if (parsedImportItems.length === 0) {
    importPreview.innerHTML = '<div class="text-sm" style="color:var(--muted);">לא זוהו פריטים</div>';
    return;
  }
  importPreview.innerHTML = parsedImportItems
    .map(item => `
      <div class="border rounded p-2 flex justify-between text-sm mb-1">
        <span>${item.name || ''}</span>
        <span class="text-xs" style="color:var(--muted);">x${item.qty || 1}</span>
      </div>
    `)
    .join('');
}

function parseImportText(text) {
  return text
    .split('\n')
    .map(line => parseImportLine(line))
    .filter(Boolean);
}

function parseImportLine(raw) {
  const line = raw.trim();
  if (!line) return null;
  let qty = 1;
  let name = line;
  let note = '';
  let urgent = false;
  const qtyMatch = line.match(/^(\d+)[xX*](.+)$/);
  if (qtyMatch) {
    qty = Math.min(1000, Math.max(1, Number(qtyMatch[1]) || 1));
    name = qtyMatch[2].trim();
  }
  const urgentMatch = name.match(/!$/);
  if (urgentMatch) {
    urgent = true;
    name = name.replace(/!$/, '').trim();
  }
  const noteMatch = name.match(/\(([^)]+)\)$/);
  if (noteMatch) {
    note = noteMatch[1].trim();
    name = name.replace(/\([^)]+\)$/, '').trim();
  }
  return { name, qty, note, urgent };
}

function importParsedItems() {
  const { collection, addDoc, doc, updateDoc, serverTimestamp } = firebaseFns;
  if (!parsedImportItems.length) {
    toast('אין פריטים לייבוא');
    return;
  }
  const catId = importCategorySelect?.value || selectedCategory;
  if (!catId) {
    toast('ניתן לייבא רק לאחר שמירת קטגוריה');
    return;
  }
  showLoading('מייבא רשימה...');
  const itemsCol = collection(householdRefRef, 'items');
  (async () => {
    try {
      for (const item of parsedImportItems) {
        await addDoc(itemsCol, {
          name: item.name || '',
          desc: '',
          note: item.note || '',
          qty: Number(item.qty || 1),
          price: Number(item.price || 0),
          img: '/buy.png',
          status: 'todo',
          urgent: !!item.urgent,
          category: catId,
          createdAt: serverTimestamp()
        });
      }
      toast(`יובאו ${parsedImportItems.length} פריטים`);
      closeImportModal();
    } catch (e) {
      console.error(e);
      toast('שגיאה בייבוא', 3000);
    } finally {
      hideLoading();
    }
  })();
}

function openTemplatesModal() {
  if (!templatesModal) return;
  templatesModal.classList.add('show');
  loadUserTemplates();
  renderTemplateLists();
}

function closeTemplatesModal() {
  templatesModal?.classList.remove('show');
}

function loadUserTemplates() {
  try {
    userTemplates = JSON.parse(localStorage.getItem('gsh-templates')) || [];
  } catch (_) {
    userTemplates = [];
  }
}

function persistUserTemplates() {
  try {
    localStorage.setItem('gsh-templates', JSON.stringify(userTemplates));
  } catch (_) {}
}

function renderTemplateLists() {
  renderTemplateSection(userTemplatesList, userTemplates, true, 'אין לכם עדיין תבניות שמורות.');
  renderTemplateSection(presetTemplatesList, window.PRESET_TEMPLATES || [], false, 'ניתן להוסיף תבניות מוכנות מראש.');
}

function renderTemplateSection(container, list, deletable = false, emptyText = '') {
  if (!container) return;
  container.innerHTML = '';
  if (!list.length) {
    const empty = document.createElement('div');
    empty.className = 'text-sm text-center py-2';
    empty.style.color = 'var(--muted)';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  list.forEach(tpl => {
    const row = document.createElement('div');
    row.className = 'border rounded-lg p-2 flex items-center justify-between text-sm';
    row.dataset.id = tpl.id;
    row.innerHTML = `
      <div>
        <div class="font-semibold">${tpl.name || ''}</div>
        <div class="text-xs" style="color:var(--muted);">${(tpl.items || []).length} פריטים</div>
      </div>
      <div class="flex items-center gap-2">
        <button class="applyTemplate px-2 py-1 rounded border text-xs">החל</button>
        ${deletable ? '<button class="deleteTemplate px-2 py-1 rounded border text-xs">מחק</button>' : ''}
      </div>
    `;
    container.appendChild(row);
  });
}

function handleTemplateListClick(event) {
  const btn = event.target.closest('button');
  if (!btn) return;
  const holder = event.target.closest('[data-id]');
  if (!holder) return;
  const id = holder.dataset.id;
  if (btn.classList.contains('applyTemplate')) {
    applyTemplate(holder.dataset.kind || (holder.closest('#userTemplatesList') ? 'user' : 'preset'), id);
  } else if (btn.classList.contains('deleteTemplate')) {
    if (!confirm('למחוק תבנית?')) return;
    userTemplates = userTemplates.filter(t => t.id !== id);
    persistUserTemplates();
    renderTemplateLists();
    toast('התבנית נמחקה');
  }
}

function applyTemplate(kind, id) {
  const source = kind === 'user' ? userTemplates : (window.PRESET_TEMPLATES || []);
  const template = source.find(t => t.id === id);
  if (!template) {
    toast('תבנית לא נמצאה');
    return;
  }
  const catId = templateCategorySelect?.value || selectedCategory;
  if (!catId) {
    toast('ניתן להחיל תבנית רק לאחר בחירת קטגוריה');
    return;
  }
  if (!template.items?.length) {
    toast('אין פריטים בתבנית');
    return;
  }
  showLoading('מיישם תבנית...');
  const { collection, addDoc, serverTimestamp } = firebaseFns;
  const itemsCol = collection(householdRefRef, 'items');
  (async () => {
    try {
      for (const item of template.items) {
        await addDoc(itemsCol, {
          name: item.name || '',
          desc: item.desc || '',
          note: item.note || '',
          qty: Math.max(1, Number(item.qty || 1)),
          price: Number(item.price || 0),
          img: '/buy.png',
          status: 'todo',
          urgent: !!item.urgent,
          category: catId,
          createdAt: serverTimestamp()
        });
      }
      toast('התבנית נוספה לרשימה');
      closeTemplatesModal();
    } catch (e) {
      console.error(e);
      toast(e.message?.includes('network') ? 'בעיית רשת - נסה שוב' : 'שגיאה ביישום התבנית', 3000);
    } finally {
      hideLoading();
    }
  })();
}

function saveTemplateFromCurrent() {
  const name = (templateNameInput?.value || '').trim();
  if (!name) {
    toast('צריך שם לתבנית');
    return;
  }
  if (!selectedCategory) {
    toast('בחרו קטגוריה פעילה לשמירה');
    return;
  }
  const sourceItems = CURRENT_ITEMS;
  if (!sourceItems) {
    toast('הנתונים עדיין נטענים, נסו שוב בעוד רגע');
    return;
  }
  const currentItems = sourceItems.filter(i => i.status !== 'done');
  if (!currentItems.length) {
    toast('אין פריטים פעילים לשמירה');
    return;
  }
  const payload = currentItems.map(i => ({
    name: i.name || '',
    desc: i.desc || '',
    note: i.note || '',
    qty: Math.max(1, Number(i.qty || 1)),
    urgent: !!i.urgent
  }));
  userTemplates.push({ id: `tpl-${Date.now()}`, name, items: payload });
  persistUserTemplates();
  templateNameInput.value = '';
  renderTemplateLists();
  toast('התבנית נשמרה');
}

function updateSummaryFromCounters() {
  summaryStatsRef.open = Object.values(CATEGORY_TODO_COUNTS).reduce((sum, val) => sum + (val || 0), 0);
  summaryStatsRef.urgent = Object.values(CATEGORY_URGENT_COUNTS).reduce((sum, val) => sum + (val || 0), 0);
  updateSummaryUIFn();
}

// Export functions so they can be called from outside the module if needed
// Export wrapper for backward compatibility
function attachItemsListener(catId) {
  return loadItemsForCategory(catId);
}

export { drawItems, attachItemsListener, openQuickAdd, selectCategory };

