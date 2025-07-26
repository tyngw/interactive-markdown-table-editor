# Markdown Table Editor

A VS Code extension that provides a spreadsheet-like interface for editing Markdown tables.

## 🚀 Quick Development Setup

**Developing this extension?** Skip the `vsce package` cycle for HTML/CSS/JS changes:

```bash
npm run dev
# Open http://localhost:3000/dev/ in your browser
# Edit webview files and refresh to see changes instantly!
```

> 💡 Use `npm run dev:watch` for file change monitoring

## Features

- **Spreadsheet-like Interface**: Edit Markdown tables in a familiar grid view with sticky headers and row numbers
- **Enhanced Cell Editing**: Adaptive text input with automatic single-line/multi-line detection and cell-size fitting
- **HTML Break Tag Support**: Automatic conversion of `<br/>` tags to line breaks for natural editing experience
- **Excel-like Navigation**: 
  - Use arrow keys to navigate between cells
  - **Ctrl+Arrow keys** for smart navigation (jump to data boundaries)
  - **Enter** to start editing a cell or move to next row
  - **Shift+Enter** for line breaks during editing
  - **Tab** to move to next cell
- **Advanced Copy/Paste Operations**: 
  - **Ctrl+C/Ctrl+V** for copying and pasting cell content (non-editing mode)
  - **Ctrl+X/Ctrl+V** for cutting and pasting cell content (non-editing mode)
  - Multi-cell selection support with tab-delimited data handling
  - Standard editing shortcuts (Ctrl+C, Ctrl+V, Ctrl+X) during cell editing
- **Column Width Management**: 
  - Manual resizing with drag handles
  - **Double-click** on resize handles for auto-fit to content
  - Persistent column widths across sessions
- **Data Synchronization**: Real-time sync between VSCode editor and Table Editor
- **IME Support**: Full support for Japanese and other input methods
- **Always-Visible Headers**: Row numbers and column headers remain visible when scrolling
- **Table Manipulation**: Add/delete rows and columns with intuitive context menus
- **Context Menu Operations**: Right-click on row/column headers for precise insertion and deletion
- **Clean Interface**: Simplified toolbar with seamless save status transitions (Saving... → Auto-saved)
- **View-Only Sorting**: Click column headers to sort table data without modifying the file (with option to save)
- **Drag & Drop**: Reorder rows and columns by dragging
- **CSV Export**: Export table data to CSV format for external use
- **Auto-save**: Changes are automatically saved back to your Markdown file
- **Multiple Tables Support**: Handle multiple tables in a single document with table selection
- **Mixed Content Support**: Safely edit tables in documents with mixed content (code blocks, lists, etc.)
- **Robust Error Handling**: Comprehensive error handling with status messages at the bottom
- **Table Index Tracking**: Accurately track and update specific tables in multi-table documents

## Usage

### Opening the Table Editor

1. Open a Markdown file containing one or more tables
2. Place your cursor inside a table or anywhere in the document
3. Right-click and select "Open Table Editor" or use the command palette (Ctrl+Shift+P) and search for "Markdown Table Editor: Open Table Editor"
4. **For Multiple Tables**: If your document contains multiple tables, you'll be presented with a selection dialog showing:
   - Table location (line numbers)
   - Column headers preview
   - Row and column counts
   - Content preview

### Creating a New Table

1. Open a Markdown file
2. Right-click and select "Create New Table" or use the command palette and search for "Markdown Table Editor: Create New Table"

### Editing Tables

- **Adaptive Cell Editing**: Input fields automatically adjust to cell size and content type
- **Multi-line Support**: Cells with longer content or line breaks automatically use textarea for natural editing
- **HTML Break Tag Processing**: Automatic conversion of `<br/>` tags to line breaks during editing, and back to tags when saving
- **Dynamic Sizing**: Text input areas resize based on content and maintain proper cell alignment
- **Smart Focus**: Editing automatically commits when selecting another cell, preventing data loss
- **Improved Input**: Text input boxes respond properly to clicks and prevent focus issues
- **Navigation**: Use arrow keys to move between cells, Tab for next cell, Shift+Tab for previous
- **Row Operations**: Right-click on row numbers for context menu with:
  - Add row above/below current position
  - Delete current row (if not the last row)
- **Column Operations**: Right-click on column headers for context menu with:
  - Add column left/right of current position
  - Delete current column (if not the last column)
