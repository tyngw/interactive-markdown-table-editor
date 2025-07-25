# Development Guidelines

## Git Commit Rules

### Commit Message Prefixes
All commit messages must use one of the following prefixes:

- `feat: ` - New features or functionality
- `fix: ` - Bug fixes
- `refactor: ` - Code refactoring without changing functionality
- `doc: ` - Documentation changes

### Example Commit Messages
- `feat: add markdown table parser with AST extraction`
- `fix: resolve table position detection issue`
- `refactor: improve table parsing performance`
- `doc: update API documentation for parser`

## Development Workflow

### Task Completion Process
1. **Implement the task** - Write code according to the task requirements
2. **Run tests** - Execute all relevant tests to ensure functionality works
3. **Verify test success** - All tests must pass before proceeding
4. **Git commit** - Commit changes with appropriate prefix
5. **Update task status** - Mark task as completed in tasks.md

### VSIX Package Creation
**IMPORTANT**: Before creating a new VSIX package, always increment the version number in `package.json`:
- For bug fixes: increment patch version (e.g., 0.1.2 → 0.1.3)
- For new features: increment minor version (e.g., 0.1.3 → 0.2.0)
- For breaking changes: increment major version (e.g., 0.2.0 → 1.0.0)

Steps to create a new package:
1. Update version in `package.json`
2. Run `npm run compile` to compile latest changes
3. Run `npx vsce package` to create VSIX file
4. Install the new VSIX in VS Code
5. Test functionality to ensure it works correctly

### Testing Requirements
- All new functionality must have corresponding unit tests
- Tests must pass before any git commit
- Use `npm test` to run the full test suite
- Use `npm run compile` to check for TypeScript compilation errors

### Code Quality
- Follow TypeScript strict mode requirements
- Use ESLint for code style consistency
- Ensure proper error handling for all functions
- Document public APIs with JSDoc comments

## Project Structure
```
src/
├── extension.ts          # Main extension entry point with multi-table support
├── markdownParser.ts     # Markdown parsing with table extraction
├── tableDataManager.ts   # Table data management with index tracking
├── webviewManager.ts     # Webview panel management
├── fileHandler.ts        # File system operations with multi-table updates
└── test/
    ├── runTest.ts        # Test runner
    └── suite/
        ├── index.ts      # Test suite setup
        ├── markdownParser.test.ts     # Parser tests including multi-table
        ├── tableDataManager.test.ts   # Table management tests
        ├── fileHandler.test.ts        # File operations tests
        └── webviewManager.test.ts     # Webview tests
```

## Multi-Table Architecture

### Key Components

1. **TableDataManager**: Now includes `tableIndex` to track which table in a document is being edited
2. **FileHandler**: Enhanced with `updateTableByIndex()` for precise table updates
3. **Extension**: Updated to support table selection dialog for multiple tables
4. **Parser**: Robust handling of mixed content (tables, code blocks, lists, etc.)
5. **WebviewManager**: Enhanced with UI/UX improvements for better user experience

### UI/UX Enhancements

#### Status Bar and Messaging
- **Bottom Status Bar**: Error and save messages now appear at the bottom of the interface
- **Non-intrusive Feedback**: Status messages provide feedback without blocking the editing workflow
- **VSCode Theme Integration**: All messages use proper VSCode theme colors and styling

#### Simplified Interface
- **Toolbar Simplification**: Removed Save, Export, Delete Row, and Delete Column buttons from the top toolbar
- **Context Menu Focus**: All operations accessible through intuitive right-click context menus
- **Clean Workspace**: Minimized UI clutter for better focus on table content

#### Enhanced Editing Experience
- **Smart Focus Management**: Editing automatically commits when selecting another cell
- **Improved Input Handling**: Text input boxes properly handle clicks and prevent focus issues
- **Event Propagation Control**: Better handling of keyboard and mouse events during editing
- **Seamless Cell Navigation**: Enhanced keyboard navigation and cell selection behavior

### Error Handling
- Automatic backup creation before file modifications
- Comprehensive validation of table structure and file content
- Clear error messages with recovery options
- Graceful handling of malformed tables and mixed content
- Status bar error display for non-disruptive user experience

### Test Coverage
- Multi-table scenarios
- Mixed content documents (tables + code blocks + lists)
- Error conditions and edge cases
- File system operations with backup/recovery
- Table selection and indexing accuracy
- UI/UX enhancements and user interaction patterns (146+ tests total)

## Commands
- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch mode compilation
- `npm test` - Run all tests
- `npm run lint` - Run ESLint
- `npm run vscode:prepublish` - Prepare for publishing
- `npm run dev` - Start development server for browser testing
- `npm run dev:watch` - Start development server (alias for dev)
- `npx vsce package` - Create VSIX package (remember to increment version first!)

## Development Mode

### Browser-Based Development

For faster iteration on HTML, CSS, and JavaScript changes, use the development mode:

```bash
npm run dev
```

This starts a local server at `http://localhost:3000/dev/` that:

1. **Serves webview files directly** - No need to rebuild the extension
2. **Provides mock VSCode API** - Test table operations without VSCode
3. **Includes sample data** - Pre-loaded test tables for immediate testing
4. **Enables hot-refresh** - Simply refresh browser to see changes
5. **Simulates VSCode theming** - Accurate visual representation

### Development Server Features

#### Sample Data
- **Simple Table**: Basic 3x4 table for testing core functionality
- **Complex Table**: Feature table with 5 columns for testing advanced scenarios
- **Empty Table**: 3x3 empty table for testing empty state handling

#### Development Controls
- **Load Sample**: Switch between different test datasets
- **Clear**: Reset the table to test initialization
- **Debug State**: Inspect current TableEditor state in console

#### Mock VSCode API
The development environment includes a complete mock of the VSCode webview API:
- `postMessage()` handling for all table operations
- Automatic CSV download for export testing
- Console logging of all operations for debugging
- Sample file metadata simulation

### File Structure for Development
```
dev/
├── index.html              # Development page with mock VSCode API
└── start-dev-server.js     # HTTP server with cache-busting headers

webview/
├── style.css              # Main CSS (edit and refresh to see changes)
├── tableEditor.html       # Original webview template
└── js/                    # JavaScript modules (edit and refresh)
    ├── core.js
    ├── table-renderer.js
    ├── cell-editor.js
    └── ...
```

### Development Workflow

#### For UI/CSS Changes
1. Start dev server: `npm run dev`
2. Open `http://localhost:3000/dev/`
3. Edit files in `webview/style.css`
4. Refresh browser to see changes immediately

#### For JavaScript Changes
1. Start dev server: `npm run dev`
2. Open browser console for debugging
3. Edit files in `webview/js/`
4. Refresh browser and test functionality
5. Use "Debug State" button to inspect table state

#### For Testing Features
1. Use sample data dropdown to test different scenarios
2. Test all table operations (add/delete rows/columns, sorting, etc.)
3. Check console logs for operation details
4. Test CSV export functionality
5. Verify keyboard shortcuts and navigation

### Cache-Busting
The development server includes cache-busting headers to ensure:
- Files are never cached during development
- Changes are immediately visible on refresh
- No need to clear browser cache manually

### Debugging Tools
- **Browser DevTools**: Full access to inspect elements and debug JavaScript
- **Console Logging**: All table operations logged with emojis for easy identification
- **State Inspection**: Debug State button dumps current table state
- **Network Tab**: Monitor file loading and API calls
- **Performance Tab**: Profile table rendering and operations

This development mode eliminates the need to run `vsce package` during development, significantly speeding up the development cycle.