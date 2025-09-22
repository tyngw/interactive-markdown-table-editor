# Project Structure

## Root Directory
- `src/` - Main extension TypeScript source code
- `webview-react/` - React frontend for the table editor interface
- `test/` - Integration and E2E tests
- `docs/` - Specification and documentation files
- `out/` - Compiled TypeScript output
- `webview-dist/` - Built React application for production

## Extension Source (`src/`)
- `extension.ts` - Main extension entry point and command registration
- `webviewManager.ts` - Manages webview panels and communication
- `tableDataManager.ts` - Handles table data operations and state
- `markdownParser.ts` - Parses and manipulates Markdown table syntax
- `fileHandler.ts` - File I/O operations and encoding handling
- `themeUtils.ts` - VS Code theme integration utilities
- `undoRedoManager.ts` - Undo/redo functionality management
- `messages/` - Type definitions and validators for webview communication

## React Frontend (`webview-react/src/`)
- `App.tsx` - Main React application component
- `components/` - React UI components (TableEditor, TableCell, ContextMenu, etc.)
- `hooks/` - Custom React hooks for functionality (useTableEditor, useClipboard, etc.)
- `contexts/` - React context providers (StatusContext, ThemeContext)
- `utils/` - Utility functions (contentConverter, tableUtils)
- `types/` - TypeScript type definitions
- `__tests__/` - Jest test files for components and hooks

## Testing Structure
- `src/test/` - Extension unit tests (Mocha)
- `test/integration/` - Integration tests
- `test/e2e/` - End-to-end tests
- `webview-react/src/__tests__/` - React component tests (Jest)

## Key Architectural Patterns
- **Manager Pattern**: Singleton managers for webview, table data, and undo/redo
- **Message Passing**: Communication between extension and webview via structured messages
- **Hook-based React**: Custom hooks encapsulate complex logic (table editing, clipboard, etc.)
- **Context Providers**: React contexts for theme and status management
- **Modular Components**: Separated concerns with dedicated components for each UI element