- **View-Only Sorting**: Click column headers to sort table data:
  - **Safe by Default**: Sorting only affects the display, not the file
  - **Visual Indicators**: Sort controls appear when data is sorted
  - **Restore Original**: Click "📄 Restore Original" to return to file order
  - **Save Changes**: Click "💾 Save Sort to File" to make sort permanent
  - **Numeric Support**: Automatically detects and sorts numbers correctly
- **Drag & Drop**: Drag row/column headers to reorder
- **Status Messages**: Error and save messages appear at the bottom for less intrusive feedback

## Multi-Table Support

This extension now robustly handles documents containing multiple tables and mixed content:

### Multiple Tables
- **Table Selection**: When opening the editor on a document with multiple tables, choose which table to edit from an intuitive selection dialog
- **Accurate Positioning**: Each table is tracked by its index in the document, ensuring precise updates
- **Safe Updates**: Changes to one table won't affect other tables or content in the document

### Mixed Content Compatibility
- **Code Blocks**: Tables within code blocks are ignored (not parsed as actual tables)
- **Lists and Quotes**: Seamlessly handles documents with lists, block quotes, and other Markdown elements
- **Headers and Text**: Preserves all non-table content during table updates
- **Line Range Accuracy**: Uses advanced parsing to determine exact table boundaries

### Error Prevention

- **Validation**: Comprehensive validation of table structure and file content
- **Recovery**: Clear error messages and recovery options if something goes wrong

## Keyboard Shortcuts

### Navigation (Non-editing mode)
- **Arrow Keys**: Navigate between cells
- **Ctrl+Arrow Keys**: Smart navigation (jump to data boundaries, Excel-like)
- **Enter**: Start editing the selected cell
- **Tab**: Move to next cell (or next row if at end)
- **Shift+Tab**: Move to previous cell
- **Ctrl+C / Cmd+C**: Copy selected cell(s) content to clipboard
- **Ctrl+V / Cmd+V**: Paste clipboard content to selected cell(s)
- **Ctrl+X / Cmd+X**: Cut selected cell(s) content to clipboard
- **Delete/Backspace**: Clear selected cell(s) content

### Editing mode
- **Enter**: Confirm edit and move to next row (same column)
- **Shift+Enter**: Insert line break (continue editing)
- **Ctrl+Enter / Cmd+Enter**: Confirm edit and exit editing mode
- **Escape**: Confirm changes and exit editing mode
- **Tab**: Confirm edit and move to next cell
- **Ctrl+C / Cmd+C**: Copy selected text within cell
- **Ctrl+V / Cmd+V**: Paste text within cell
- **Ctrl+X / Cmd+X**: Cut selected text within cell
- **Ctrl+A / Cmd+A**: Select all text within cell
- **Ctrl+Z / Cmd+Z**: Undo within cell
- **Ctrl+Y / Cmd+Y**: Redo within cell

### Column Operations
- **Double-click** on column resize handle: Auto-fit column width to content

## Requirements

- VS Code 1.74.0 or newer

## Extension Settings

This extension contributes the following settings:

* `markdownTableEditor.enable`: Enable/disable this extension

## Known Issues

- Large tables (>1000 rows) may experience performance degradation
- Complex table formatting may be simplified during editing

## Release Notes

### 0.1.20

**Data Synchronization & Excel-like Enhancements**

- **Real-time Data Sync**: Table Editor now automatically refreshes when switching tabs, ensuring VSCode editor changes are always reflected
- **Smart Navigation**: Excel-like Ctrl+Arrow key navigation for efficient movement through data regions
- **Japanese IME Support**: Full support for Japanese input with proper Enter key handling during text conversion
- **Enhanced Save Status**: Seamless status transitions (Saving... → Auto-saved) without layout shifts
- **Column Width Intelligence**: Auto-fit functionality with double-click on resize handles
- **Scroll Position Preservation**: Edit position maintained during cell operations

### 0.1.19

**Smart Navigation & Save Status Improvements**

- **Excel-like Navigation**: Ctrl+Arrow keys for intelligent data boundary detection and movement
- **Improved Save Feedback**: Clean status indicator transitions without disruptive success messages
- **Enhanced User Experience**: More intuitive navigation patterns matching spreadsheet applications

### 0.1.18

**Japanese Input Method Support**

