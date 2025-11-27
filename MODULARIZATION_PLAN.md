# Modularization Plan

## Current Structure
- `public/index.html` - 5,218 lines (HTML + CSS + JavaScript all in one file)

## Target Structure

```
public/
├── index.html (minimal HTML structure)
├── css/
│   ├── variables.css ✅ (CSS variables)
│   └── components.css ✅ (component styles)
├── js/
│   ├── main.js (main entry point)
│   ├── constants.js ✅ (app constants)
│   ├── state.js (global state management)
│   ├── utils/
│   │   └── imageCache.js ✅ (image caching)
│   └── modules/
│       ├── shopping.js (categories, items)
│       ├── tasks.js (tasks, Gantt chart)
│       ├── notes.js (notes)
│       ├── reminders.js (reminders)
│       ├── analytics.js (charts, statistics)
│       └── ui.js (modals, navigation, theme)
└── utils/
    ├── firebase.js ✅ (Firebase setup)
    └── helpers.js ✅ (utility functions)
```

## Migration Strategy

### Phase 1: CSS Extraction ✅
- [x] Extract CSS variables to `css/variables.css`
- [x] Extract component styles to `css/components.css`
- [x] Update HTML to load new CSS files

### Phase 2: Core Modules
- [x] Create `constants.js`
- [x] Create `utils/imageCache.js`
- [ ] Create `state.js` (global state management)
- [ ] Create `js/main.js` (main entry point)

### Phase 3: Feature Modules
- [ ] Extract shopping module (`modules/shopping.js`)
- [ ] Extract tasks module (`modules/tasks.js`)
- [ ] Extract notes module (`modules/notes.js`)
- [ ] Extract reminders module (`modules/reminders.js`)
- [ ] Extract analytics module (`modules/analytics.js`)
- [ ] Extract UI module (`modules/ui.js`)

### Phase 4: Integration
- [ ] Update `index.html` to load `main.js` instead of inline script
- [ ] Remove inline `<style>` tag (keep only if needed for critical CSS)
- [ ] Test all functionality

## Notes
- The existing code in `index.html` will remain functional during migration
- Modules will be created incrementally
- Each module will export its initialization function
- State will be managed centrally in `state.js`

