/**
 * Mock Webview Interface for Testing
 * 
 * This file provides utilities for testing the webview side of the interface
 * communication. It simulates webview behavior for integration testing.
 */

/**
 * Mock VSCode API for testing webview interface
 */
class MockVSCodeAPI {
    constructor() {
        this.messageHandlers = [];
        this.sentMessages = [];
        this.state = {};
    }

    /**
     * Mock postMessage to extension
     */
    postMessage(message) {
        this.sentMessages.push({
            ...message,
            timestamp: Date.now()
        });
        
        // Simulate async response from extension
        setTimeout(() => {
            this.simulateExtensionResponse(message);
        }, 10);
    }

    /**
     * Mock setState functionality
     */
    setState(state) {
        this.state = { ...this.state, ...state };
    }

    /**
     * Mock getState functionality
     */
    getState() {
        return { ...this.state };
    }

    /**
     * Register message handler
     */
    onMessage(handler) {
        this.messageHandlers.push(handler);
    }

    /**
     * Simulate receiving message from extension
     */
    receiveMessage(message) {
        this.messageHandlers.forEach(handler => {
            try {
                handler(message);
            } catch (error) {
                console.error('Error in message handler:', error);
            }
        });
    }

    /**
     * Simulate extension responses to webview messages
     */
    simulateExtensionResponse(originalMessage) {
        switch (originalMessage.command) {
            case 'requestTableData':
                this.receiveMessage({
                    command: 'updateTableData',
                    data: this.createMockTableData(),
                    fileInfo: {
                        uri: 'file:///test/sample.md',
                        fileName: 'sample.md',
                        fileNameWithoutExt: 'sample'
                    }
                });
                break;

            case 'updateCell':
                this.receiveMessage({
                    command: 'success',
                    message: 'Cell updated successfully'
                });
                break;

            case 'addRow':
                this.receiveMessage({
                    command: 'updateTableData',
                    data: this.createMockTableDataWithExtraRow()
                });
                this.receiveMessage({
                    command: 'success',
                    message: 'Row added successfully'
                });
                break;

            case 'deleteRow':
                this.receiveMessage({
                    command: 'updateTableData',
                    data: this.createMockTableDataWithFewerRows()
                });
                this.receiveMessage({
                    command: 'success',
                    message: 'Row deleted successfully'
                });
                break;

            case 'addColumn':
                this.receiveMessage({
                    command: 'updateTableData',
                    data: this.createMockTableDataWithExtraColumn()
                });
                this.receiveMessage({
                    command: 'success',
                    message: 'Column added successfully'
                });
                break;

            case 'deleteColumn':
                this.receiveMessage({
                    command: 'updateTableData',
                    data: this.createMockTableDataWithFewerColumns()
                });
                this.receiveMessage({
                    command: 'success',
                    message: 'Column deleted successfully'
                });
                break;

            case 'sort':
                this.receiveMessage({
                    command: 'updateTableData',
                    data: this.createMockSortedTableData(originalMessage.data.direction)
                });
                this.receiveMessage({
                    command: 'success',
                    message: `Table sorted by column ${originalMessage.data.column} (${originalMessage.data.direction})`
                });
                break;

            case 'moveRow':
                this.receiveMessage({
                    command: 'updateTableData',
                    data: this.createMockTableDataWithMovedRow()
                });
                this.receiveMessage({
                    command: 'success',
                    message: `Row moved from ${originalMessage.data.from} to ${originalMessage.data.to}`
                });
                break;

            case 'moveColumn':
                this.receiveMessage({
                    command: 'updateTableData',
                    data: this.createMockTableDataWithMovedColumn()
                });
                this.receiveMessage({
                    command: 'success',
                    message: `Column moved from ${originalMessage.data.from} to ${originalMessage.data.to}`
                });
                break;

            case 'exportCSV':
                this.receiveMessage({
                    command: 'success',
                    message: `CSV exported successfully to ${originalMessage.data.filename}`
                });
                break;

            case 'pong':
                // Extension typically doesn't respond to pong
                break;

            default:
                this.receiveMessage({
                    command: 'error',
                    message: `Unknown command: ${originalMessage.command}`
                });
        }
    }

