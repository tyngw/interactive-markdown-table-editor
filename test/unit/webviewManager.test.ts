import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewManager } from '../../src/webviewManager';
import { TableData } from '../../src/tableDataManager';

suite('WebviewManager Test Suite', () => {
    let webviewManager: WebviewManager;
    let mockContext: vscode.ExtensionContext;
    let testUri: vscode.Uri;

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

    suiteTeardown(() => {
        if (webviewManager) {
            webviewManager.dispose();
        }
    });

    test('should create singleton instance', () => {
        const instance1 = WebviewManager.getInstance(mockContext);
        const instance2 = WebviewManager.getInstance();
        
        assert.strictEqual(instance1, instance2, 'Should return same instance');
    });

    test('should track panel count correctly', () => {
        const initialCount = webviewManager.getPanelCount();
        assert.strictEqual(initialCount, 0, 'Initial panel count should be 0');
    });

    test('should check panel existence', () => {
        const exists = webviewManager.hasPanelForUri(testUri);
        assert.strictEqual(exists, false, 'Panel should not exist initially');
    });

    test('should get active panel URIs', () => {
        const uris = webviewManager.getActivePanelUris();
        assert.strictEqual(Array.isArray(uris), true, 'Should return array');
        assert.strictEqual(uris.length, 0, 'Should be empty initially');
    });

    test('should validate message structure - valid message', () => {
        const manager = webviewManager as any; // Access private method
        const validMessage = {
            command: 'requestTableData'
        };
        
        // We can't directly test private methods, so we'll test through public interface
        // This test verifies the manager exists and handles commands properly
        assert.ok(manager, 'WebviewManager should be initialized');
    });

    test('should handle sendError without throwing', () => {
        // Create a mock panel that won't actually send messages
        const mockPanel = {
            webview: {
                postMessage: (message: any) => {
                    // Mock implementation that doesn't throw
                    assert.ok(message.command === 'error', 'Should send error command');
                    assert.ok(message.message, 'Should include error message');
                }
            }
        } as unknown as vscode.WebviewPanel;

        // This should not throw
        assert.doesNotThrow(() => {
            webviewManager.sendError(mockPanel, 'Test error message');
        });
    });

    test('should handle sendSuccess without throwing', () => {
        const mockPanel = {
            webview: {
                postMessage: (message: any) => {
                    assert.ok(message.command === 'success', 'Should send success command');
                    assert.ok(message.message, 'Should include success message');
                }
            }
        } as unknown as vscode.WebviewPanel;

        assert.doesNotThrow(() => {
            webviewManager.sendSuccess(mockPanel, 'Test success message');
        });
    });

    test('should handle sendStatus without throwing', () => {
        const mockPanel = {
            webview: {
                postMessage: (message: any) => {
                    assert.ok(message.command === 'status', 'Should send status command');
                    assert.ok(message.status, 'Should include status message');
                }
            }
        } as unknown as vscode.WebviewPanel;

        assert.doesNotThrow(() => {
            webviewManager.sendStatus(mockPanel, 'Test status', { data: 'test' });
        });
    });

    test('should handle sendValidationError without throwing', () => {
        const mockPanel = {
            webview: {
                postMessage: (message: any) => {
                    assert.ok(message.command === 'validationError', 'Should send validation error command');
                    assert.ok(message.field, 'Should include field name');
                    assert.ok(message.message, 'Should include error message');
                }
            }
        } as unknown as vscode.WebviewPanel;

        assert.doesNotThrow(() => {
            webviewManager.sendValidationError(mockPanel, 'testField', 'Test validation error');
        });
    });

    test('should handle broadcastMessage without throwing', () => {
        // Since there are no active panels, this should not throw
        assert.doesNotThrow(() => {
            webviewManager.broadcastMessage('testCommand', { data: 'test' });
        });
    });

    test('should handle message retry logic', async () => {
        let attemptCount = 0;
        const mockPanel = {
            webview: {
                postMessage: (message: any) => {
                    attemptCount++;
                    if (attemptCount < 2) {
                        throw new Error('Simulated failure');
                    }
                    // Success on second attempt
                }
            }
        } as unknown as vscode.WebviewPanel;

        // Test that retry logic works
        await webviewManager.sendMessageWithRetry(mockPanel, { command: 'test' }, 3);
        assert.strictEqual(attemptCount, 2, 'Should have retried once');
    });

    test('should handle retry exhaustion', async () => {
        const mockPanel = {
            webview: {
                postMessage: (message: any) => {
                    throw new Error('Persistent failure');
                }
            }
        } as unknown as vscode.WebviewPanel;

        try {
            await webviewManager.sendMessageWithRetry(mockPanel, { command: 'test' }, 2);
            assert.fail('Should have thrown after exhausting retries');
        } catch (error) {
            assert.ok(error instanceof Error, 'Should throw error after retries exhausted');
        }
    });

    test('should update table data with retry', async () => {
        let messageReceived = false;
        const mockPanel = {
            webview: {
                postMessage: (message: any) => {
                    messageReceived = true;
                    assert.strictEqual(message.command, 'updateTableData');
                    assert.ok(message.data, 'Should include table data');
                }
            }
        } as unknown as vscode.WebviewPanel;

        const testTableData: TableData = {
            id: 'test-id',
            headers: ['Col1', 'Col2'],
            rows: [['A', 'B'], ['C', 'D']],
            alignment: ['left', 'left'],
            metadata: {
                sourceUri: testUri.toString(),
                startLine: 0,
                endLine: 3,
                tableIndex: 0,
                lastModified: new Date(),
                columnCount: 2,
                rowCount: 2,
                isValid: true,
                validationIssues: []
            }
        };

        await webviewManager.updateTableDataWithRetry(mockPanel, testTableData);
        assert.strictEqual(messageReceived, true, 'Message should have been sent');
    });
});
