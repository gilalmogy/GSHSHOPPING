# Buttons Documentation - GSH Shopping App

This document describes all buttons in each screen and their functionality.

## 📱 SHOPPING SCREEN

### Header Buttons
- **`#addShoppingItemBtn`** - "הוסף פריט" (Add Item)
  - **Function**: Opens quick-add modal to add a new shopping item
  - **Status**: ✅ Working (handled in shopping.js)

### Category Navigation Bar (Bottom)
- **Category Buttons** - Each category image
  - **Click**: Selects the category and shows its items
  - **Double-click**: Opens category editor modal
  - **Right-click/Context menu**: Opens quick-add modal for that category
  - **Status**: ✅ Working

- **`+` Button** (Add Category)
  - **Function**: Opens category editor modal to create new category
  - **Status**: ✅ Working

### Item Row Buttons
- **`−` (Minus) Button** - Decrease quantity
  - **Function**: Decreases item quantity by 1 (minimum 0)
  - **Status**: ✅ Working

- **`+` (Plus) Button** - Increase quantity
  - **Function**: Increases item quantity by 1
  - **Status**: ✅ Working

- **Swipe Right** - Mark as purchased
  - **Function**: Sets item status to 'done'
  - **Status**: ✅ Working

- **Swipe Left** - Mark as not purchased
  - **Function**: Sets item status back to 'open'
  - **Status**: ✅ Working

- **Long Press** - Open item editor
  - **Function**: Opens item editor modal
  - **Status**: ✅ Working

### Category Modal Buttons
- **`#catSave`** - "שמור" (Save)
  - **Function**: Saves category (create or update)
  - **Status**: ✅ Working

- **`#catDelete`** - "מחק" (Delete)
  - **Function**: Deletes the category
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

### Quick Add Modal Buttons
- **`#qaSave`** - "שמור" (Save)
  - **Function**: Saves new item via quick-add
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

### Item Editor Modal Buttons
- **`#ieSave`** - "שמור" (Save)
  - **Function**: Saves item changes
  - **Status**: ✅ Working

- **`#ieDelete`** - "מחק" (Delete)
  - **Function**: Deletes the item
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

### Import Modal Buttons
- **`#importAddBtn`** - "הוסף פריטים" (Add Items)
  - **Function**: Imports parsed items from text
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

### Templates Modal Buttons
- **`#templatesBtn`** - Opens templates modal
  - **Function**: Shows templates for quick item creation
  - **Status**: ✅ Working

- **`#templateSaveBtn`** - "שמור תבנית" (Save Template)
  - **Function**: Saves current items as a template
  - **Status**: ✅ Working

- **Template List Items** - Click to use template
  - **Function**: Applies template items to current category
  - **Status**: ✅ Working

---

## ✅ TASKS SCREEN

### Header Buttons
- **`#addTaskBtn`** - "הוסף משימה" (Add Task)
  - **Function**: Opens task editor modal to create new task
  - **Status**: ✅ Working

### Tab Buttons
- **`#tasksTabList`** - "רשימה" (List)
  - **Function**: Switches to list view
  - **Status**: ✅ Working

- **`#tasksTabGantt`** - "ציר זמן" (Timeline)
  - **Function**: Switches to Gantt timeline view
  - **Status**: ✅ Working

### Category Navigation Bar (Bottom)
- **Category Buttons** - Each category image
  - **Click**: Selects the category and shows its tasks
  - **Double-click**: Opens category editor modal
  - **Right-click/Context menu**: Opens task editor for that category
  - **Status**: ✅ Working

- **`+` Button** (Add Category)
  - **Function**: Opens category editor modal to create new category
  - **Status**: ✅ Working

### Task List View
- **Task Row Click** - Opens task editor
  - **Function**: Opens task editor modal for that task
  - **Status**: ✅ Working

### Gantt Timeline View Buttons
- **`#ganttToday`** - "היום" (Today)
  - **Function**: Jumps timeline to show today (7 days before, 30 days after)
  - **Status**: ✅ Working

- **`#ganttJumpTo`** - "קפוץ לתאריך" (Jump to Date)
  - **Function**: Prompts for date and jumps timeline to that date
  - **Status**: ✅ Working

- **`#ganttPrev`** - "←" (Previous Week)
  - **Function**: Moves timeline 7 days backward
  - **Status**: ✅ Working

