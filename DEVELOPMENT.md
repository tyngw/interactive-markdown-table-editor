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

### Error Handling
- Automatic backup creation before file modifications
- Comprehensive validation of table structure and file content
- Clear error messages with recovery options
- Graceful handling of malformed tables and mixed content

### Test Coverage
- Multi-table scenarios
- Mixed content documents (tables + code blocks + lists)
- Error conditions and edge cases
- File system operations with backup/recovery
- Table selection and indexing accuracy

## Commands
- `npm run compile` - Compile TypeScript
- `npm run watch` - Watch mode compilation
- `npm test` - Run all tests
- `npm run lint` - Run ESLint
- `npm run vscode:prepublish` - Prepare for publishing
- `npx vsce package` - Create VSIX package (remember to increment version first!)