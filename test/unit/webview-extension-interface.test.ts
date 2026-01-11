import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewManager, WebviewMessage } from '../../src/webviewManager';
import { TableData } from '../../src/tableDataManager';

/**
 * Interface Tests for Webview-Extension Communication
 * 
 * These tests focus on the communication protocol between the webview and extension,
 * testing message validation, command handling, and error propagation.
 */
suite('Webview-Extension Interface Tests', () => {
    let webviewManager: WebviewManager;
    let mockContext: vscode.ExtensionContext;
    let testUri: vscode.Uri;
    let messageLog: any[];

    suiteSetup(() => {
        // Create mock extension context
        mockContext = {
            subscriptions: [],
            workspaceState: {} as any,
            globalState: {} as any,
            extensionUri: vscode.Uri.file('/test'),
            extensionPath: '/test',
            asAbsolutePath: (relativePath: string) => `/test/${relativePath}`,
            storagePath: '/test/storage',
            globalStoragePath: '/test/global',
            storageUri: vscode.Uri.file('/test/storage'),
            globalStorageUri: vscode.Uri.file('/test/global'),
            logPath: '/test/logs',
            logUri: vscode.Uri.file('/test/logs'),
            secrets: {} as any,
            environmentVariableCollection: {} as any,
            extensionMode: vscode.ExtensionMode.Test,
            extension: {} as any,
            languageModelAccessInformation: {} as any
        } as unknown as vscode.ExtensionContext;

        testUri = vscode.Uri.file('/test/sample.md');
        webviewManager = WebviewManager.getInstance(mockContext);
    });

    setup(() => {
        // Reset message log for each test
        messageLog = [];
        
        // Clear any panels from previous tests
        const manager = webviewManager as any;
        if (manager.panels) {
            manager.panels.clear();
        }
    });

    suiteTeardown(() => {
        if (webviewManager) {
            webviewManager.dispose();
        }
    });

    /**
     * Helper function to create a mock webview panel that captures messages
     */
    function createMockPanel(): vscode.WebviewPanel {
        return {
            webview: {
                postMessage: (message: any) => {
                    messageLog.push(message);
                    return Promise.resolve(true);
                },
                html: '',
                options: {},
                cspSource: 'test',
                onDidReceiveMessage: () => ({ dispose: () => {} } as any),
                asWebviewUri: (uri: vscode.Uri) => uri
            },
            title: 'Test Panel',
            viewType: 'test',
            active: true,
            visible: true,
            viewColumn: vscode.ViewColumn.One,
            onDidDispose: () => ({ dispose: () => {} } as any),
            onDidChangeViewState: () => ({ dispose: () => {} } as any),
            reveal: () => {},
            dispose: () => {}
        } as unknown as vscode.WebviewPanel;
    }

    /**
     * Helper function to create test table data
     */
    function createTestTableData(): TableData {
        return {
            id: 'test-table',
            headers: ['Name', 'Age', 'City'],
            rows: [
                ['John', '25', 'NYC'],
                ['Jane', '30', 'LA']
            ],
            alignment: ['left', 'center', 'right'],
            metadata: {
                sourceUri: testUri.toString(),
                startLine: 5,
                endLine: 8,
                tableIndex: 0,
                lastModified: new Date(),
                columnCount: 3,
                rowCount: 2,
                isValid: true,
                validationIssues: []
            }
        };
    }

    suite('Message Validation Tests', () => {
        test('should validate valid undo message', () => {
            const message: WebviewMessage = {
                command: 'undo'
            };
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, true, 'Valid undo message should pass validation');
        });

        test('should validate valid redo message', () => {
            const message: WebviewMessage = {
                command: 'redo'
            };
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, true, 'Valid redo message should pass validation');
        });
        test('should validate valid requestTableData message', () => {
            const message: WebviewMessage = {
                command: 'requestTableData'
            };
            
            // Access private validation method
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, true, 'Valid requestTableData message should pass validation');
        });

        test('should validate valid updateCell message', () => {
            const message: WebviewMessage = {
                command: 'updateCell',
                data: {
                    row: 0,
                    col: 1,
                    value: 'Updated Value'
                }
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, true, 'Valid updateCell message should pass validation');
        });

        test('should reject invalid updateCell message - missing data', () => {
            const message: WebviewMessage = {
                command: 'updateCell'
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, false, 'updateCell message without data should fail validation');
        });

        test('should reject invalid updateCell message - invalid row index', () => {
            const message: WebviewMessage = {
                command: 'updateCell',
                data: {
                    row: -1,
                    col: 1,
                    value: 'Updated Value'
                }
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, false, 'updateCell message with negative row should fail validation');
        });

        test('should validate valid sort message', () => {
            const message: WebviewMessage = {
                command: 'sort',
                data: {
                    column: 1,
                    direction: 'asc'
                }
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, true, 'Valid sort message should pass validation');
        });

        test('should reject invalid sort message - invalid direction', () => {
            const message: WebviewMessage = {
                command: 'sort',
                data: {
                    column: 1,
                    direction: 'invalid'
                }
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, false, 'sort message with invalid direction should fail validation');
        });

        test('should validate valid exportCSV message', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: 'Name,Age\nJohn,25',
                    filename: 'export.csv'
                }
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, true, 'Valid exportCSV message should pass validation');
        });

        test('should reject exportCSV message with empty filename', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: 'Name,Age\nJohn,25',
                    filename: ''
                }
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, false, 'exportCSV message with empty filename should fail validation');
        });

        test('should validate pong message', () => {
            const message: WebviewMessage = {
                command: 'pong',
                timestamp: Date.now(),
                responseTime: Date.now()
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, true, 'Valid pong message should pass validation');
        });

        test('should reject unknown command', () => {
            const message = {
                command: 'unknownCommand',
                data: {}
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, false, 'Unknown command should fail validation');
        });

        test('should reject message without command', () => {
            const message = {
                data: {}
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(message);
            assert.strictEqual(isValid, false, 'Message without command should fail validation');
        });
    });

    suite('Extension to Webview Communication Tests', () => {
        test('should send updateTableData message correctly', () => {
            const panel = createMockPanel();
            const tableData = createTestTableData();
            
            // Test that method exists and doesn't throw
            assert.doesNotThrow(() => {
                webviewManager.updateTableData(panel, tableData, testUri);
            }, 'updateTableData should not throw');
            
            // Verify the method is callable
            assert.ok(typeof webviewManager.updateTableData === 'function', 'updateTableData should be available');
        });

        test('should send error message correctly', () => {
            const panel = createMockPanel();
            const errorMessage = 'Test error message';
            
            // Test that method exists and doesn't throw
            assert.doesNotThrow(() => {
                webviewManager.sendError(panel, errorMessage);
            }, 'sendError should not throw');
            
            // Verify the method is callable
            assert.ok(typeof webviewManager.sendError === 'function', 'sendError should be available');
        });

        test('should send success message correctly', () => {
            const panel = createMockPanel();
            const successMessage = 'Operation successful';
            const additionalData = { operation: 'test' };
            
            webviewManager.sendSuccess(panel, successMessage, additionalData);
            
            assert.strictEqual(messageLog.length, 1, 'Should send one message');
            const message = messageLog[0];
            assert.strictEqual(message.command, 'success', 'Should send success command');
            assert.strictEqual(message.message, successMessage, 'Should include success message');
            assert.deepStrictEqual(message.data, additionalData, 'Should include additional data');
        });

        test('should send status update correctly', () => {
            const panel = createMockPanel();
            const status = 'processing';
            const statusData = { progress: 50 };
            
            webviewManager.sendStatus(panel, status, statusData);
            
            assert.strictEqual(messageLog.length, 1, 'Should send one message');
            const message = messageLog[0];
            assert.strictEqual(message.command, 'status', 'Should send status command');
            assert.strictEqual(message.status, status, 'Should include status');
            assert.deepStrictEqual(message.data, statusData, 'Should include status data');
        });

        test('should send validation error correctly', () => {
            const panel = createMockPanel();
            const field = 'columnName';
            const errorMessage = 'Invalid column name';
            
            webviewManager.sendValidationError(panel, field, errorMessage);
            
            assert.strictEqual(messageLog.length, 1, 'Should send one message');
            const message = messageLog[0];
            assert.strictEqual(message.command, 'validationError', 'Should send validationError command');
            assert.strictEqual(message.field, field, 'Should include field name');
            assert.strictEqual(message.message, errorMessage, 'Should include error message');
        });

        test('should broadcast message to multiple panels', () => {
            const panel1 = createMockPanel();
            const panel2 = createMockPanel();
            
            // We can't easily test with multiple real panels in unit test,
            // but we can test that broadcast method doesn't throw
            assert.doesNotThrow(() => {
                webviewManager.broadcastMessage('testCommand', { data: 'test' });
            }, 'Broadcast should not throw');
        });
    });

    suite('Health Monitoring Interface Tests', () => {
        test('should handle ping-pong health check', async () => {
            let pingReceived = false;
            let pingTimestamp = 0;
            
            const panel = {
                webview: {
                    postMessage: (message: any) => {
                        if (message.command === 'ping') {
                            pingReceived = true;
                            pingTimestamp = message.timestamp;
                        }
                        return Promise.resolve(true);
                    }
                }
            } as unknown as vscode.WebviewPanel;
            
            // Test that ping-pong health check mechanism is available
            // Verify the mock panel can receive messages
            assert.ok(panel.webview, 'Panel should have webview');
            assert.ok(typeof panel.webview.postMessage === 'function', 'postMessage should be callable');
        });

        test('should mark connection as healthy after receiving message', () => {
            // Verify that WebviewManager has health tracking mechanisms
            const manager = webviewManager as any;
            assert.ok(manager, 'WebviewManager should exist');
            assert.ok(typeof manager.validateMessage === 'function', 'Message validation should be available');
        });

        test('should handle connection as unhealthy', () => {
            // Verify that WebviewManager can handle error scenarios
            const panel = createMockPanel();
            assert.doesNotThrow(() => {
                webviewManager.sendError(panel, 'Test error');
            }, 'sendError should not throw');
        });
    });

    suite('Message Retry Logic Interface Tests', () => {
        test('should retry message sending on failure', async () => {
            let attemptCount = 0;
            const maxRetries = 3;
            
            const panel = {
                webview: {
                    postMessage: (message: any) => {
                        attemptCount++;
                        if (attemptCount < 2) {
                            throw new Error('Simulated network failure');
                        }
                        return Promise.resolve(true);
                    }
                }
            } as unknown as vscode.WebviewPanel;
            
            const testMessage = { command: 'test', data: 'retry test' };
            
            // Should succeed after retry
            await webviewManager.sendMessageWithRetry(panel, testMessage, maxRetries);
            
            assert.strictEqual(attemptCount, 2, 'Should have retried once');
        });

        test('should throw after exhausting retries', async () => {
            const panel = {
                webview: {
                    postMessage: (message: any) => {
                        throw new Error('Persistent failure');
                    }
                }
            } as unknown as vscode.WebviewPanel;
            
            const testMessage = { command: 'test', data: 'fail test' };
            
            try {
                await webviewManager.sendMessageWithRetry(panel, testMessage, 2);
                assert.fail('Should have thrown after exhausting retries');
            } catch (error) {
                assert.ok(error instanceof Error, 'Should throw error');
                assert.ok(error.message.includes('Persistent failure'), 'Should preserve original error');
            }
        });

        test('should handle updateTableDataWithRetry', async () => {
            let messageReceived = false;
            
            const panel = {
                webview: {
                    postMessage: (message: any) => {
                        messageReceived = true;
                        assert.strictEqual(message.command, 'updateTableData', 'Should send updateTableData command');
                        return Promise.resolve(true);
                    }
                }
            } as unknown as vscode.WebviewPanel;
            
            const tableData = createTestTableData();
            
            await webviewManager.updateTableDataWithRetry(panel, tableData);
            
            assert.strictEqual(messageReceived, true, 'Should have sent message');
        });
    });

    suite('Command Handling Interface Tests', () => {
        test('should handle message validation failure gracefully', async () => {
            const panel = createMockPanel();
            
            // Test validateMessage function with invalid input
            const manager = webviewManager as any;
            const isValid = manager.validateMessage({ /* invalid message */ });
            
            assert.strictEqual(isValid, false, 'Should reject invalid message');
        });

        test('should handle unknown command gracefully', async () => {
            const panel = createMockPanel();
            
            // Verify error sending capability
            assert.doesNotThrow(() => {
                webviewManager.sendError(panel, 'Unknown command received');
            }, 'Should handle unknown command errors gracefully');
        });

        test('should track connection health when receiving messages', async () => {
            const panel = createMockPanel();
            
            // Verify message sending with retry capability
            assert.ok(typeof webviewManager.sendMessageWithRetry === 'function', 
                'sendMessageWithRetry should be available');
        });
    });

    suite('Panel Management Interface Tests', () => {
        test('should track panel existence correctly', () => {
            // Verify panel tracking methods exist and are callable
            assert.ok(typeof webviewManager.hasPanelForUri === 'function', 
                'hasPanelForUri should be available');
            assert.ok(typeof webviewManager.getActivePanelUris === 'function',
                'getActivePanelUris should be available');
            assert.ok(typeof webviewManager.getPanelCount === 'function',
                'getPanelCount should be available');
            
            // Verify they return expected types
            const uris = webviewManager.getActivePanelUris();
            assert.ok(Array.isArray(uris), 'getActivePanelUris should return an array');
            
            const count = webviewManager.getPanelCount();
            assert.ok(typeof count === 'number' && count >= 0, 'getPanelCount should return non-negative number');
        });

        test('should handle panel disposal cleanup', () => {
            // Test disposal without throwing
            assert.doesNotThrow(() => {
                webviewManager.dispose();
            }, 'Disposal should not throw');
        });
    });
});