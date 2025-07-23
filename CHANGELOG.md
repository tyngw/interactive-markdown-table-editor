# Changelog

All notable changes to the Markdown Table Editor extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# Changelog

## [0.1.22] - 2025-01-27

### Fixed
- **CSV Export Error**: Fixed "Invalid message format received from webview" error by adding proper message validation for exportCSV command
- **Status Bar Layout**: Redesigned status bar with fixed height to prevent layout shifts when messages appear/disappear
- **Message Positioning**: Status messages now appear in the center of the status bar for better visibility and organization

### Improved
- **Status Bar Structure**: 
  - Left: Auto-saved/Saving indicator in fixed position
  - Center: Error and success messages with proper styling
  - Right: Table information (rows/columns count)
- **Layout Stability**: Status bar maintains consistent 32px height regardless of message content
- **Visual Hierarchy**: Clear separation of permanent status indicators and temporary messages
- **Message Styling**: Improved styling for status messages with proper theming and text overflow handling

### Technical Improvements
- Added `validateExportCSVData()` method to properly validate CSV export messages
- Updated `validCommands` array to include 'exportCSV' command
- Implemented grid-based status bar layout with three distinct sections
- Enhanced CSS with fixed height and proper alignment for all status elements
- Improved message lifecycle management with proper DOM manipulation

### User Experience
- **Consistent Layout**: Status bar no longer shifts when messages appear
- **Clear Information Hierarchy**: Permanent indicators stay in fixed positions
- **Better Message Visibility**: Central positioning makes status messages more noticeable
- **Professional Appearance**: Clean, organized status bar matching VSCode's design language

## [0.1.21] - 2025-01-27

### Enhanced
- **Excel-like Copy/Paste Operations**: Added Ctrl+C/Ctrl+V for copying and pasting cell content in non-editing mode
- **Cut and Paste Functionality**: Added Ctrl+X/Ctrl+V for cutting and pasting cell content
- **Multi-cell Selection Support**: Copy/paste operations work with multiple selected cells using tab-delimited format
- **CSV Export Feature**: Export table data to CSV format with proper escaping for commas, quotes, and newlines

### Improved
- **Clipboard Integration**: Modern clipboard API with fallback support for older browsers
- **Data Format Handling**: Automatic conversion between Markdown <br/> tags and newlines for clipboard operations
- **File Export Dialog**: Native file save dialog with CSV filter for easy file management
- **Error Handling**: Comprehensive error handling for clipboard and export operations

### Technical Improvements
- Added `copySelectedCells()`, `pasteToSelectedCells()`, and `cutSelectedCells()` functions
- Implemented `generateCSVContent()` with proper CSV field escaping
- Enhanced keyboard event handling for Ctrl+C, Ctrl+V, and Ctrl+X in non-editing mode
- Added `exportCSV` command with VSCode file system integration
- Modern clipboard API with graceful degradation to legacy methods

### User Experience
- **Familiar Shortcuts**: Standard Ctrl+C/V/X shortcuts work as expected outside of edit mode
- **Multi-format Support**: Seamless data exchange between Table Editor and external applications
- **Export Convenience**: One-click CSV export with timestamp-based default filenames
- **Visual Feedback**: Clear success/error messages for all clipboard and export operations

### Documentation Updates
- Updated requirements.md with new Excel-like operation requirements
- Enhanced README.md with comprehensive feature descriptions and keyboard shortcuts
- Added detailed release notes covering all new functionality

## [0.1.20] - 2025-01-27

### Fixed
- **Data Synchronization**: Fixed issue where VSCode editor changes weren't reflected in Table Editor when using cached panels
- **Tab Activation Refresh**: Table Editor now automatically refreshes data when its tab becomes active
- **Cache Invalidation**: Implemented force refresh mechanism to ensure data consistency between editor and Table Editor

### Enhanced
- **Real-time Sync**: Table Editor panels now stay synchronized with file changes made in VSCode editor
- **Panel State Management**: Added `onDidChangeViewState` event listener to detect when panels become active
- **Data Freshness**: Automatic data refresh when switching back to Table Editor tab ensures latest content is always displayed