    /**
     * Create mock table data for testing
     */
    createMockTableData() {
        return {
            id: 'mock-table',
            headers: ['Name', 'Age', 'City'],
            rows: [
                ['John', '25', 'NYC'],
                ['Jane', '30', 'LA'],
                ['Bob', '35', 'Chicago']
            ],
            alignment: ['left', 'center', 'right'],
            metadata: {
                sourceUri: 'file:///test/sample.md',
                startLine: 5,
                endLine: 9,
                tableIndex: 0,
                lastModified: new Date().toISOString(),
                columnCount: 3,
                rowCount: 3,
                isValid: true,
                validationIssues: []
            }
        };
    }

    createMockTableDataWithExtraRow() {
        const data = this.createMockTableData();
        data.rows.push(['Alice', '28', 'Boston']);
        data.metadata.rowCount = 4;
        data.metadata.endLine = 10;
        return data;
    }

    createMockTableDataWithFewerRows() {
        const data = this.createMockTableData();
        data.rows.pop();
        data.metadata.rowCount = 2;
        data.metadata.endLine = 8;
        return data;
    }

    createMockTableDataWithExtraColumn() {
        const data = this.createMockTableData();
        data.headers.push('Country');
        data.rows.forEach(row => row.push('USA'));
        data.alignment.push('left');
        data.metadata.columnCount = 4;
        return data;
    }

    createMockTableDataWithFewerColumns() {
        const data = this.createMockTableData();
        data.headers.pop();
        data.rows.forEach(row => row.pop());
        data.alignment.pop();
        data.metadata.columnCount = 2;
        return data;
    }

    createMockSortedTableData(direction) {
        const data = this.createMockTableData();
        data.rows.sort((a, b) => {
            const comparison = a[0].localeCompare(b[0]);
            return direction === 'desc' ? -comparison : comparison;
        });
        return data;
    }

    createMockTableDataWithMovedRow() {
        const data = this.createMockTableData();
        const row = data.rows.splice(0, 1)[0];
        data.rows.push(row);
        return data;
    }

    createMockTableDataWithMovedColumn() {
        const data = this.createMockTableData();
        const header = data.headers.splice(0, 1)[0];
        data.headers.push(header);
        const alignment = data.alignment.splice(0, 1)[0];
        data.alignment.push(alignment);
        data.rows.forEach(row => {
            const cell = row.splice(0, 1)[0];
            row.push(cell);
        });
        return data;
    }

    /**
     * Get all sent messages for testing
     */
    getSentMessages() {
        return [...this.sentMessages];
    }

    /**
     * Clear sent messages
     */
    clearMessages() {
        this.sentMessages = [];
    }

    /**
     * Simulate extension sending ping
     */
    simulatePing() {
        this.receiveMessage({
            command: 'ping',
            timestamp: Date.now()
        });
    }

    /**
     * Simulate extension sending error
     */
    simulateError(message) {
        this.receiveMessage({
            command: 'error',
            message: message
        });
    }

    /**
     * Simulate extension sending validation error
     */
    simulateValidationError(field, message) {
        this.receiveMessage({
            command: 'validationError',
            field: field,
            message: message
        });
    }
}

/**
 * Mock TableEditor namespace for testing webview interface
 */
class MockTableEditor {
    constructor() {
        this.vscode = new MockVSCodeAPI();
        this.state = {
            tableData: null,
            currentEditingCell: null,
            sortState: { 
                column: -1, 
                direction: 'none',
                isViewOnly: false,
                originalData: null
            },
            columnWidths: {},
            displayData: null,
            originalData: null,
            fileInfo: null,
            selectedCells: new Set(),
            selectionStart: null,
            isSelecting: false,
            lastSelectedCell: null,
            isComposing: false,
            allTables: [],
            currentTableIndex: 0,
            isResizing: false,
            resizeColumn: -1,
            startX: 0,
            startWidth: 0,
            dragState: {
                isDragging: false,
                dragType: null,
                dragIndex: -1,
                dropIndex: -1
            },
            contextMenuState: {
                visible: false,
                type: null,
                index: -1
            }
        };

        this.messageHandlers = {};
        this.setupMessageHandlers();
    }

