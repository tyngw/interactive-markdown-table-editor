# Import CSV Regression Prevention Tests

This document describes the test suite added to prevent regression of the Import CSV functionality issue that was discovered and fixed.

## Problem Background

The Import CSV menu item in the context menu was not working because the `importCSV` command was not properly integrated into the webview-extension communication protocol layer. Specifically:

- The command was missing from the `WebviewCommand` enum
- No validation logic existed for the command
- The `WebviewCommunicationManager` had no `importCSV` method
- The `useCommunication` hook didn't route the command

## Test Suite Overview

To prevent this type of regression, we've added comprehensive tests at multiple layers:

### 1. Protocol Completeness Tests
**File**: `src/test/suite/protocol-validators.test.ts`

**Purpose**: Ensures all protocol commands are properly registered in validators.

**Key Tests**:
- All `WebviewCommand` enum values are in `validCommands` array
- `importCSV` command is recognized as valid
- `importCSV` data validation works correctly
- All protocol commands have validation logic

**Why This Matters**: If a new command is added to the protocol but forgotten in validators, the test will fail immediately.

### 2. WebviewCommunicationManager Tests
**File**: `webview-react/src/__tests__/communication/WebviewCommunicationManager.test.ts`

**Purpose**: Verifies the communication manager implements all necessary methods.

**Key Tests**:
- `importCSV` method exists and is a function
- `importCSV` sends correct notification messages
- All required command methods are present
- Message structure is correct
- Integration with protocol types

**Why This Matters**: Ensures the communication manager properly implements every protocol command, preventing incomplete implementations.

### 3. Context Menu Integration Tests
**File**: `webview-react/src/__tests__/ContextMenu.importCSV.test.tsx`

**Purpose**: Tests the UI integration of Import CSV in the context menu.

**Key Tests**:
- Import CSV menu item renders in editor context menu
- Clicking Import CSV calls the correct callback
- Menu closes after import
- Import CSV doesn't appear in wrong menu types
- Handles missing callback gracefully

**Why This Matters**: Verifies the UI is properly wired to trigger the import functionality.

### 4. useCommunication Hook Tests
**File**: `webview-react/src/__tests__/hooks/useCommunication.test.ts`

**Purpose**: Ensures the hook properly routes all commands.

**Key Tests**:
- `importCSV` method is available in hook return value
- `sendMessage` routes `importCSV` correctly
- Switch statement has case for `importCSV`
- All WebviewCommand values have switch cases

**Why This Matters**: Catches missing switch cases or routing logic that would cause commands to be silently ignored.

## Running the Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Suites

#### Protocol Tests (Extension Side)
```bash
npm test -- --grep "Protocol and Validator"
```

#### Communication Manager Tests (Webview Side)
```bash
cd webview-react
npm test -- WebviewCommunicationManager.test.ts
```

#### Context Menu Tests
```bash
cd webview-react
npm test -- ContextMenu.importCSV.test.tsx
```

#### useCommunication Hook Tests
```bash
cd webview-react
npm test -- useCommunication.test.ts
```

## CI/CD Integration

These tests should be run as part of the CI/CD pipeline to catch regressions before they reach production:

```yaml
# Example GitHub Actions workflow
- name: Run Extension Tests
  run: npm test

- name: Run Webview Tests
  run: cd webview-react && npm test
```

## What These Tests Catch

1. **Missing Protocol Definitions**: If a command is added to one place but not another
2. **Incomplete Implementations**: If a method is declared but not implemented
3. **Routing Failures**: If a command doesn't have a switch case to route it
4. **UI Integration Issues**: If the UI doesn't properly call the communication layer
5. **Validation Gaps**: If new commands aren't added to validators

## Adding New Commands - Checklist

When adding a new command to the protocol, use this checklist to ensure completeness:

- [ ] Add to `WebviewCommand` enum in `src/communication/protocol.ts`
- [ ] Create data interface (e.g., `ImportCSVData`)
- [ ] Add to `WebviewCommandDataMap` type
- [ ] Add to `validCommands` array in `src/messages/validators.ts`
- [ ] Add validation case in `validateMessageData()`
- [ ] Add method to `WebviewCommunicationManager`
- [ ] Add switch case in `useCommunication` hook
- [ ] Add handler registration in `webviewManager.ts`
- [ ] **Run the tests** - they will tell you if you missed something!

## Test Maintenance

- Update tests when protocol changes are intentional
- Add new test cases for new command types
- Keep test data structures in sync with actual types
- Document any exceptions or special cases

## Future Improvements

Potential enhancements to the test suite:

1. **E2E Tests**: Add end-to-end tests that simulate the full import flow
2. **Type-Level Tests**: Use TypeScript's type system to enforce completeness at compile time
3. **Snapshot Tests**: Add snapshot tests for message structures
4. **Performance Tests**: Monitor communication latency
5. **Mock File Selection**: Test the full import dialog flow

## Related Documentation

- [Communication Protocol](../src/communication/protocol.ts)
- [Message Validators](../src/messages/validators.ts)
- [WebviewCommunicationManager](../webview-react/src/communication/WebviewCommunicationManager.ts)
- [Context Menu Component](../webview-react/src/components/ContextMenu.tsx)