### Technical Improvements
- Added `refreshPanelData()` method to WebviewManager for forced data refresh
- Enhanced `requestTableData` command with `forceRefresh` flag for cache invalidation  
- Improved table data manager lifecycle to handle file content changes
- Added panel activation detection with automatic data synchronization
- Reduced success message spam during automatic refreshes

### User Experience
- **Seamless Editing**: Users can now edit in VSCode editor and see changes immediately when switching to Table Editor
- **No Manual Refresh**: Eliminates need for manual refresh or reopening Table Editor after external changes
- **Consistent State**: Table Editor always shows the current state of the file, regardless of edit source

## [0.1.19] - 2025-01-27

### Enhanced
- **Save Status Improvement**: Fixed Auto-saved label positioning and replaced success messages with status transitions
- **Smart Navigation**: Added Excel-like Ctrl+Arrow key navigation for intelligent cell movement
- **Status Display**: Saving... → Auto-saved status transitions without layout shifts
- **Cell Navigation**: Ctrl+Arrow keys now move to data boundaries like Excel

### Improved
- **Save Indicator**: Replaced "Cell update successfully" messages with seamless status label updates
- **Navigation Logic**: Smart movement based on cell content - jumps to data edges or next data regions
- **User Experience**: More intuitive navigation patterns matching spreadsheet applications
- **Visual Feedback**: Consistent save status display without position changes

### Technical Improvements
- Added `showSavingStatus()` and `showAutoSavedStatus()` functions for seamless status updates
- Implemented `navigateCellSmart()` with Excel-compatible navigation logic
- Enhanced `showSuccess()` to filter out cell update messages and show auto-saved status instead
- Added `hasContent()` helper for intelligent data boundary detection
- Ctrl+Arrow key handlers now call smart navigation functions with direction parameters

### Navigation Features
- **Ctrl+Up/Down**: Move to data region boundaries or jump to next data cell
- **Ctrl+Left/Right**: Navigate horizontally through data regions intelligently
- **Data-aware**: Distinguishes between cells with content and empty cells
- **Boundary Detection**: Stops at appropriate data boundaries like Excel

### Testing
- Added test-smart-navigation.md with comprehensive test scenarios
- Enhanced test coverage for both save status and navigation features

## [0.1.18] - 2025-01-27

### Fixed
- **Japanese IME Input Support**: Fixed critical issue where Japanese IME confirmation Enter would exit edit mode
- **IME Composition Detection**: Added proper IME state tracking to distinguish between text confirmation and edit completion
- **Enter Key Behavior**: Enter key during IME composition now only confirms text input without exiting edit mode
- **Multi-language Input**: Enhanced support for all IME-based input methods (Japanese, Chinese, Korean, etc.)

### Improved
- **Input Method Compatibility**: Better handling of complex text input scenarios with proper event separation
- **User Experience**: Japanese and other IME users can now input text naturally without unexpected edit mode exits
- **Event Handling**: More sophisticated keyboard event processing with IME state awareness

### Technical Improvements
- Added `compositionstart`, `compositionupdate`, and `compositionend` event listeners for IME tracking
- Implemented `isComposing` state variable to track IME input status
- Enhanced Enter key handler to check IME state before triggering edit completion
- Added comprehensive logging for IME state debugging
- Improved input event handling with IME-aware processing

### Testing
- Added test-ime-input.md with comprehensive Japanese IME testing scenarios
- Enhanced test coverage for multi-language input methods and edge cases

## [0.1.17] - 2025-01-27

### Enhanced
- **Tab Navigation Improvement**: Fixed cell selection state clearing when exiting edit mode via Tab key
- **Enter Key Behavior**: Changed Enter key to confirm edit and move to next row (Excel-like behavior)
- **Shift+Enter for Line Breaks**: Shift+Enter now inserts line breaks while continuing edit mode
- **Auto-Fit Column Width**: Added double-click on resize handle to auto-fit column width to content (Excel-like)

