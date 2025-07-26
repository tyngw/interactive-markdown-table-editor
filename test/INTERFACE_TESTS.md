# Webview-Extension Interface Tests

This directory contains comprehensive tests for the interface communication between the webview and VS Code extension in the Markdown Table Editor.

## Overview

The interface tests verify the communication protocol, message validation, command handling, and error propagation between the webview frontend and the VS Code extension backend.

## Test Files

### 1. `webview-extension-interface.test.ts`
**Unit tests for the WebviewManager interface communication**

- **Message Validation Tests**: Validates message structure and data types
- **Extension to Webview Communication Tests**: Tests messages sent from extension to webview
- **Health Monitoring Interface Tests**: Tests ping-pong health check mechanism
- **Message Retry Logic Interface Tests**: Tests retry functionality for failed messages
- **Command Handling Interface Tests**: Tests error handling and validation
- **Panel Management Interface Tests**: Tests panel lifecycle management

### 2. `webview-extension-interface.integration.test.ts`
**Integration tests for complete communication workflows**

- **Request Table Data Flow Tests**: Tests table data request/response cycle
- **Cell Update Flow Tests**: Tests cell editing commands and validation
- **Table Structure Modification Flow Tests**: Tests row/column operations
- **Sorting and Moving Flow Tests**: Tests table manipulation commands
- **Export and Advanced Operations Flow Tests**: Tests CSV export functionality
- **Error Handling Integration Tests**: Tests error propagation and handling
- **Connection Health Integration Tests**: Tests health monitoring integration
- **Complex Workflow Integration Tests**: Tests sequential operations
- **State Management Integration Tests**: Tests state consistency

### 3. `webview-interface-mock.test.ts`
**Tests for the webview side using mock implementations**

- **Mock VSCode API Tests**: Tests the mock VSCode API functionality
- **Mock TableEditor Tests**: Tests the mock webview table editor
- **Interface Integration Mock Tests**: Tests complete workflows using mocks

## Mock Implementation

### `test/mock/webview-interface-mock.js`
Provides mock implementations for testing webview behavior:

- **MockVSCodeAPI**: Simulates VS Code's webview API
- **MockTableEditor**: Simulates the webview table editor interface

## Interface Commands

### Webview → Extension Commands
- `requestTableData`: Request table data from the markdown file
- `updateCell`: Update a specific cell value
- `addRow`: Add a new row to the table
- `deleteRow`: Delete a row from the table
- `addColumn`: Add a new column to the table
- `deleteColumn`: Delete a column from the table
- `sort`: Sort table by column
- `moveRow`: Move a row to a different position
- `moveColumn`: Move a column to a different position
- `exportCSV`: Export table as CSV file
- `pong`: Health check response

### Extension → Webview Commands
- `updateTableData`: Send updated table data to webview
- `error`: Send error message to webview
- `success`: Send success message to webview
- `status`: Send status update to webview
- `validationError`: Send validation error for specific field
- `ping`: Health check request

## Message Structure

### Command Message Format
```typescript
interface WebviewMessage {
    command: string;
    data?: any;
    timestamp?: number;
    responseTime?: number;
}
```

### Table Data Format
```typescript
interface TableData {
    id: string;
    headers: string[];
    rows: string[][];
    alignment: string[];
    metadata: {
        sourceUri: string;
        startLine: number;
        endLine: number;
        tableIndex: number;
        lastModified: Date;
        columnCount: number;
        rowCount: number;
        isValid: boolean;
        validationIssues: string[];
    };
}
```

## Test Coverage

The interface tests cover:

✅ **Message Validation**
- Command validation
- Data structure validation
- Type checking
- Required field validation

✅ **Command Execution**
- All supported commands
- Parameter passing
- Error handling
- Response handling

✅ **Communication Flow**
- Request-response cycles
- Asynchronous message handling
- Message ordering
- State synchronization

✅ **Error Handling**
- Validation errors
- Execution errors
- Network errors
- Recovery mechanisms

✅ **Health Monitoring**
- Ping-pong health checks
- Connection status tracking
- Failure detection
- Automatic recovery

✅ **Retry Logic**
- Message retry on failure
- Exponential backoff
- Retry limit handling
- Error propagation

## Running the Tests

### Run All Interface Tests
```bash
npm test
```

### Run Specific Test Suites
```bash
# Run unit tests
npm run test -- --grep "Webview-Extension Interface Tests"

# Run integration tests
npm run test:integration -- --grep "Webview-Extension Interface Integration Tests"

# Run mock tests
npm run test -- --grep "Webview Interface Mock Tests"
```

## Test Architecture

The tests use a layered approach:

1. **Unit Tests**: Test individual components and methods in isolation
2. **Integration Tests**: Test complete workflows and command execution
3. **Mock Tests**: Test webview behavior using controlled mock implementations

This ensures comprehensive coverage of the interface communication from both the extension and webview perspectives.

## Error Scenarios Tested

- Invalid message formats
- Missing required parameters
- Network communication failures
- Command execution errors
- Validation failures
- Health check failures
- State synchronization issues

## Health Monitoring

The interface includes health monitoring to ensure reliable communication:

- Periodic ping-pong health checks
- Connection status tracking
- Automatic failure detection
- Graceful error handling and recovery

## Future Enhancements

Potential areas for additional testing:

- Performance testing under load
- Concurrent operation testing
- Memory leak detection
- Browser compatibility testing
- Real-world scenario simulation

## Contributing

When adding new interface functionality:

1. Add appropriate message validation
2. Implement comprehensive error handling
3. Add corresponding tests in all three test files
4. Update this documentation
5. Ensure backward compatibility