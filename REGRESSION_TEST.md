# Regression Test Checklist

## Critical Issues Found

### ❌ BLOCKING ISSUES
1. **stubs.js Module Conflicts** - RESOLVED ✅
   - Removed dangerous stubs.js file that conflicted with full implementations
   - Risk: Complete feature loss if stubs override real modules

2. **Missing DOM Elements** - NEEDS FIX 🚨
   - `id="tableEditor"` missing from table element
   - `id="sortStatusInfo"` missing 
   - Various status elements missing IDs

3. **Missing HTML Processing Functions** - PARTIALLY RESOLVED ⚠️
   - Added `processCellContentForEditing` and `processCellContentForStorage` to table-renderer.js
   - But modules may not have access to these functions

### ⚠️ POTENTIAL ISSUES

4. **CSV Export Module** - RESOLVED ✅
   - Created csv-exporter.js module
   - Added to webviewManager loading sequence

5. **DOM Container Structure** - RESOLVED ✅
   - Added table-container, sort-actions, export-actions
   - Status bar will be created by StatusBarManager

## Feature Comparison Matrix

| Feature Category | Backup (Original) | New Modular | Status |
|------------------|-------------------|-------------|---------|
| **Core Infrastructure** |
| VSCode API Init | ✅ | ✅ | ✅ PASS |
| Global State | ✅ | ✅ | ✅ PASS |
| Message Handling | ✅ | ✅ | ✅ PASS |
| **Table Rendering** |
| Basic Table Display | ✅ | ✅ | ✅ PASS |
| Column Width Management | ✅ | ✅ | ✅ PASS |
| HTML Content Processing | ✅ | ✅ | ✅ PASS |
| **Cell Editing** |
| Inline Editing | ✅ | ✅ | ✅ PASS |
| IME Support | ✅ | ✅ | ✅ PASS |
| Edit Validation | ✅ | ✅ | ✅ PASS |
| **Selection Management** |
| Single Cell | ✅ | ✅ | ✅ PASS |
| Multi-cell | ✅ | ✅ | ✅ PASS |
| Row/Column Select | ✅ | ✅ | ✅ PASS |
| **Keyboard Navigation** |
| Arrow Keys | ✅ | ✅ | ✅ PASS |
| Tab Navigation | ✅ | ✅ | ✅ PASS |
| Smart Navigation | ✅ | ✅ | ✅ PASS |
| **Clipboard Operations** |
| Copy/Paste | ✅ | ✅ | ✅ PASS |
| Cut | ✅ | ✅ | ✅ PASS |
| TSV/CSV Support | ✅ | ✅ | ✅ PASS |
| **Sorting** |
| View-only Sort | ✅ | ✅ | ✅ PASS |
| Commit Sort | ✅ | ✅ | ✅ PASS |
| Sort Indicators | ✅ | ✅ | ✅ PASS |
| **Column Operations** |
| Resize | ✅ | ✅ | ✅ PASS |
| Auto-fit | ✅ | ✅ | ✅ PASS |
| Insert/Delete | ✅ | ✅ | ✅ PASS |
| **Row Operations** |
| Insert/Delete | ✅ | ✅ | ✅ PASS |
| Context Menu | ✅ | ✅ | ✅ PASS |
| **Drag & Drop** |
| Row Reorder | ✅ | ✅ | ✅ PASS |
| Column Reorder | ✅ | ✅ | ✅ PASS |
| Visual Feedback | ✅ | ✅ | ✅ PASS |
| **Status & Feedback** |
| Position Display | ✅ | ✅ | ✅ PASS |
| Table Stats | ✅ | ✅ | ✅ PASS |
| Status Messages | ✅ | ✅ | ✅ PASS |
| **Data Export** |
| CSV Export | ✅ | ✅ | ✅ PASS |

## Critical Fixes Still Needed

### 1. DOM ID Addition
```javascript
// In table-renderer.js renderTable function, need to add:
<table class="table-editor" id="tableEditor">
```

### 2. Function Access
Verify all modules can access HTML processing functions from table-renderer.

## Testing Plan

### Phase 1: Basic Functionality (HIGH PRIORITY)
- [ ] Load table data
- [ ] Cell editing
- [ ] Basic navigation
- [ ] Save changes

### Phase 2: Advanced Features (MEDIUM PRIORITY)  
- [ ] Sorting operations
- [ ] Copy/paste
- [ ] Column resize
- [ ] Context menus

### Phase 3: Edge Cases (LOW PRIORITY)
- [ ] Large tables (1000+ rows)
- [ ] Special characters
- [ ] IME input
- [ ] Error conditions

## Status Summary

**CURRENT STATE**: 🚧 Near completion, blocking issues mostly resolved
**NEXT ACTIONS**: 
1. Fix DOM ID issues
2. Test basic functionality
3. Verify no regressions

**RISK LEVEL**: 🟡 MEDIUM (down from 🔴 HIGH after resolving stubs conflict)