### Improved
- **Keyboard Interactions**: More intuitive and Excel-like keyboard navigation in edit mode
- **Cell Selection Management**: Proper selection state cleanup during navigation transitions
- **Column Width Intelligence**: Smart auto-sizing based on actual content width with min/max limits
- **User Experience**: Consistent behavior patterns matching spreadsheet applications

### Technical Improvements
- Enhanced Tab key handler to clear previous cell selection before navigation
- Separated Enter (confirm + move down) from Shift+Enter (line break) functionality
- Implemented content-based width calculation with temporary DOM measurement
- Added auto-fit functionality with 80px minimum and 400px maximum width constraints
- Improved edit mode transitions with proper selection state management

### Testing
- Added test-keyboard-interactions.md for comprehensive interaction testing
- Enhanced test coverage for keyboard navigation and column auto-sizing scenarios

## [0.1.16] - 2025-01-27

### Fixed
- **Long URL Content Width Issue**: Fixed critical issue where long URLs and non-breaking strings would expand cell width beyond set limits
- **Cell Width Enforcement**: Added max-width constraints to prevent content overflow from breaking column width settings
- **Text Wrapping for Long Content**: Enhanced text wrapping with word-break:break-all to handle URLs and long strings properly
- **Column Resize Functionality**: Fixed column resizing to work correctly even with long content present

### Improved
- **Content Overflow Handling**: Long URLs and non-breaking strings now wrap properly within cell boundaries
- **Width Stability**: Cell widths remain stable regardless of content length or type
- **User Experience**: Column resizing works consistently with all content types
- **Layout Integrity**: Table layout maintains structure even with challenging content

### Technical Improvements
- Added max-width CSS property to both th and td elements to enforce width limits
- Enhanced .cell-content with word-break:break-all and overflow:hidden for content containment
- Updated JavaScript width setting to include max-width in all resize operations
- Added comprehensive width constraints (width, min-width, max-width) throughout rendering pipeline

### Testing
- Added test-long-url.md with various long URL and string scenarios
- Enhanced test coverage for edge cases with non-breaking content

## [0.1.15] - 2025-01-27

### Fixed
- **Critical Width Control Issue**: Fixed cell width changing during VSCode window resize by implementing fixed-width table layout
- **Table Layout Optimization**: Changed from `table-layout: fixed` to `table-layout: auto` with explicit cell widths to prevent automatic resizing
- **Width Persistence**: All cell widths now remain constant regardless of window size changes
- **Default Width Management**: Improved default column width initialization and management

### Changed
- **Table Width Behavior**: Changed table width from 100% to auto-calculated based on cell widths
- **Cell Width Strategy**: All cells now have explicit width values instead of relying on CSS min-width only
- **Resize Logic**: Enhanced window resize handling to preserve all column widths consistently

### Improved
- **Stable Layout**: Table layout no longer responds to window size changes unless explicitly resized by user
- **Better Width Control**: More predictable and stable column width behavior across all scenarios
- **Performance**: Reduced unnecessary layout recalculations during window resize events

### Technical Improvements
- Modified table CSS from `width: 100%` and `table-layout: fixed` to `width: auto` and `table-layout: auto`
- Added explicit width initialization for all columns with 150px default
- Enhanced columnWidths state management to always contain width values
- Improved window resize event handler to maintain all column widths

## [0.1.14] - 2025-01-27

### Changed
- **Column-Based Width Control**: Modified default minimum width control from table-level to column-level for more granular control
- **Enhanced Column Minimum Width**: Increased default column minimum width from 120px to 150px for better readability
- **Improved Width Management**: Individual columns can now be resized below default minimum width after user interaction
- **Window Resize Behavior**: VSCode window resizing now preserves existing cell widths instead of resetting them

### Improved
- **Better Default Layout**: Wider default column widths provide better initial viewing experience
- **Flexible Resizing**: Users can resize columns to smaller widths (80px minimum) after initial interaction
- **Width Persistence**: Column widths are maintained during window resize operations
- **Per-Column Control**: Each column can have different minimum width constraints based on user interaction

