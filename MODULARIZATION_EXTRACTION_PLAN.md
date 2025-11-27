# Modularization Extraction Plan

## Strategy
Extract JavaScript from `index.html` incrementally, testing after each module to ensure nothing breaks.

## Module Dependencies
```
state.js (no dependencies)
  ↓
ui.js (depends on: state, constants)
  ↓
helpers.js (already exists in utils/)
  ↓
shopping.js (depends on: state, ui, helpers, firebase)
  ↓
tasks.js (depends on: state, ui, helpers, firebase)
  ↓
notes.js (depends on: state, ui, helpers, firebase)
  ↓
reminders.js (depends on: state, ui, helpers, firebase)
  ↓
analytics.js (depends on: state, ui, helpers, firebase)
```

## Extraction Order

### Phase 1: Foundation ✅
- [x] state.js - Centralized state management
- [x] ui.js - Navigation and theme (started)

### Phase 2: Complete UI Module
- [ ] Add date utilities to ui.js or separate utils
- [ ] Add modal helpers
- [ ] Complete UI initialization

### Phase 3: Shopping Module (Largest - ~1200 lines)
- [ ] Categories management
- [ ] Items management
- [ ] Templates
- [ ] Import functionality
- [ ] Search and filtering

### Phase 4: Tasks Module (~800 lines)
- [ ] Task categories
- [ ] Task CRUD
- [ ] Gantt chart rendering
- [ ] Task navigation

### Phase 5: Notes Module (~400 lines)
- [ ] Note categories
- [ ] Note CRUD
- [ ] Note rendering

### Phase 6: Reminders Module (~400 lines)
- [ ] Reminder categories
- [ ] Reminder CRUD
- [ ] Location/time checking

### Phase 7: Analytics Module (~600 lines)
- [ ] Chart rendering
- [ ] Statistics calculation
- [ ] Data aggregation

### Phase 8: Integration
- [ ] Update main.js to import all modules
- [ ] Update index.html to use main.js
- [ ] Remove inline script
- [ ] Test thoroughly

## Notes
- Keep existing code in index.html until all modules are extracted and tested
- Each module should export an `init()` function
- Modules communicate through appState
- Use event listeners for cross-module communication when needed

