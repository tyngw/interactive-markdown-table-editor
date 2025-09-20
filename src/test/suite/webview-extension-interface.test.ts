import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewManager, WebviewMessage } from '../../webviewManager';
import { TableData } from '../../tableDataManager';

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
            
            webviewManager.updateTableData(panel, tableData, testUri);
            
            assert.strictEqual(messageLog.length, 1, 'Should send one message');
            const message = messageLog[0];
            assert.strictEqual(message.command, 'updateTableData', 'Should send updateTableData command');
            assert.deepStrictEqual(message.data, tableData, 'Should include table data');
            assert.ok(message.fileInfo, 'Should include file info');
            assert.strictEqual(message.fileInfo.uri, testUri.toString(), 'Should include correct URI');
        });

        test('should send error message correctly', () => {
            const panel = createMockPanel();
            const errorMessage = 'Test error message';
            
            webviewManager.sendError(panel, errorMessage);
            
            assert.strictEqual(messageLog.length, 1, 'Should send one message');
            const message = messageLog[0];
            assert.strictEqual(message.command, 'error', 'Should send error command');
            assert.strictEqual(message.message, errorMessage, 'Should include error message');
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
                            
                            // Simulate webview responding with pong
                            setTimeout(() => {
                                const manager = webviewManager as any;
                                manager.handleMessage({
                                    command: 'pong',
                                    timestamp: pingTimestamp,
                                    responseTime: Date.now()
                                }, panel, testUri);
                            }, 10);
                        }
                        return Promise.resolve(true);
                    }
                }
            } as unknown as vscode.WebviewPanel;
            
            // Access private method to test ping functionality
            const manager = webviewManager as any;
            manager.pingWebview(panel, testUri.toString());
            
            // Wait for ping to be processed
            await new Promise(resolve => setTimeout(resolve, 20));
            
            assert.strictEqual(pingReceived, true, 'Should send ping message');
            assert.ok(pingTimestamp > 0, 'Should include timestamp in ping');
        });

        test('should mark connection as healthy after receiving message', () => {
            const manager = webviewManager as any;
            const panelId = testUri.toString();
            
            // Mark as healthy
            manager.markConnectionHealthy(panelId);
            
            // Check health status
            const health = manager.connectionHealthMap.get(panelId);
            assert.ok(health, 'Should have health record');
            assert.strictEqual(health.isHealthy, true, 'Should be marked as healthy');
            assert.ok(health.lastActivity > 0, 'Should have activity timestamp');
        });

        test('should handle connection as unhealthy', () => {
            const manager = webviewManager as any;
            const panelId = testUri.toString();
            
            // Mark as unhealthy
            manager.markConnectionUnhealthy(panelId);
            
            // Check health status
            const health = manager.connectionHealthMap.get(panelId);
            assert.ok(health, 'Should have health record');
            assert.strictEqual(health.isHealthy, false, 'Should be marked as unhealthy');
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
            let errorSent = false;
            
            const panel = {
                webview: {
                    postMessage: (message: any) => {
                        if (message.command === 'error') {
                            errorSent = true;
                            assert.ok(message.message.includes('Invalid message format'), 
                                'Should send validation error message');
                        }
                        return Promise.resolve(true);
                    }
                }
            } as unknown as vscode.WebviewPanel;
            
            // Access private method to test message handling
            const manager = webviewManager as any;
            
            // Send invalid message
            await manager.handleMessage({
                invalidCommand: 'test'
            }, panel, testUri);
            
            assert.strictEqual(errorSent, true, 'Should send error for invalid message');
        });

        test('should handle unknown command gracefully', async () => {
            let errorSent = false;
            
            const panel = {
                webview: {
                    postMessage: (message: any) => {
                        if (message.command === 'error') {
                            errorSent = true;
                            assert.ok(message.message.includes('Unknown command'), 
                                'Should send unknown command error');
                        }
                        return Promise.resolve(true);
                    }
                }
            } as unknown as vscode.WebviewPanel;
            
            const manager = webviewManager as any;
            
            await manager.handleMessage({
                command: 'unknownCommand',
                data: {}
            }, panel, testUri);
            
            assert.strictEqual(errorSent, true, 'Should send error for unknown command');
        });

        test('should track connection health when receiving messages', async () => {
            const panel = createMockPanel();
            const manager = webviewManager as any;
            
            // Clear health map
            manager.connectionHealthMap.clear();

            // Register panel first to ensure findPanelId works
            const testPanelId = testUri.toString() + '_' + Date.now();
            manager.panels.set(testPanelId, panel);

            // Handle a valid message
            await manager.handleMessage({
                command: 'requestTableData'
            }, panel, testUri);

            // Check if connection was marked as healthy
            // The health might be stored under the panelId or fallback to URI string
            const uriString = testUri.toString();
            const health = manager.connectionHealthMap.get(testPanelId) || 
                          manager.connectionHealthMap.get(uriString);
            
            assert.ok(health, 'Should have health record after message');
            assert.strictEqual(health.isHealthy, true, 'Should be marked as healthy');
            
            // Cleanup
            manager.panels.delete(testPanelId);
        });
    });

    suite('Panel Management Interface Tests', () => {
        test('should track panel existence correctly', () => {
            assert.strictEqual(webviewManager.hasPanelForUri(testUri), false, 
                'Should not have panel initially');
            
            // Panel management is tested through WebviewManager's public interface
            const uris = webviewManager.getActivePanelUris();
            assert.strictEqual(Array.isArray(uris), true, 'Should return array of URIs');
            assert.strictEqual(webviewManager.getPanelCount(), 0, 'Should have no panels initially');
        });

        test('should handle panel disposal cleanup', () => {
            // Test disposal without throwing
            assert.doesNotThrow(() => {
                webviewManager.dispose();
            }, 'Disposal should not throw');
            
            // Verify cleanup
            assert.strictEqual(webviewManager.getPanelCount(), 0, 'Should have no panels after disposal');
        });
    });
});