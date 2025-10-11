# Markdown Table Editor

A VS Code extension that provides a spreadsheet-like interface for editing Markdown tables.

## 🚀 Quick Development Setup

**Developing this extension?** Skip the `vsce package` cycle for HTML/CSS/JS changes:

```bash
npm run setup:webview   # one-time setup for webview-react/
npm run dev:webview     # start the Vite dev server with hot reload
# Open the URL printed by Vite (e.g. http://localhost:5173/)
# Edit webview-react/src/**/* and changes appear instantly
```

> 💡 Run `npm run build-webview` before packaging to copy the latest webview bundle.

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
- **Autofill**: 
  - Drag the fill handle (bottom-right corner of selection) to auto-fill cells
  - Automatically detects patterns: numbers (1, 2, 3...), dates, weekdays, months
  - Multiple date formats supported (2024/01/29, 1/29, 2025年1月1日, preserves original format)
  - Smart text with number increment (Item 1 → Item 2, Test-A-5 → Test-A-6)
  - Preserves zero-padding (001, 002, 003...)
  - Handles multiple numbers by incrementing the last occurrence
  - Copies values as-is when no pattern is detected
  - Smart pattern recognition for series and copy operations
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
- **Multiple Tables Support**: Switch between tables using the built-in tab bar without leaving the editor
- **Mixed Content Support**: Safely edit tables in documents with mixed content (code blocks, lists, etc.)
- **Robust Error Handling**: Comprehensive error handling with status messages at the bottom
- **Table Index Tracking**: Accurately track and update specific tables in multi-table documents

## Usage

### Opening the Table Editor

1. Open a Markdown file containing one or more tables
2. Place your cursor inside a table or anywhere in the document
3. Right-click and select "Open Table Editor" or use the command palette (Ctrl+Shift+P) and search for "Markdown Table Editor: Open Table Editor"
4. **Multiple tables?** A tab bar appears at the top of the editor so you can swap between tables without leaving the webview.

### Additional Commands

- `Markdown Table Editor: Open Table Editor (New Panel)` opens another panel so you can view multiple tables side-by-side.
- `Markdown Table Editor: Select Table Editor Theme` lets you pick a dedicated theme for the editor and updates the `markdownTableEditor.theme` setting.

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
- **Tabbed Interface**: Each table opens in its own tab inside the editor so you can switch instantly.
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
- **Ctrl+Z / Cmd+Z**: Undo within cell (Editing mode)
- **Ctrl+Y / Cmd+Y** or **Shift+Ctrl+Z / Shift+Cmd+Z**: Redo within cell (Editing mode)

### Column Operations
- **Double-click** on column resize handle: Auto-fit column width to content

## Requirements

- VS Code 1.74.0 or newer

## Extension Settings

This extension contributes the following settings:

* `markdownTableEditor.theme`: Choose a dedicated theme for the webview (`inherit` follows the active VS Code theme).

## Known Issues

- Large tables (>1000 rows) may experience performance degradation
- Complex table formatting may be simplified during editing

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes and version history.

## Development Mode

For developers working on this extension, a development mode is available that allows you to test HTML, CSS, and JavaScript changes without rebuilding the VSCode extension each time.

### Quick Start

1. **Start the React webview dev server:**
   ```bash
   npm run dev:webview
   ```

2. **Open the Vite URL printed in the terminal (e.g. `http://localhost:5173/`).**

3. **Edit files:** Make changes to files in `webview-react/src/`; Vite hot-reloads changes automatically.

### Features

- **🔄 Live Development**: Vite provides instant hot reload for React components, styles, and hooks
- **🎯 Sample Data**: The dev server auto-loads representative tables when VS Code isn't attached
- **🐛 Debug-Friendly**: Rich console logging plus optional React DevTools support
- **🎨 VSCode Theming**: Accurate VSCode theme simulation for consistent development
- **📱 Mock Messaging**: Simulated VS Code messaging layer so you can exercise table operations in the browser

### Development Workflow

1. Start the dev server with `npm run dev:webview`
2. Open the printed Vite URL in your browser
3. Interact with the sample table data or connect from VS Code to load real documents
4. Edit components, hooks, and styles under `webview-react/src/`
5. Let Vite hot-reload changes (refresh only when you need a clean state)
6. Run `npm run build-webview` when you're ready to sync the bundle back into the extension

### Debugging

- Open browser developer tools (and React DevTools) to inspect state and network messages
- All table operations (add/delete rows/columns, sorting, etc.) log details to the console
- Trigger `npm run test` or launch the extension in VS Code for end-to-end validation when needed

This development mode significantly speeds up the development cycle for UI and functionality changes.

## Contributing

This extension is open source. We welcome contributions! 

Please see our [Contributing Guidelines](.github/CONTRIBUTING.md) for information on:
- How to update the changelog
- Development workflow
- Code contribution guidelines

Feel free to contribute improvements or report issues.

## License

MIT License
