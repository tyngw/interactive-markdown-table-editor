# Product Overview

Markdown Table Editor is a VS Code extension that provides a spreadsheet-like interface for editing Markdown tables. It transforms the traditional text-based table editing experience into an intuitive visual editor with Excel-like navigation and functionality.

## Core Features
- Spreadsheet-like grid interface with sticky headers and row numbers
- Real-time synchronization between VS Code editor and table editor
- Multi-table support with table selection dialog
- Advanced copy/paste operations with multi-cell selection
- Column width management with auto-fit capabilities
- Drag & drop for reordering rows and columns
- CSV export functionality
- View-only sorting with option to save changes
- IME support for international input methods
- Context menus for row/column operations

## Target Users
Developers and content creators who work with Markdown documentation and need to edit complex tables efficiently without losing the benefits of version control and plain text editing.

## Architecture
The extension follows a webview-based architecture with a TypeScript backend (VS Code extension) and a React frontend (webview interface) that communicates via message passing.