    /**
     * Setup message handlers for testing
     */
    setupMessageHandlers() {
        this.vscode.onMessage((message) => {
            const handler = this.messageHandlers[message.command];
            if (handler) {
                handler(message);
            } else {
                console.warn('No handler for command:', message.command);
            }
        });

        // Register default handlers
        this.messageHandlers.updateTableData = (message) => {
            this.state.tableData = message.data;
            this.state.fileInfo = message.fileInfo;
            this.updateDisplay();
        };

        this.messageHandlers.error = (message) => {
            this.showError(message.message);
        };

        this.messageHandlers.success = (message) => {
            this.showSuccess(message.message);
        };

        this.messageHandlers.status = (message) => {
            this.showStatus(message.status, message.data);
        };

        this.messageHandlers.validationError = (message) => {
            this.showValidationError(message.field, message.message);
        };

        this.messageHandlers.ping = (message) => {
            // Respond to ping with pong
            this.vscode.postMessage({
                command: 'pong',
                timestamp: message.timestamp,
                responseTime: Date.now()
            });
        };
    }

    /**
     * Mock interface methods for testing
     */
    requestTableData() {
        this.vscode.postMessage({
            command: 'requestTableData'
        });
    }

    updateCell(row, col, value) {
        this.vscode.postMessage({
            command: 'updateCell',
            data: { row, col, value }
        });
    }

    addRow(index) {
        this.vscode.postMessage({
            command: 'addRow',
            data: { index }
        });
    }

    deleteRow(index) {
        this.vscode.postMessage({
            command: 'deleteRow',
            data: { index }
        });
    }

    addColumn(index, header) {
        this.vscode.postMessage({
            command: 'addColumn',
            data: { index, header }
        });
    }

    deleteColumn(index) {
        this.vscode.postMessage({
            command: 'deleteColumn',
            data: { index }
        });
    }

    sortTable(column, direction) {
        this.vscode.postMessage({
            command: 'sort',
            data: { column, direction }
        });
    }

    moveRow(from, to) {
        this.vscode.postMessage({
            command: 'moveRow',
            data: { from, to }
        });
    }

    moveColumn(from, to) {
        this.vscode.postMessage({
            command: 'moveColumn',
            data: { from, to }
        });
    }

    exportCSV(csvContent, filename, encoding = 'utf8') {
        this.vscode.postMessage({
            command: 'exportCSV',
            data: { csvContent, filename, encoding }
        });
    }

    /**
     * Mock UI methods for testing
     */
    updateDisplay() {
        // Mock display update
        console.log('Display updated with table data:', this.state.tableData?.headers);
    }

    showError(message) {
        console.error('Webview Error:', message);
    }

    showSuccess(message) {
        console.log('Webview Success:', message);
    }

    showStatus(status, data) {
        console.log('Webview Status:', status, data);
    }

    showValidationError(field, message) {
        console.warn('Validation Error in field', field, ':', message);
    }

    /**
     * Test helper methods
     */
    getSentMessages() {
        return this.vscode.getSentMessages();
    }

    clearMessages() {
        this.vscode.clearMessages();
    }

    simulateExtensionMessage(message) {
        this.vscode.receiveMessage(message);
    }

    getState() {
        return { ...this.state };
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
    }
}

// Export for use in tests
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        MockVSCodeAPI,
        MockTableEditor
    };
}

// Make available globally for browser-based tests
if (typeof window !== 'undefined') {
    window.MockVSCodeAPI = MockVSCodeAPI;
    window.MockTableEditor = MockTableEditor;
}