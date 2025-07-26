import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Webview Interface Mock Tests
 * 
 * These tests verify the webview side of the interface using the mock implementation.
 * They test the webview's ability to send commands and handle responses correctly.
 */
suite('Webview Interface Mock Tests', () => {
    let MockVSCodeAPI: any;
    let MockTableEditor: any;

    suiteSetup(() => {
        // Load the mock module
        const mockPath = path.join(__dirname, '../../mock/webview-interface-mock.js');
        const mockContent = fs.readFileSync(mockPath, 'utf8');
        
        // Evaluate the mock module in a controlled environment
        const moduleExports = {};
        const module = { exports: moduleExports };
        const func = new Function('module', 'exports', 'console', mockContent);
        func(module, moduleExports, console);
        
        MockVSCodeAPI = (module.exports as any).MockVSCodeAPI;
        MockTableEditor = (module.exports as any).MockTableEditor;
        
        assert.ok(MockVSCodeAPI, 'MockVSCodeAPI should be loaded');
        assert.ok(MockTableEditor, 'MockTableEditor should be loaded');
    });

    suite('Mock VSCode API Tests', () => {
        let mockAPI: any;

        setup(() => {
            mockAPI = new MockVSCodeAPI();
        });

        test('should initialize with empty state', () => {
            assert.strictEqual(mockAPI.messageHandlers.length, 0, 'Should start with no handlers');
            assert.strictEqual(mockAPI.sentMessages.length, 0, 'Should start with no sent messages');
            assert.deepStrictEqual(mockAPI.state, {}, 'Should start with empty state');
        });

        test('should track sent messages', () => {
            const testMessage = { command: 'test', data: 'hello' };
            mockAPI.postMessage(testMessage);
            
            assert.strictEqual(mockAPI.sentMessages.length, 1, 'Should track sent message');
            assert.strictEqual(mockAPI.sentMessages[0].command, 'test', 'Should preserve command');
            assert.strictEqual(mockAPI.sentMessages[0].data, 'hello', 'Should preserve data');
            assert.ok(mockAPI.sentMessages[0].timestamp, 'Should add timestamp');
        });

        test('should handle state management', () => {
            const testState = { tableData: { id: 'test' }, editing: true };
            mockAPI.setState(testState);
            
            const state = mockAPI.getState();
            assert.deepStrictEqual(state, testState, 'Should store and retrieve state');
            
            // Test state merging
            mockAPI.setState({ newField: 'value' });
            const updatedState = mockAPI.getState();
            assert.strictEqual(updatedState.editing, true, 'Should preserve existing state');
            assert.strictEqual(updatedState.newField, 'value', 'Should add new field');
        });

        test('should register and trigger message handlers', () => {
            let receivedMessage = null;
            
            mockAPI.onMessage((message: any) => {
                receivedMessage = message;
            });
            
            const testMessage = { command: 'updateTableData', data: { test: true } };
            mockAPI.receiveMessage(testMessage);
            
            assert.deepStrictEqual(receivedMessage, testMessage, 'Should trigger handler with message');
        });

        test('should simulate extension responses', (done) => {
            let responseReceived = false;
            
            mockAPI.onMessage((message: any) => {
                if (message.command === 'updateTableData') {
                    responseReceived = true;
                    assert.ok(message.data, 'Should include table data in response');
                    assert.ok(message.fileInfo, 'Should include file info in response');
                    done();
                }
            });
            
            // Trigger response simulation
            mockAPI.postMessage({ command: 'requestTableData' });
            
            // Verify response will be sent asynchronously
            assert.strictEqual(responseReceived, false, 'Response should be async');
        });

        test('should create mock table data with correct structure', () => {
            const tableData = mockAPI.createMockTableData();
            
            assert.ok(tableData.id, 'Should have table ID');
            assert.ok(Array.isArray(tableData.headers), 'Should have headers array');
            assert.ok(Array.isArray(tableData.rows), 'Should have rows array');
            assert.ok(Array.isArray(tableData.alignment), 'Should have alignment array');
            assert.ok(tableData.metadata, 'Should have metadata');
            
            assert.strictEqual(tableData.headers.length, tableData.alignment.length, 
                'Headers and alignment should match');
            assert.strictEqual(tableData.metadata.columnCount, tableData.headers.length, 
                'Metadata column count should match headers');
            assert.strictEqual(tableData.metadata.rowCount, tableData.rows.length, 
                'Metadata row count should match rows');
        });

        test('should simulate error responses', () => {
            let errorReceived = false;
            
            mockAPI.onMessage((message: any) => {
                if (message.command === 'error') {
                    errorReceived = true;
                    assert.ok(message.message.includes('Unknown command'), 
                        'Should include error description');
                }
            });
            
            mockAPI.postMessage({ command: 'invalidCommand' });
            
            // Allow async processing
            setTimeout(() => {
                assert.strictEqual(errorReceived, true, 'Should receive error for invalid command');
            }, 20);
        });
    });

    suite('Mock TableEditor Tests', () => {
        let mockEditor: any;

        setup(() => {
            mockEditor = new MockTableEditor();
        });

        test('should initialize with correct state structure', () => {
            const state = mockEditor.getState();
            
            assert.ok(state.hasOwnProperty('tableData'), 'Should have tableData in state');
            assert.ok(state.hasOwnProperty('sortState'), 'Should have sortState in state');
            assert.ok(state.hasOwnProperty('selectedCells'), 'Should have selectedCells in state');
            assert.ok(state.hasOwnProperty('dragState'), 'Should have dragState in state');
            assert.ok(state.hasOwnProperty('contextMenuState'), 'Should have contextMenuState in state');
        });

        test('should send requestTableData message', () => {
            mockEditor.requestTableData();
            
            const messages = mockEditor.getSentMessages();
            assert.strictEqual(messages.length, 1, 'Should send one message');
            assert.strictEqual(messages[0].command, 'requestTableData', 'Should send correct command');
        });

        test('should send updateCell message with correct data', () => {
            mockEditor.updateCell(1, 2, 'New Value');
            
            const messages = mockEditor.getSentMessages();
            assert.strictEqual(messages.length, 1, 'Should send one message');
            assert.strictEqual(messages[0].command, 'updateCell', 'Should send updateCell command');
            assert.deepStrictEqual(messages[0].data, {
                row: 1,
                col: 2,
                value: 'New Value'
            }, 'Should send correct cell data');
        });

        test('should send table structure modification messages', () => {
            mockEditor.clearMessages();
            
            mockEditor.addRow(2);
            mockEditor.deleteRow(1);
            mockEditor.addColumn(1, 'New Column');
            mockEditor.deleteColumn(0);
            
            const messages = mockEditor.getSentMessages();
            assert.strictEqual(messages.length, 4, 'Should send four messages');
            
            assert.strictEqual(messages[0].command, 'addRow');
            assert.strictEqual(messages[1].command, 'deleteRow');
            assert.strictEqual(messages[2].command, 'addColumn');
            assert.strictEqual(messages[3].command, 'deleteColumn');
            
            assert.strictEqual(messages[2].data.header, 'New Column', 'Should include header in addColumn');
        });

        test('should send sorting and moving messages', () => {
            mockEditor.clearMessages();
            
            mockEditor.sortTable(1, 'desc');
            mockEditor.moveRow(0, 2);
            mockEditor.moveColumn(1, 0);
            
            const messages = mockEditor.getSentMessages();
            assert.strictEqual(messages.length, 3, 'Should send three messages');
            
            assert.strictEqual(messages[0].command, 'sort');
            assert.strictEqual(messages[1].command, 'moveRow');
            assert.strictEqual(messages[2].command, 'moveColumn');
            
            assert.strictEqual(messages[0].data.direction, 'desc', 'Should include sort direction');
        });

        test('should send exportCSV message with encoding', () => {
            const csvContent = 'Name,Age\nJohn,25\nJane,30';
            const filename = 'export.csv';
            const encoding = 'sjis';
            
            mockEditor.exportCSV(csvContent, filename, encoding);
            
            const messages = mockEditor.getSentMessages();
            assert.strictEqual(messages.length, 1, 'Should send one message');
            assert.strictEqual(messages[0].command, 'exportCSV');
            assert.strictEqual(messages[0].data.csvContent, csvContent);
            assert.strictEqual(messages[0].data.filename, filename);
            assert.strictEqual(messages[0].data.encoding, encoding);
        });

        test('should handle incoming updateTableData message', (done) => {
            // Override updateDisplay to verify it was called
            let displayUpdated = false;
            mockEditor.updateDisplay = () => {
                displayUpdated = true;
            };
            
            const testTableData = {
                id: 'test-table',
                headers: ['A', 'B'],
                rows: [['1', '2']],
                alignment: ['left', 'right'],
                metadata: {
                    sourceUri: 'file:///test.md',
                    tableIndex: 0,
                    columnCount: 2,
                    rowCount: 1
                }
            };
            
            const testFileInfo = {
                uri: 'file:///test.md',
                fileName: 'test.md'
            };
            
            mockEditor.simulateExtensionMessage({
                command: 'updateTableData',
                data: testTableData,
                fileInfo: testFileInfo
            });
            
            setTimeout(() => {
                const state = mockEditor.getState();
                assert.deepStrictEqual(state.tableData, testTableData, 'Should update table data in state');
                assert.deepStrictEqual(state.fileInfo, testFileInfo, 'Should update file info in state');
                assert.strictEqual(displayUpdated, true, 'Should trigger display update');
                done();
            }, 5);
        });

        test('should handle ping-pong health check', () => {
            mockEditor.clearMessages();
            
            mockEditor.simulateExtensionMessage({
                command: 'ping',
                timestamp: Date.now()
            });
            
            const messages = mockEditor.getSentMessages();
            assert.strictEqual(messages.length, 1, 'Should send pong response');
            assert.strictEqual(messages[0].command, 'pong', 'Should send pong command');
            assert.ok(messages[0].timestamp, 'Should include original timestamp');
            assert.ok(messages[0].responseTime, 'Should include response time');
        });

        test('should handle error messages', () => {
            let errorHandled = false;
            const originalShowError = mockEditor.showError;
            mockEditor.showError = (message: string) => {
                errorHandled = true;
                assert.strictEqual(message, 'Test error message', 'Should pass error message');
            };
            
            mockEditor.simulateExtensionMessage({
                command: 'error',
                message: 'Test error message'
            });
            
            assert.strictEqual(errorHandled, true, 'Should handle error message');
            
            // Restore original method
            mockEditor.showError = originalShowError;
        });

        test('should handle validation errors', () => {
            let validationErrorHandled = false;
            const originalShowValidationError = mockEditor.showValidationError;
            mockEditor.showValidationError = (field: string, message: string) => {
                validationErrorHandled = true;
                assert.strictEqual(field, 'columnName', 'Should pass field name');
                assert.strictEqual(message, 'Invalid column name', 'Should pass validation message');
            };
            
            mockEditor.simulateExtensionMessage({
                command: 'validationError',
                field: 'columnName',
                message: 'Invalid column name'
            });
            
            assert.strictEqual(validationErrorHandled, true, 'Should handle validation error');
            
            // Restore original method
            mockEditor.showValidationError = originalShowValidationError;
        });

        test('should maintain state correctly during operations', () => {
            const initialState = mockEditor.getState();
            
            // Modify state
            mockEditor.setState({
                currentEditingCell: { row: 1, col: 2 },
                selectedCells: new Set(['cell-1-2'])
            });
            
            const updatedState = mockEditor.getState();
            assert.notDeepStrictEqual(updatedState, initialState, 'State should be updated');
            assert.deepStrictEqual(updatedState.currentEditingCell, { row: 1, col: 2 }, 
                'Should update specific state fields');
            
            // Verify other fields are preserved
            assert.deepStrictEqual(updatedState.sortState, initialState.sortState, 
                'Should preserve unchanged state fields');
        });
    });

    suite('Interface Integration Mock Tests', () => {
        let mockEditor: any;

        setup(() => {
            mockEditor = new MockTableEditor();
        });

        test('should complete full requestTableData workflow', (done) => {
            let updateReceived = false;
            
            // Override updateDisplay to capture the response
            mockEditor.updateDisplay = () => {
                updateReceived = true;
                const state = mockEditor.getState();
                assert.ok(state.tableData, 'Should receive table data');
                assert.ok(state.fileInfo, 'Should receive file info');
                done();
            };
            
            mockEditor.requestTableData();
            
            // Verify message was sent
            const messages = mockEditor.getSentMessages();
            assert.strictEqual(messages.length, 1, 'Should send requestTableData message');
            
            // The mock will automatically simulate a response
            setTimeout(() => {
                if (!updateReceived) {
                    done(new Error('Did not receive table data response'));
                }
            }, 50);
        });

        test('should complete full updateCell workflow', (done) => {
            let successReceived = false;
            
            const originalShowSuccess = mockEditor.showSuccess;
            mockEditor.showSuccess = (message: string) => {
                successReceived = true;
                assert.ok(message.includes('updated successfully'), 'Should show success message');
                done();
            };
            
            mockEditor.updateCell(0, 1, 'Updated Value');
            
            // Verify message was sent
            const messages = mockEditor.getSentMessages();
            assert.strictEqual(messages.length, 1, 'Should send updateCell message');
            
            setTimeout(() => {
                if (!successReceived) {
                    mockEditor.showSuccess = originalShowSuccess;
                    done(new Error('Did not receive success response'));
                }
            }, 50);
        });

        test('should handle table modification workflow', (done) => {
            let responseCount = 0;
            let successCount = 0;
            
            const originalUpdateDisplay = mockEditor.updateDisplay;
            const originalShowSuccess = mockEditor.showSuccess;
            
            mockEditor.updateDisplay = () => {
                responseCount++;
            };
            
            mockEditor.showSuccess = (message: string) => {
                successCount++;
                
                // Check if we've received both expected responses
                if (responseCount >= 1 && successCount >= 1) {
                    mockEditor.updateDisplay = originalUpdateDisplay;
                    mockEditor.showSuccess = originalShowSuccess;
                    done();
                }
            };
            
            mockEditor.addRow(1);
            
            setTimeout(() => {
                if (responseCount === 0 || successCount === 0) {
                    mockEditor.updateDisplay = originalUpdateDisplay;
                    mockEditor.showSuccess = originalShowSuccess;
                    done(new Error('Did not receive expected responses'));
                }
            }, 50);
        });

        test('should handle multiple operations in sequence', () => {
            mockEditor.clearMessages();
            
            // Perform multiple operations
            mockEditor.updateCell(0, 0, 'A');
            mockEditor.addRow(1);
            mockEditor.sortTable(0, 'asc');
            mockEditor.exportCSV('A\nB', 'test.csv');
            
            const messages = mockEditor.getSentMessages();
            assert.strictEqual(messages.length, 4, 'Should send all messages');
            
            const commands = messages.map((msg: any) => msg.command);
            assert.deepStrictEqual(commands, ['updateCell', 'addRow', 'sort', 'exportCSV'], 
                'Should send commands in correct order');
        });
    });
});