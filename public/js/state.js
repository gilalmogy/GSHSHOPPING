// Centralized state management for the application

class AppState {
  constructor() {
    // Shopping state
    this.categories = [];
    this.categoryTodoCounts = {};
    this.categoryUrgentCounts = {};
    this.items = {}; // {catId: array}
    this.selectedCategory = null;
    this.parsedImportItems = [];
    
    // Tasks state
    this.taskCategories = [];
    this.tasks = {}; // {catId: array}
    this.selectedTaskCategory = null;
    this.ganttViewStart = null;
    this.ganttViewEnd = null;
    this.ganttExpanded = true;
    
    // Notes state
    this.notes = [];
    this.noteCategories = [];
    this.selectedNoteCategory = null;
    
    // Reminders state
    this.reminders = [];
    this.reminderCategories = [];
    this.selectedReminderCategory = null;
    
    // Analytics state
    this.summaryStats = { open: 0, urgent: 0, weekSpend: 0, monthSpend: 0 };
    this.chartDay = null;
    this.chartWeek = null;
    this.chartMonth = null;
    this.chartItem = null;
    
    // UI state
    this.currentView = 'shopping';
    this.showingAnalytics = false;
    this.userTemplates = [];
    
    // Listeners (for cleanup)
    this.itemsUnsub = null;
    this.todoUnsubs = [];
    this.tasksUnsub = null;
    this.notesUnsub = null;
    this.remindersUnsub = null;
    this.dayUnsub = null;
    this.weekUnsub = null;
    this.monthUnsub = null;
    this.itemUnsub = null;
    
    // State change listeners
    this.listeners = new Map();
  }
  
  // Subscribe to state changes
  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }
  
  // Notify listeners of state changes
  notify(key, data) {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
  
  // Shopping state methods
  setCategories(categories) {
    this.categories = categories;
    this.notify('categories', categories);
  }
  
  setItems(catId, items) {
    this.items[catId] = items;
    this.notify('items', { catId, items });
  }
  
  setSelectedCategory(catId) {
    this.selectedCategory = catId;
    this.notify('selectedCategory', catId);
  }
  
  // Tasks state methods
  setTaskCategories(categories) {
    this.taskCategories = categories;
    this.notify('taskCategories', categories);
  }
  
  setTasks(catId, tasks) {
    this.tasks[catId] = tasks;
    this.notify('tasks', { catId, tasks });
  }
  
  setSelectedTaskCategory(catId) {
    this.selectedTaskCategory = catId;
    this.notify('selectedTaskCategory', catId);
  }
  
  // Notes state methods
  setNotes(notes) {
    this.notes = notes;
    this.notify('notes', notes);
  }
  
  setNoteCategories(categories) {
    this.noteCategories = categories;
    this.notify('noteCategories', categories);
  }
  
  // Reminders state methods
  setReminders(reminders) {
    this.reminders = reminders;
    this.notify('reminders', reminders);
  }
  
  setReminderCategories(categories) {
    this.reminderCategories = categories;
    this.notify('reminderCategories', categories);
  }
  
  // View state
  setCurrentView(view) {
    this.currentView = view;
    this.notify('currentView', view);
  }
  
  // Cleanup all listeners
  cleanup() {
    if (this.itemsUnsub) {
      try { this.itemsUnsub(); } catch(e) {}
      this.itemsUnsub = null;
    }
    this.todoUnsubs.forEach(fn => {
      try { fn(); } catch(e) {}
    });
    this.todoUnsubs = [];
    
    if (this.tasksUnsub) {
      try { this.tasksUnsub(); } catch(e) {}
      this.tasksUnsub = null;
    }
    
    if (this.notesUnsub) {
      try { this.notesUnsub(); } catch(e) {}
      this.notesUnsub = null;
    }
    
    if (this.remindersUnsub) {
      try { this.remindersUnsub(); } catch(e) {}
      this.remindersUnsub = null;
    }
    
    if (this.dayUnsub) {
      try { this.dayUnsub(); } catch(e) {}
      this.dayUnsub = null;
    }
    if (this.weekUnsub) {
      try { this.weekUnsub(); } catch(e) {}
      this.weekUnsub = null;
    }
    if (this.monthUnsub) {
      try { this.monthUnsub(); } catch(e) {}
      this.monthUnsub = null;
    }
    if (this.itemUnsub) {
      try { this.itemUnsub(); } catch(e) {}
      this.itemUnsub = null;
    }
  }
}

// Create singleton instance
const appState = new AppState();

// Export for use in modules
export default appState;

// Also export as named export for convenience
export { appState };

