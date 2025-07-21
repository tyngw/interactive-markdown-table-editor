# Markdown Table Editor

A VS Code extension that provides a spreadsheet-like interface for editing Markdown tables.

## Features

- **Spreadsheet-like Interface**: Edit Markdown tables in a familiar grid view
- **Cell Navigation**: Use arrow keys, Tab, and Enter to navigate between cells
- **Table Manipulation**: Add/delete rows and columns with easy-to-use controls
- **Sorting**: Click column headers to sort table data
- **Drag & Drop**: Reorder rows and columns by dragging
- **Auto-save**: Changes are automatically saved back to your Markdown file
- **Multiple Tables Support**: Handle multiple tables in a single document with table selection
- **Mixed Content Support**: Safely edit tables in documents with mixed content (code blocks, lists, etc.)
- **Robust Error Handling**: Comprehensive error handling with automatic backup creation
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

- **Cell Editing**: Click any cell to start editing, press Enter or Tab to confirm
- **Navigation**: Use arrow keys to move between cells
- **Add Row**: Click the "+" button at the end of any row
- **Add Column**: Click the "+" button at the end of the header row
- **Delete Row/Column**: Right-click on row/column headers for delete options
- **Sorting**: Click column headers to sort (click again to reverse order)
- **Drag & Drop**: Drag row/column headers to reorder

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