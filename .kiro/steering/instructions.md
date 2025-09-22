---
inclusion: always
---

# Development Guidelines

## Common Requirements
- Responses must be in Japanese and easy to understand

## Code Quality Principles
- Always explain the modification approach before making code changes
- Break complex problems into smaller, manageable steps
- Never make speculative fixes - identify root causes before implementing solutions
- When static analysis is insufficient, add logging to verify behavior before proceeding
- Avoid emojis in log messages and code comments

## Testing Requirements
All code changes must include corresponding tests:

### Test Structure
- **Unit tests**: Add to `src/test/` using Mocha framework for extension code
- **React tests**: Add to `webview-react/src/__tests__/` using Jest and React Testing Library
- **Integration tests**: Add to `src/test/suite/` or `test/integration/` for cross-component functionality

### Test Execution
1. Run `npm run compile` after changes
2. Execute `npm run test` for unit tests
3. Execute `npm run test:integration` for integration tests
4. All tests must pass before proceeding - fix any failures immediately

## Release Process
When making behavioral changes, follow this sequence:

1. **Test Validation**: Ensure all tests pass
2. **Test Coverage**: Add/update tests for new functionality
3. **Version Update**: Update `package.json` version following semantic versioning
4. **Changelog**: Update `CHANGELOG.md` with Japanese descriptions (newest entries at top)
5. **Package**: Run `vsce package` to generate `.vsix` file
6. **Install**: Uninstall existing extension and install new package for testing

### Versioning Rules
- **Patch** (x.x.x → x.x.x+1): Bug fixes
- **Minor** (x.x.x → x.x+1.0): New features, backward compatible
- **Major** (x.x.x → x+1.0.0): Breaking changes

Exception: For multi-step bug fixes, only increment version on the first fix.

## Architecture Patterns
- Use singleton managers for core functionality (WebviewManager, TableDataManager, UndoRedoManager)
- Implement message passing for extension-webview communication
- Follow React hooks pattern for complex logic encapsulation
- Maintain separation of concerns between components