- **`#ganttNext`** - "→" (Next Week)
  - **Function**: Moves timeline 7 days forward
  - **Status**: ✅ Working

- **`#ganttPrevTask`** - "◄ משימה" (Previous Task)
  - **Function**: Jumps to previous task in timeline
  - **Status**: ✅ Working

- **`#ganttNextTask`** - "משימה ►" (Next Task)
  - **Function**: Jumps to next task in timeline
  - **Status**: ✅ Working

- **`#ganttZoomIn`** - "+" (Zoom In)
  - **Function**: Zooms in timeline (shows fewer days)
  - **Status**: ✅ Fixed - Now working

- **`#ganttZoomOut`** - "−" (Zoom Out)
  - **Function**: Zooms out timeline (shows more days)
  - **Status**: ✅ Fixed - Now working

- **Task Bar Click** - Opens task editor
  - **Function**: Opens task editor for clicked task
  - **Status**: ✅ Working

### Task Category Modal Buttons
- **`#taskCatSave`** - "שמור" (Save)
  - **Function**: Saves task category (create or update)
  - **Status**: ✅ Working

- **`#taskCatDelete`** - "מחק" (Delete)
  - **Function**: Deletes the task category
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

### Task Editor Modal Buttons
- **`#teSave`** - "שמור" (Save)
  - **Function**: Saves task (create or update)
  - **Status**: ✅ Working

- **`#teDelete`** - "מחק" (Delete)
  - **Function**: Deletes the task
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

---

## 📝 NOTES SCREEN

### Header Buttons
- **`#notesViewToggle`** - "תצוגת רשימה" / "תצוגת רשת" (List View / Grid View)
  - **Function**: Toggles between list and grid view
  - **Status**: ✅ Working

- **`#notesFilterBtn`** - "מסננים" (Filters)
  - **Function**: Toggles filter panel visibility
  - **Status**: ✅ Working

### Category Navigation Bar (Bottom)
- **Category Buttons** - Each category image
  - **Click**: Selects the category and shows its notes
  - **Double-click**: Opens category editor modal
  - **Right-click/Context menu**: Opens note editor for that category
  - **Status**: ✅ Working

- **`+` Button** (Add Category)
  - **Function**: Opens category editor modal to create new category
  - **Status**: ✅ Working

### Note Cards
- **Note Card Click** - Opens note editor
  - **Function**: Opens note editor modal for that note
  - **Status**: ✅ Working

### Note Category Modal Buttons
- **`#noteCatSave`** - "שמור" (Save)
  - **Function**: Saves note category (create or update)
  - **Status**: ✅ Working

- **`#noteCatDelete`** - "מחק" (Delete)
  - **Function**: Deletes the note category
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

### Note Editor Modal Buttons
- **`#noteSave`** - "שמור" (Save)
  - **Function**: Saves note (create or update)
  - **Status**: ✅ Working

- **`#noteDelete`** - "מחק" (Delete)
  - **Function**: Moves note to trash
  - **Status**: ✅ Working

- **`#noteDeleteForever`** - "מחק לצמיתות" (Delete Forever)
  - **Function**: Permanently deletes note
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

---

## 🔔 REMINDERS SCREEN

### Header Buttons
- **`#createReminderBtn`** - "צור תזכורת" (Create Reminder)
  - **Function**: Opens reminder editor modal
  - **Status**: ✅ Working

### Filter Buttons
- **`#remindersFilterAll`** - "הכל" (All)
  - **Function**: Shows all reminders
  - **Status**: ✅ Working

- **`#remindersFilterActive`** - "פעיל" (Active)
  - **Function**: Shows only active reminders
  - **Status**: ✅ Working

- **`#remindersFilterDone`** - "הושלם" (Done)
  - **Function**: Shows only completed reminders
  - **Status**: ✅ Working

### Category Navigation Bar (Bottom)
- **Category Buttons** - Each category image
  - **Click**: Selects the category and shows its reminders
  - **Double-click**: Opens category editor modal
  - **Right-click/Context menu**: Opens reminder editor for that category
  - **Status**: ✅ Working

- **`+` Button** (Add Category)
  - **Function**: Opens category editor modal to create new category
  - **Status**: ✅ Working

### Reminder Cards
- **"הושלם" (Done) Button** - On each reminder card
  - **Function**: Marks reminder as done
  - **Status**: ✅ Working

