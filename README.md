# Interactive Markdown Table Editor

A VS Code extension that provides an intuitive interface for editing Markdown tables.

![Product Image](docs/product-image.gif)

## Quick Start

1. Open a Markdown file containing a table
2. Right-click and select "Open Table Editor" or use the Command Palette (Cmd/Ctrl+Shift+P) and run "Markdown Table Editor: Open Table Editor"

## Features

### UI and Basic Operations
- Interface: Grid display for intuitive Markdown table editing with always-visible headers and row numbers
- Data Synchronization: Real-time sync between VS Code editor and Table Editor

### Cell Editing
- Ctrl+C/Ctrl+V for copying and pasting cell content (non-editing mode)
- Ctrl+X/Ctrl+V for cutting and pasting cell content (non-editing mode)

### Table Operations
- Add/Delete Rows & Columns: Right-click on headers to add and delete rows and columns
- Drag & Drop: Reorder rows and columns by dragging
- Column Width Management:
  - Manual resizing with drag handles
  - Double-click resize handles for auto-fit to content
  - Persistent column widths across sessions
- Sorting: Click column header sorting button to sort data in the table editor without modifying the file

### Autofill
- Drag the fill handle (bottom-right corner of selection) to auto-fill cells
- Automatically detects patterns: numbers (1, 2, 3...), dates, weekdays, months
- Multiple date formats supported (2024/01/29, 1/29, 2025/1/1, preserves original format)
- Smart text with number increment (Item 1 → Item 2, Test-A-5 → Test-A-6)
- Preserves zero-padding (001, 002, 003...)
- Handles multiple numbers by incrementing the last occurrence
- Copies values as-is when no pattern is detected

### CSV Import / CSV Export
- CSV Import: Import CSV data from file or clipboard, inserting or replacing existing table
- CSV Export: Export table data to CSV format

### Multiple Tables
- Manage and edit multiple tables within a single document using tab interface. Accurately tracks and updates each table with index management

### Git Diff Display
- Uses the VS Code Git extension and the system `git` command to fetch per-row diffs (added/deleted) for tables in the open Markdown file and display them in the table editor.
- Prerequisites: workspace must be a Git repository, the VS Code Git extension must be active, and `git` must be installed on the system and available in PATH.

## Keyboard Shortcuts

### Navigation (Non-editing mode)
- Arrow Keys: Navigate between cells
- Ctrl+Arrow Keys: Jump to data boundaries (Excel-like navigation)
- Enter: Start editing the selected cell
- Tab: Move to next cell/row
- Shift+Tab: Move to previous cell
- Ctrl+C / Cmd+C: Copy selected cell(s) content
- Ctrl+V / Cmd+V: Paste clipboard content to selected cell(s)
- Ctrl+X / Cmd+X: Cut selected cell(s) content
- Delete/Backspace: Clear selected cell(s) content

### Editing mode
- Enter: Confirm edit and move to next row (same column)
- Shift+Enter: Insert line break (continue editing)
- Ctrl+Enter / Cmd+Enter: Confirm edit and exit editing mode
- Escape: Confirm changes and exit editing mode
- Tab: Confirm edit and move to next cell
- Ctrl+C / Cmd+C: Copy selected text within cell
- Ctrl+V / Cmd+V: Paste text within cell
- Ctrl+X / Cmd+X: Cut selected text within cell
- Ctrl+A / Cmd+A: Select all text within cell
- Ctrl+Z / Cmd+Z: Undo within cell (Editing mode)
- Ctrl+Y / Cmd+Y or Shift+Ctrl+Z / Shift+Cmd+Z: Redo within cell (Editing mode)

## Usage

### Opening the Table Editor
- Right-click and select "Open Table Editor"
- Or use the Command Palette (Cmd/Ctrl+Shift+P) and run "Markdown Table Editor: Open Table Editor"
- Use "Open Table Editor (New Panel)" to open in a separate panel (useful for side-by-side comparison)

### Theme Settings
- Use "Select Table Editor Theme" to choose a dedicated theme for the editor
- Set `markdownTableEditor.theme` to `inherit` to follow the current VS Code theme

## Extension Settings

This extension provides the following settings:

* `markdownTableEditor.theme`: Choose a dedicated theme for the editor. Set to `inherit` to follow VS Code's current theme

## Supported Languages

This extension supports the following languages:

* English
* Japanese (日本語)
* Simplified Chinese (中文（简体字）)

The UI automatically displays in the language set in VS Code.

## Known Issues

- Large tables (over 1000 rows) may experience performance degradation
- Complex table formatting may be simplified during editing

## Release Notes

For detailed change history, see [CHANGELOG.md](CHANGELOG.md).
