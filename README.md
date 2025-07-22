# Markdown Table Editor

A VS Code extension that provides a spreadsheet-like interface for editing Markdown tables.

## Features

- **Spreadsheet-like Interface**: Edit Markdown tables in a familiar grid view
- **Cell Navigation**: Use arrow keys, Tab, and Enter to navigate between cells
- **Table Manipulation**: Add/delete rows and columns with intuitive context menus
- **Context Menu Operations**: Right-click on row/column headers for precise insertion and deletion
- **Clean Interface**: Simplified toolbar with status messages at the bottom for focused editing
- **Enhanced Editing**: Improved cell editing with better focus management and input handling
- **View-Only Sorting**: Click column headers to sort table data without modifying the file (with option to save)
- **Drag & Drop**: Reorder rows and columns by dragging
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
- **Backup Creation**: Automatic backup before any file modification
- **Validation**: Comprehensive validation of table structure and file content
- **Recovery**: Clear error messages and recovery options if something goes wrong

## Keyboard Shortcuts

- **Arrow Keys**: Navigate between cells
- **Tab**: Move to next cell (or next row if at end)
- **Shift+Tab**: Move to previous cell
- **Enter**: Move to cell below (or confirm edit)
- **Escape**: Cancel cell edit

## Requirements

- VS Code 1.74.0 or newer

## Extension Settings

This extension contributes the following settings:

* `markdownTableEditor.enable`: Enable/disable this extension

## Known Issues

- Large tables (>1000 rows) may experience performance degradation
- Complex table formatting may be simplified during editing

## Release Notes

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
- **Enhanced Error Handling**: 堅牢なエラー処理とバックアップ機能

### 0.1.0

Initial release of Markdown Table Editor

- Basic table editing functionality
- Spreadsheet-like interface
- Row/column manipulation
- Sorting and drag & drop
- Auto-save and backup

## Contributing

This extension is open source. Feel free to contribute improvements or report issues.

## License

MIT License