- **IME Compatibility**: Full support for Japanese and other input method editors
- **Smart Enter Key**: Distinguishes between IME text confirmation and edit completion
- **Multi-language Support**: Enhanced keyboard handling for international users

### 0.1.17

**Keyboard Interaction Enhancements**

- **Excel-like Enter Behavior**: Enter key confirms edit and moves to next row
- **Shift+Enter for Line Breaks**: More intuitive text input with proper line break handling
- **Tab Navigation Improvements**: Clean selection state management during cell transitions
- **Auto-fit Column Width**: Double-click resize handles to automatically fit content

### 0.1.13

**Enhanced Keyboard Interactions & Spreadsheet-like UI**

- **Improved Keyboard Navigation**: 
  - Enter key now starts editing mode (instead of moving to next cell)
  - Esc key confirms changes (instead of canceling)
- **Standard Copy/Paste Support**: Full support for Ctrl+C, Ctrl+V, Ctrl+X, and other editing shortcuts during cell editing
- **Always-Visible Headers**: Row numbers and column headers now remain visible when scrolling (sticky positioning)
- **Spreadsheet-like Experience**: More intuitive interactions matching standard spreadsheet applications

### 0.1.7

**Enhanced Precision & User Experience**

- **Fixed Resize vs Sort Conflict**: リサイズハンドルクリック時にソートが発火する問題を修正
- **Separated Operations**: ヘッダードラッグで移動、リサイズハンドルで幅変更の完全分離
- **Improved Cell Editing**: 入力フィールド内クリック時の編集継続（他セルクリック時のみ終了）
- **Enhanced Event Handling**: より精密なイベント処理で操作の誤発火を防止

### 0.1.6

**UI/UX Improvements & Bug Fixes**

- **Status Bar at Bottom**: エラーメッセージと保存状況を下部に表示
- **Simplified Toolbar**: 不要なボタンを削除し、右クリックメニューに集約
- **Enhanced Focus Management**: セル編集時のフォーカス改善
- **Bug Fix**: "Loading table data..." ハング問題を修正（JSyntaxエラー）
- **Multi-Cell Selection**: Ctrl/Cmd + クリックでの複数セル選択機能

### 0.1.5

**Multi-Table Support & Robustness**

- **Multiple Tables**: 単一文書内の複数テーブル対応
- **Table Selection Dialog**: 複数テーブル時の選択インターフェース
- **Mixed Content Support**: コードブロック、リスト等との共存
- **Index-Based Updates**: テーブルインデックスによる正確な更新
- **Enhanced Error Handling**: 堅牢なエラー処理機能

### 0.1.0

Initial release of Markdown Table Editor

- Basic table editing functionality
- Spreadsheet-like interface
- Row/column manipulation
- Sorting and drag & drop
- Auto-save

## Development Mode

For developers working on this extension, a development mode is available that allows you to test HTML, CSS, and JavaScript changes without rebuilding the VSCode extension each time.

### Quick Start

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser to:**
   ```
   http://localhost:3000/dev/
   ```

3. **Edit files and refresh:** Make changes to files in the `webview/` folder and simply refresh your browser to see the changes immediately.

### Features

- **🔄 Live Development**: Edit HTML, CSS, and JS files without rebuilding the extension
- **🎯 Sample Data**: Pre-loaded test tables for quick testing
- **🐛 Debug Tools**: Built-in debugging utilities and state inspection
- **🎨 VSCode Theming**: Accurate VSCode theme simulation for consistent development
- **📱 Mock API**: Complete VSCode API simulation for testing table operations

### Development Workflow

1. Start the development server with `npm run dev`
2. Open `http://localhost:3000/dev/` in your browser
3. Use the development controls:
   - **Sample Data Dropdown**: Choose from Simple, Complex, or Empty table templates
   - **Load Sample**: Load the selected sample data
   - **Clear**: Clear the current table
   - **Debug State**: Log the current TableEditor state to console
4. Edit files in the `webview/` folder (CSS, JS, HTML)
5. Refresh the browser to see changes immediately
6. No need to run `vsce package` during development!

### Debugging

- Open browser developer tools to see console logs
- Use the "Debug State" button to inspect the table editor state
- All table operations (add/delete rows/columns, sorting, etc.) are logged to console
- Test CSV export functionality directly in the browser

This development mode significantly speeds up the development cycle for UI and functionality changes.

## Contributing

This extension is open source. Feel free to contribute improvements or report issues.

## License

MIT License