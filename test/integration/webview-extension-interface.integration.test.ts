import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewManager } from '../../src/webviewManager';
import { TableDataManager } from '../../src/tableDataManager';
import { MarkdownParser } from '../../src/markdownParser';

/**
 * Integration Tests for Webview-Extension Interface Communication Flow
 * 
 * These tests simulate the complete communication flow between webview and extension,
 * testing real-world scenarios and command execution chains.
 */
suite('Webview-Extension Interface Integration Tests', () => {
    let webviewManager: WebviewManager;
    let mockContext: vscode.ExtensionContext;
    let testUri: vscode.Uri;
    let commandExecutions: any[];

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

        testUri = vscode.Uri.file('/test/interface-test.md');
        webviewManager = WebviewManager.getInstance(mockContext);
    });

    setup(() => {
        commandExecutions = [];
        // Mock vscode.commands.executeCommand to track internal command calls
        const originalExecuteCommand = vscode.commands.executeCommand;
        (vscode.commands as any).executeCommand = async (command: string, ...args: any[]) => {
            commandExecutions.push({ command, args });
            return Promise.resolve();
        };
    });

    teardown(() => {
        // Restore original executeCommand if needed
        // Note: In real implementation, this would need proper cleanup
    });

    suiteTeardown(() => {
        if (webviewManager) {
            webviewManager.dispose();
        }
    });

    /**
     * Helper to create a mock webview panel that can simulate bidirectional communication
     */
    function createBidirectionalMockPanel() {
        let messageHandler: ((message: any) => void) | null = null;
        const sentMessages: any[] = [];

        return {
            panel: {
                webview: {
                    postMessage: (message: any) => {
                        sentMessages.push(message);
                        return Promise.resolve(true);
                    },
                    onDidReceiveMessage: (handler: (message: any) => void) => {
                        messageHandler = handler;
                        return { dispose: () => { messageHandler = null; } };
                    },
                    html: '',
                    options: {},
                    cspSource: 'test',
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
            } as unknown as vscode.WebviewPanel,
            
            // Helper methods for testing
            sendMessageToExtension: (message: any) => {
                if (messageHandler) {
                    messageHandler(message);
                }
            },
            getSentMessages: () => [...sentMessages],
            clearMessages: () => { sentMessages.length = 0; }
        };
    }

    suite('Request Table Data Flow Tests', () => {
        test('should handle requestTableData command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            // Simulate webview requesting table data
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'requestTableData'
            }, mockPanel.panel, testUri);

            // Verify that internal command was executed
            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.requestTableData', 
                'Should execute requestTableData command');
            
            const commandArgs = commandExecutions[0].args[0];
            assert.strictEqual(commandArgs.uri, testUri, 'Should pass correct URI');
            assert.strictEqual(commandArgs.panelId, testUri.toString(), 'Should pass correct panel ID');
        });

        test('should handle requestTableData with force refresh', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            // Register message handler
            const manager = webviewManager as any;
            mockPanel.panel.webview.onDidReceiveMessage((message: any) => 
                manager.handleMessage(message, mockPanel.panel, testUri)
            );

            // Simulate webview requesting table data with refresh
            await manager.handleMessage({
                command: 'requestTableData',
                data: { forceRefresh: true }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.requestTableData', 
                'Should execute requestTableData command');
        });
    });

    suite('Cell Update Flow Tests', () => {
        test('should handle updateCell command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'updateCell',
                data: {
                    row: 1,
                    col: 2,
                    value: 'Updated Cell Value'
                }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.updateCell', 
                'Should execute updateCell command');
            
            const commandArgs = commandExecutions[0].args[0];
            assert.strictEqual(commandArgs.uri, testUri, 'Should pass correct URI');
            assert.strictEqual(commandArgs.row, 1, 'Should pass correct row');
            assert.strictEqual(commandArgs.col, 2, 'Should pass correct column');
            assert.strictEqual(commandArgs.value, 'Updated Cell Value', 'Should pass correct value');
        });

        test('should reject invalid cell update data', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'updateCell',
                data: {
                    row: -1, // Invalid row
                    col: 2,
                    value: 'Value'
                }
            }, mockPanel.panel, testUri);

            // Should not execute command due to validation failure
            assert.strictEqual(commandExecutions.length, 0, 'Should not execute command for invalid data');
            
            // Should send error message
            const sentMessages = mockPanel.getSentMessages();
            const errorMessage = sentMessages.find(msg => msg.command === 'error');
            assert.ok(errorMessage, 'Should send error message');
            assert.ok(errorMessage.message.includes('Invalid message format'), 
                'Should indicate validation error');
        });
    });

    suite('Table Structure Modification Flow Tests', () => {
        test('should handle addRow command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'addRow',
                data: { index: 2 }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.addRow', 
                'Should execute addRow command');
            
            const commandArgs = commandExecutions[0].args[0];
            assert.strictEqual(commandArgs.index, 2, 'Should pass correct row index');
        });

        test('should handle deleteRow command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'deleteRow',
                data: { index: 1 }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.deleteRow', 
                'Should execute deleteRow command');
        });

        test('should handle addColumn command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'addColumn',
                data: { 
                    index: 1,
                    header: 'New Column' 
                }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.addColumn', 
                'Should execute addColumn command');
            
            const commandArgs = commandExecutions[0].args[0];
            assert.strictEqual(commandArgs.header, 'New Column', 'Should pass correct header');
        });

        test('should handle deleteColumn command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'deleteColumn',
                data: { index: 2 }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.deleteColumn', 
                'Should execute deleteColumn command');
        });
    });

    suite('Sorting and Moving Flow Tests', () => {
        test('should handle sort command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'sort',
                data: {
                    column: 1,
                    direction: 'desc'
                }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.sort', 
                'Should execute sort command');
            
            const commandArgs = commandExecutions[0].args[0];
            assert.strictEqual(commandArgs.column, 1, 'Should pass correct column');
            assert.strictEqual(commandArgs.direction, 'desc', 'Should pass correct direction');
        });

        test('should handle moveRow command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'moveRow',
                data: {
                    from: 1,
                    to: 3
                }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.moveRow', 
                'Should execute moveRow command');
            
            const commandArgs = commandExecutions[0].args[0];
            assert.strictEqual(commandArgs.from, 1, 'Should pass correct from index');
            assert.strictEqual(commandArgs.to, 3, 'Should pass correct to index');
        });

        test('should handle moveColumn command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'moveColumn',
                data: {
                    from: 0,
                    to: 2
                }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.moveColumn', 
                'Should execute moveColumn command');
        });
    });

    suite('Export and Advanced Operations Flow Tests', () => {
        test('should handle exportCSV command flow', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'exportCSV',
                data: {
                    csvContent: 'Name,Age,City\nJohn,25,NYC\nJane,30,LA',
                    filename: 'exported_table.csv'
                }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.exportCSV', 
                'Should execute exportCSV command');
            
            const commandArgs = commandExecutions[0].args[0];
            assert.strictEqual(commandArgs.filename, 'exported_table.csv', 'Should pass correct filename');
            assert.ok(commandArgs.csvContent.includes('Name,Age,City'), 'Should pass CSV content');
        });

        test('should handle exportCSV with encoding parameter', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'exportCSV',
                data: {
                    csvContent: 'Name,Age\nJohn,25',
                    filename: 'test.csv',
                    encoding: 'sjis'
                }
            }, mockPanel.panel, testUri);

            assert.strictEqual(commandExecutions.length, 1, 'Should execute one command');
            
            const commandArgs = commandExecutions[0].args[0];
            assert.strictEqual(commandArgs.encoding, 'sjis', 'Should pass encoding parameter');
        });
    });

    suite('Error Handling Integration Tests', () => {
        test('should handle command execution errors gracefully', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            // Mock command execution to throw error
            (vscode.commands as any).executeCommand = async (command: string, ...args: any[]) => {
                throw new Error('Command execution failed');
            };
            
            const manager = webviewManager as any;
            await manager.handleMessage({
                command: 'updateCell',
                data: {
                    row: 0,
                    col: 0,
                    value: 'test'
                }
            }, mockPanel.panel, testUri);

            // Should send error message to webview
            const sentMessages = mockPanel.getSentMessages();
            const errorMessage = sentMessages.find(msg => msg.command === 'error');
            assert.ok(errorMessage, 'Should send error message when command fails');
            assert.ok(errorMessage.message.includes('Error'), 'Should include error description');
        });

        test('should handle malformed message data', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            const manager = webviewManager as any;
            
            // Test with completely invalid message
            await manager.handleMessage(null, mockPanel.panel, testUri);
            
            // Test with missing required fields
            await manager.handleMessage({
                command: 'updateCell'
                // Missing data field
            }, mockPanel.panel, testUri);
            
            const sentMessages = mockPanel.getSentMessages();
            const errorMessages = sentMessages.filter(msg => msg.command === 'error');
            assert.ok(errorMessages.length > 0, 'Should send error messages for invalid data');
        });
    });

    suite('Connection Health Integration Tests', () => {
        test('should establish health tracking when processing messages', async () => {
            const mockPanel = createBidirectionalMockPanel();
            const manager = webviewManager as any;
            const panelId = testUri.toString();
            
            // Clear health tracking
            manager.connectionHealthMap.clear();
            
            // Process a message
            await manager.handleMessage({
                command: 'requestTableData'
            }, mockPanel.panel, testUri);
            
            // Verify health tracking was established
            const health = manager.connectionHealthMap.get(panelId);
            assert.ok(health, 'Should establish health tracking');
            assert.strictEqual(health.isHealthy, true, 'Should mark connection as healthy');
            assert.ok(health.lastActivity > 0, 'Should record activity timestamp');
        });

        test('should handle ping-pong health check cycle', async () => {
            const mockPanel = createBidirectionalMockPanel();
            const manager = webviewManager as any;
            
            let pingTimestamp = 0;
            
            // Override postMessage to capture ping and respond with pong
            mockPanel.panel.webview.postMessage = (message: any) => {
                if (message.command === 'ping') {
                    pingTimestamp = message.timestamp;
                    
                    // Simulate webview responding with pong
                    setTimeout(async () => {
                        await manager.handleMessage({
                            command: 'pong',
                            timestamp: pingTimestamp,
                            responseTime: Date.now()
                        }, mockPanel.panel, testUri);
                    }, 5);
                }
                return Promise.resolve(true);
            };
            
            // Trigger health check ping
            manager.pingWebview(mockPanel.panel, testUri.toString());
            
            // Wait for ping-pong cycle
            await new Promise(resolve => setTimeout(resolve, 20));
            
            // Verify health status
            const health = manager.connectionHealthMap.get(testUri.toString());
            assert.ok(health, 'Should have health record');
            assert.strictEqual(health.isHealthy, true, 'Should be healthy after pong');
        });
    });

    suite('Complex Workflow Integration Tests', () => {
        test('should handle sequential table operations', async () => {
            const mockPanel = createBidirectionalMockPanel();
            const manager = webviewManager as any;
            
            // Reset command tracking
            commandExecutions.length = 0;
            
            // Simulate a sequence of operations
            await manager.handleMessage({
                command: 'addRow',
                data: { index: 1 }
            }, mockPanel.panel, testUri);
            
            await manager.handleMessage({
                command: 'updateCell',
                data: { row: 1, col: 0, value: 'New Value' }
            }, mockPanel.panel, testUri);
            
            await manager.handleMessage({
                command: 'sort',
                data: { column: 0, direction: 'asc' }
            }, mockPanel.panel, testUri);
            
            // Verify all commands were executed in sequence
            assert.strictEqual(commandExecutions.length, 3, 'Should execute all three commands');
            assert.strictEqual(commandExecutions[0].command, 'markdownTableEditor.internal.addRow');
            assert.strictEqual(commandExecutions[1].command, 'markdownTableEditor.internal.updateCell');
            assert.strictEqual(commandExecutions[2].command, 'markdownTableEditor.internal.sort');
        });

        test('should handle mixed valid and invalid operations', async () => {
            const mockPanel = createBidirectionalMockPanel();
            const manager = webviewManager as any;
            
            commandExecutions.length = 0;
            
            // Valid operation
            await manager.handleMessage({
                command: 'addRow',
                data: { index: 1 }
            }, mockPanel.panel, testUri);
            
            // Invalid operation (negative index)
            await manager.handleMessage({
                command: 'updateCell',
                data: { row: -1, col: 0, value: 'Invalid' }
            }, mockPanel.panel, testUri);
            
            // Another valid operation
            await manager.handleMessage({
                command: 'deleteRow',
                data: { index: 2 }
            }, mockPanel.panel, testUri);
            
            // Should execute valid operations and reject invalid one
            assert.strictEqual(commandExecutions.length, 2, 'Should execute only valid commands');
            
            const sentMessages = mockPanel.getSentMessages();
            const errorMessages = sentMessages.filter(msg => msg.command === 'error');
            assert.strictEqual(errorMessages.length, 1, 'Should send one error message');
        });
    });

    suite('State Management Integration Tests', () => {
        test('should maintain panel state during operations', async () => {
            const mockPanel = createBidirectionalMockPanel();
            
            // Test that webview manager maintains state correctly
            assert.strictEqual(webviewManager.getPanelCount(), 0, 'Should start with no panels');
            
            // The panel management is tested through actual operations
            const uris = webviewManager.getActivePanelUris();
            assert.strictEqual(Array.isArray(uris), true, 'Should return array of URIs');
        });

        test('should handle cleanup on disposal', () => {
            const initialPanelCount = webviewManager.getPanelCount();
            
            // Test disposal
            webviewManager.dispose();
            
            // Verify cleanup
            assert.strictEqual(webviewManager.getPanelCount(), 0, 'Should clean up panels');
            
            // Re-initialize for other tests
            webviewManager = WebviewManager.getInstance(mockContext);
        });
    });
});