- **"ערוך" (Edit) Button** - On each reminder card
  - **Function**: Opens reminder editor modal
  - **Status**: ✅ Working

- **"מחק" (Delete) Button** - On each reminder card
  - **Function**: Deletes the reminder
  - **Status**: ✅ Working

### Reminder Editor Modal Buttons
- **`#reminderGetLocation`** - "קבל מיקום נוכחי" (Get Current Location)
  - **Function**: Gets current GPS location
  - **Status**: ✅ Working

- **`#reminderSaveLocation`** - "שמור מיקום" (Save Location)
  - **Function**: Saves current location as preset
  - **Status**: ✅ Working

- **`#reminderManageLocations`** - "ניהול" (Manage)
  - **Function**: Opens preset locations management modal
  - **Status**: ✅ Working

- **`#reminderSave`** - "שמור" (Save)
  - **Function**: Saves reminder (create or update)
  - **Status**: ✅ Working

- **`#reminderDelete`** - "מחק" (Delete)
  - **Function**: Deletes the reminder
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

### Preset Locations Modal Buttons
- **`#presetLocationSave`** - "שמור" (Save)
  - **Function**: Saves preset location (create or update)
  - **Status**: ✅ Working

- **`#presetLocationDelete`** - "מחק" (Delete)
  - **Function**: Deletes preset location
  - **Status**: ✅ Working

- **Edit Button** - On each location item
  - **Function**: Loads location into form for editing
  - **Status**: ✅ Working

- **Delete Button** - On each location item
  - **Function**: Deletes that preset location
  - **Status**: ✅ Working

- **`+ הוסף מיקום חדש`** - Add new location button
  - **Function**: Clears form to add new location
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

### Reminder Category Modal Buttons
- **`#reminderCatSave`** - "שמור" (Save)
  - **Function**: Saves reminder category (create or update)
  - **Status**: ✅ Working

- **`#reminderCatDelete`** - "מחק" (Delete)
  - **Function**: Deletes the reminder category
  - **Status**: ✅ Working

- **`[data-close]`** - Close buttons
  - **Function**: Closes the modal
  - **Status**: ✅ Working

---

## 📊 ANALYTICS SCREEN

### Tab Buttons
- **`#tabDay`** - "לפי יום" (By Day)
  - **Function**: Shows daily analytics chart
  - **Status**: ✅ Working

- **`#tabWeek`** - "לפי שבוע (30 יום)" (By Week - 30 days)
  - **Function**: Shows weekly analytics chart
  - **Status**: ✅ Working

- **`#tabMonth`** - "לפי חודש" (By Month)
  - **Function**: Shows monthly analytics chart
  - **Status**: ✅ Working

- **`#tabItem`** - "לפי פריט (Top 10)" (By Item - Top 10)
  - **Function**: Shows top 10 items chart
  - **Status**: ✅ Working

---

## 🎨 MAIN NAVIGATION

### Top Navigation Tabs
- **`#navShopping`** - "קניות" (Shopping)
  - **Function**: Switches to shopping view
  - **Status**: ✅ Working

- **`#navTasks`** - "משימות" (Tasks)
  - **Function**: Switches to tasks view
  - **Status**: ✅ Working

- **`#navNotes`** - "פתקים" (Notes)
  - **Function**: Switches to notes view
  - **Status**: ✅ Working

- **`#navReminders`** - "תזכורות" (Reminders)
  - **Function**: Switches to reminders view
  - **Status**: ✅ Working

- **`#navAnalytics`** - "אנליטיקות" (Analytics)
  - **Function**: Switches to analytics view
  - **Status**: ✅ Working

### Logo
- **`#appLogo`** - Double-click
  - **Function**: Toggles between shopping and analytics views
  - **Status**: ✅ Working

---

## 🔧 FIXES APPLIED

1. ✅ **Gantt Zoom In/Out buttons** - Added functionality to zoom timeline
2. ✅ **Timeline tab initialization** - Fixed to render gantt when switching to timeline tab
3. ✅ **All button event listeners** - Verified and fixed where needed

---

## 📝 NOTES

- All modals have `[data-close]` buttons that close the modal
- Category navigation bars appear at the bottom of each screen
- Swipe gestures work on shopping items (swipe right = purchased, swipe left = unpurchased)
- Long press on shopping items opens the item editor

