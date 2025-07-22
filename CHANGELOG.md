# Changelog

All notable changes to the Markdown Table Editor extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# Changelog

## [0.1.9] - 2025-07-22

### Enhanced
- **Adaptive Cell Editing**: Text input fields now automatically adjust to cell size and content
- **Multi-line Support**: Automatic detection and handling of multi-line content with textarea
- **Dynamic Input Sizing**: Input fields resize dynamically based on content and cell dimensions
- **Natural Editing Experience**: Seamless transition between single-line inputs and multi-line textareas
- **Improved Keyboard Navigation**: Enhanced Tab navigation and Enter key handling for different input types

### Technical Improvements
- Input field positioning and sizing calculations for better visual alignment
- Auto-resize functionality for textareas based on content
- Improved CSS styling for both input and textarea elements
- Enhanced event handling for different input types

## [0.1.8] - 2025-07-22

### Added
- **View-Only Sorting**: Table sorting now operates in view-only mode by default
  - Sorting no longer modifies the file automatically
  - Visual indicators show when data is sorted temporarily
  - "📄 Restore Original" button to return to file order
  - "💾 Save Sort to File" button to make sort changes permanent
  - Status bar shows current sort state (view-only vs saved)
- **Enhanced Sort Controls**: Sort actions panel appears when viewing sorted data
- **Numeric Sort Support**: Improved sorting algorithm that properly handles numeric data
- **Sort State Management**: Better tracking of original vs sorted data states

### Changed
- **Default Sort Behavior**: Column header clicks now apply view-only sorting instead of saving immediately
- **Sort Visual Indicators**: Enhanced styling to differentiate between view-only and committed sorts
- **Data Safety**: Original table order is preserved unless explicitly saved

### Improved
- **User Control**: Users can now choose when to persist sort changes to the file
- **Data Integrity**: Prevents accidental permanent sorting of table data
- **Visual Feedback**: Clear indication of temporary vs permanent sort states

## [0.1.7] - 2025-07-22

### Fixed
- **Column Resize Event Handling**: Improved event separation between resize and sort operations
  - Added `event.stopPropagation()` to resize handle mousedown events
  - Enhanced resize state management to prevent click event interference
  - Fixed issue where resizing columns would trigger unwanted sort operations

### Added
- **Test Files**: Added comprehensive test files for resize and sort functionality

### Improved
- **Event Handling**: More precise control over mouse and click events in table headers
- **User Experience**: Column resizing now works without interfering with other operations

## [0.1.6] - 2025-07-21

### Added
- **Enhanced UI/UX**: Major interface improvements for better usability
  - **Bottom Status Bar**: Error and save messages now appear at the bottom
  - **Simplified Toolbar**: Removed Save, Export, Delete Row, and Delete Column buttons
  - **Context Menu Focus**: All row/column operations now use right-click context menus
  - **Smart Focus Management**: Cell editing automatically commits when selecting another cell
  - **Improved Input Handling**: Better handling of text input clicks and focus

### Changed
- **Message System**: All status messages moved to bottom status bar for non-intrusive feedback
- **Command Structure**: Removed "Create New Table" command for focused editing experience
- **Interface Layout**: Cleaner workspace with minimized UI clutter

### Improved
- **Editing Experience**: Enhanced cell editing with better focus management
- **Event Propagation**: Better control of keyboard and mouse events during editing
- **Theme Integration**: All UI elements now properly use VSCode theme colors

## [0.1.5] - 2025-07-21

### Added
- **Multi-Table Support**: Complete support for documents with multiple tables
  - **Table Selection Dialog**: Choose which table to edit from an intuitive QuickPick dialog
  - **Table Index Tracking**: Each table is tracked by its index for precise updates
  - **Mixed Content Compatibility**: Safely handles documents with code blocks, lists, etc.

### Enhanced
- **Markdown Parser**: Advanced AST parsing that distinguishes actual tables from table-like content
- **File Handler**: Index-based table updates that preserve all other document content
- **Error Handling**: Comprehensive validation and recovery options
- **Table Selection UI**: Shows table location, headers, size, and content preview

### Fixed
- **Table Position Accuracy**: Precise line range calculation prevents content corruption
- **Content Preservation**: All non-table content is preserved during updates
- **Table Identification**: Accurate detection of table boundaries in complex documents

## [0.1.0] - 2025-07-20

### Added
- **Initial Release**: Spreadsheet-like Markdown table editor
- **Basic Editing**: Cell editing with keyboard navigation
- **Table Operations**: Add/delete rows and columns
- **Sorting**: Click column headers to sort data
- **Drag & Drop**: Reorder rows and columns
- **Auto-save**: Automatic saving of changes back to Markdown files
- **VSCode Integration**: Context menu and command palette integration

### Features
- Excel-like grid interface for table editing
- Keyboard navigation (arrows, Tab, Enter)
- Context menu operations for rows and columns
- Real-time table manipulation
- Markdown file integration with automatic updates