### Technical Improvements
- Replaced table-level min-width with column-level min-width controls
- Added `user-resized` class management for individual columns
- Enhanced window resize event handling to preserve cell dimensions
- Improved column width state management in rendering functions

## [0.1.13] - 2025-01-27

### Fixed
- **Scroll Position Preservation**: Fixed critical issue where scroll position was reset to top after cell editing completion
- **Table Re-rendering Optimization**: Implemented intelligent partial updates to avoid unnecessary full DOM reconstruction
- **Sort View Scroll Maintenance**: Fixed scroll position reset when applying or restoring sort views
- **Editing Position Visibility**: Added automatic scroll to edited cell position after completion to maintain user context

### Improved
- **Performance Optimization**: Reduced DOM manipulation by implementing content-only updates for unchanged table structure
- **User Experience**: Enhanced editing workflow by maintaining visual context throughout the editing process
- **Smart Rendering**: Introduced conditional rendering logic to distinguish between structural and content-only changes

### Technical Improvements
- Added `renderTableWithScrollPreservation()` function for scroll-aware table updates
- Implemented `updateTableContentOnly()` for efficient partial content updates
- Enhanced sort functions with scroll position preservation
- Added automatic scroll-to-cell functionality after editing completion

### Testing
- Enhanced test coverage for scroll position preservation scenarios
- Added test cases for sort operations with scroll maintenance

## [0.1.12] - 2025-07-22

### Fixed
- **Cell Editing Alignment**: Fixed text alignment in editing mode to be top-aligned instead of center-aligned
- **Auto-wrap in Edit Mode**: Enabled automatic text wrapping during cell editing for better user experience
- **Width Preservation**: Fixed issue where cell and column widths were reset after editing completion
- **Column Width Consistency**: Ensured column headers maintain the same width as their corresponding cells after editing

### Improved
- **Text Input Alignment**: Cell input fields now properly align text to the top-left, matching the display mode
- **Textarea Handling**: Enhanced textarea configuration for multi-line content with proper wrapping
- **Dimension Persistence**: Cell and column dimensions are now maintained throughout the editing process

### Technical Improvements
- Updated CSS for proper text alignment in editing mode
- Enhanced `startCellEdit()` function to preserve cell dimensions
- Improved `commitCellEdit()` and `cancelCellEdit()` to maintain width settings
- Added proper vertical alignment and text wrapping for input fields

### Testing
- Added new test file for cell editing alignment and wrapping
- Enhanced existing test suite with alignment and dimension preservation tests

## [0.1.11] - 2025-07-22

### Fixed
- **HTML Break Tag Display**: Fixed issue where `<br/>` tags were not properly converted to line breaks in display
- **Break Tag Processing**: Improved `processCellContent()` function to correctly handle HTML break tag conversion
- **HTML Escaping**: Enhanced `escapeHtmlExceptBreaks()` to preserve break tags while escaping other HTML content
- **Debug Logging**: Added temporary debug logging to troubleshoot break tag processing

### Technical Improvements
- Fixed HTML break tag display rendering
- Improved cell content processing pipeline
- Enhanced HTML escaping logic for break tags

## [0.1.10] - 2025-07-22

### Enhanced
- **HTML Break Tag Support**: Automatic detection and conversion of `<br/>` tags to line breaks
- **Bidirectional Tag Processing**: Seamless conversion between HTML tags and newlines for editing and storage
- **Improved Cell Content Processing**: Enhanced display, editing, and storage format handling
- **Better Multi-line Editing**: Natural editing experience with proper HTML tag support
- **Enhanced Sorting**: Improved sorting behavior with HTML tag-aware comparison

### Technical Improvements
- Added `processCellContent()` for display format conversion
- Added `processCellContentForEditing()` for edit format conversion
- Added `processCellContentForStorage()` for storage format conversion
- Improved sorting algorithm to handle HTML break tags
- Enhanced cell rendering with proper tag-to-newline conversion

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
