import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewManager, WebviewMessage } from '../../webviewManager';

/**
 * CSV Export Interface Tests
 * 
 * This test suite validates the CSV export functionality interface,
 * focusing on the data flow between webview and extension that was
 * fixed in version 0.6.1.
 */
suite('CSV Export Interface Tests', () => {
    let webviewManager: WebviewManager;
    let mockPanel: vscode.WebviewPanel;
    let mockUri: vscode.Uri;

    setup(() => {
        // Reset singleton instance for testing
        (WebviewManager as any).instance = undefined;
        webviewManager = WebviewManager.getInstance();
        
        // Create mock panel
        mockPanel = {
            webview: {
                postMessage: () => Promise.resolve(true),
                html: '',
                options: {},
                cspSource: 'test',
                asWebviewUri: (uri: vscode.Uri) => uri,
                onDidReceiveMessage: () => ({ dispose: () => {} })
            },
            title: 'Test Panel',
            iconPath: undefined,
            viewType: 'markdownTableEditor',
            visible: true,
            active: true,
            viewColumn: vscode.ViewColumn.One,
            onDidDispose: () => ({ dispose: () => {} }),
            onDidChangeViewState: () => ({ dispose: () => {} }),
            reveal: () => {},
            dispose: () => {}
        } as any;

        mockUri = vscode.Uri.parse('file:///test.md');
    });

    suite('CSV Export Message Validation', () => {
        test('should validate complete CSV export message', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: 'Name,Age,City\nJohn,25,Tokyo\nJane,30,Osaka',
                    filename: 'export.csv',
                    encoding: 'utf8'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            assert.strictEqual(isValid, true, 'Complete CSV export message should pass validation');
        });

        test('should validate CSV export message with Shift_JIS encoding', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: 'Name,Age,City\nJohn,25,Tokyo\nJane,30,Osaka',
                    filename: 'export.csv',
                    encoding: 'sjis'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            assert.strictEqual(isValid, true, 'CSV export message with Shift_JIS encoding should pass validation');
        });

        test('should reject CSV export message with missing csvContent', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    filename: 'export.csv',
                    encoding: 'utf8'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            assert.strictEqual(isValid, false, 'CSV export message without csvContent should fail validation');
        });

        test('should reject CSV export message with empty csvContent', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: '',
                    filename: 'export.csv',
                    encoding: 'utf8'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            assert.strictEqual(isValid, false, 'CSV export message with empty csvContent should fail validation');
        });

        test('should reject CSV export message with undefined csvContent', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: undefined,
                    filename: 'export.csv',
                    encoding: 'utf8'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            assert.strictEqual(isValid, false, 'CSV export message with undefined csvContent should fail validation');
        });

        test('should handle CSV export message with missing filename', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: 'Name,Age\nJohn,25',
                    encoding: 'utf8'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            // Should still be valid - filename can be auto-generated
            assert.strictEqual(isValid, true, 'CSV export message without filename should still pass validation (auto-generated)');
        });

        test('should handle CSV export message with missing encoding', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: 'Name,Age\nJohn,25',
                    filename: 'export.csv'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            // Should be valid - encoding defaults to utf8
            assert.strictEqual(isValid, true, 'CSV export message without encoding should pass validation (defaults to utf8)');
        });
    });

    suite('CSV Export Data Structure Tests', () => {
        test('should handle complex CSV content with special characters', () => {
            const complexContent = 'Name,Description,Notes\n' +
                                 '"John, Jr.","""Smart"" person","Line 1\nLine 2"\n' +
                                 'Jane,"Simple text","Normal note"';
                                 
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: complexContent,
                    filename: 'complex.csv',
                    encoding: 'utf8'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            assert.strictEqual(isValid, true, 'CSV export with complex content should pass validation');
        });

        test('should handle CSV content with Japanese characters for Shift_JIS', () => {
            const japaneseContent = '名前,年齢,都市\n田中,25,東京\n佐藤,30,大阪';
                                 
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: japaneseContent,
                    filename: 'japanese.csv',
                    encoding: 'sjis'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            assert.strictEqual(isValid, true, 'CSV export with Japanese content for Shift_JIS should pass validation');
        });

        test('should handle large CSV content', () => {
            // Generate large CSV content
            let largeContent = 'ID,Name,Email,Phone\n';
            for (let i = 1; i <= 1000; i++) {
                largeContent += `${i},User${i},user${i}@example.com,+1-555-${String(i).padStart(4, '0')}\n`;
            }
                                 
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: largeContent,
                    filename: 'large.csv',
                    encoding: 'utf8'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            assert.strictEqual(isValid, true, 'CSV export with large content should pass validation');
        });
    });

    suite('CSV Export Command Execution Tests', () => {
        let commandExecuted = false;
        let commandData: any = null;

        setup(() => {
            commandExecuted = false;
            commandData = null;

            // Mock vscode.commands.executeCommand
            const originalExecuteCommand = vscode.commands.executeCommand;
            (vscode.commands as any).executeCommand = (command: string, ...args: any[]) => {
                if (command === 'markdownTableEditor.internal.exportCSV') {
                    commandExecuted = true;
                    commandData = args[0];
                    return Promise.resolve();
                }
                return originalExecuteCommand(command, ...args);
            };
        });

        test('should execute exportCSV command with correct data structure', async () => {
            const testData = {
                csvContent: 'Name,Age\nJohn,25\nJane,30',
                filename: 'test.csv',
                encoding: 'utf8'
            };

            await (webviewManager as any).handleExportCSV(testData, mockPanel, mockUri);

            assert.strictEqual(commandExecuted, true, 'exportCSV command should be executed');
            assert.ok(commandData, 'Command data should be provided');
            assert.strictEqual(commandData.uri, mockUri.toString(), 'URI should be passed correctly');
            assert.ok(commandData.data, 'Data object should exist');
            assert.strictEqual(commandData.data.csvContent, testData.csvContent, 'csvContent should be passed correctly');
            assert.strictEqual(commandData.data.filename, testData.filename, 'filename should be passed correctly');
            assert.strictEqual(commandData.data.encoding, testData.encoding, 'encoding should be passed correctly');
        });

        test('should execute exportCSV command with Shift_JIS encoding', async () => {
            const testData = {
                csvContent: '名前,年齢\n田中,25\n佐藤,30',
                filename: 'japanese.csv',
                encoding: 'sjis'
            };

            await (webviewManager as any).handleExportCSV(testData, mockPanel, mockUri);

            assert.strictEqual(commandExecuted, true, 'exportCSV command should be executed');
            assert.ok(commandData, 'Command data should be provided');
            assert.strictEqual(commandData.data.encoding, 'sjis', 'Shift_JIS encoding should be passed correctly');
        });

        test('should handle missing optional parameters gracefully', async () => {
            const testData = {
                csvContent: 'Name,Age\nJohn,25'
                // filename and encoding are missing
            };

            await (webviewManager as any).handleExportCSV(testData, mockPanel, mockUri);

            assert.strictEqual(commandExecuted, true, 'exportCSV command should be executed');
            assert.ok(commandData, 'Command data should be provided');
            assert.strictEqual(commandData.data.csvContent, testData.csvContent, 'csvContent should be passed correctly');
            // filename and encoding should be undefined, which is acceptable
            assert.strictEqual(commandData.data.filename, undefined, 'filename should be undefined when not provided');
            assert.strictEqual(commandData.data.encoding, undefined, 'encoding should be undefined when not provided');
        });
    });

    suite('Error Handling Tests', () => {
        test('should handle malformed message data gracefully', () => {
            const malformedMessage = {
                command: 'exportCSV',
                data: null // null data
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(malformedMessage);
            assert.strictEqual(isValid, false, 'Malformed CSV export message should fail validation');
        });

        test('should handle message without data property', () => {
            const messageWithoutData = {
                command: 'exportCSV'
                // no data property
            };
            
            const manager = webviewManager as any;
            const isValid = manager.validateMessage(messageWithoutData);
            assert.strictEqual(isValid, false, 'CSV export message without data should fail validation');
        });

        test('should handle invalid encoding values', () => {
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: 'Name,Age\nJohn,25',
                    filename: 'export.csv',
                    encoding: 'invalid-encoding'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            // Should still be valid - invalid encoding will be handled by the extension
            assert.strictEqual(isValid, true, 'CSV export with invalid encoding should pass validation (handled by extension)');
        });
    });

    suite('Regression Tests for Buffer.from Error', () => {
        test('should prevent undefined csvContent from reaching Buffer.from', () => {
            // This test specifically addresses the bug fixed in v0.6.1
            const message: WebviewMessage = {
                command: 'exportCSV',
                data: {
                    csvContent: undefined as any,
                    filename: 'test.csv',
                    encoding: 'utf8'
                }
            };
            
            const isValid = webviewManager.validateMessage(message);
            assert.strictEqual(isValid, false, 'Message with undefined csvContent should be rejected before reaching Buffer.from');
        });

        test('should ensure data structure consistency', () => {
            // Test the exact data structure that caused the original bug
            const testData = {
                csvContent: 'Name,Age\nJohn,25',
                filename: 'test.csv',
                encoding: 'utf8'
            };

            const manager = webviewManager as any;
            
            // Simulate the handleExportCSV call that would eventually reach the extension
            let commandData: any = null;
            const originalExecuteCommand = vscode.commands.executeCommand;
            (vscode.commands as any).executeCommand = (command: string, ...args: any[]) => {
                if (command === 'markdownTableEditor.internal.exportCSV') {
                    commandData = args[0];
                    return Promise.resolve();
                }
                return originalExecuteCommand(command, ...args);
            };

            return (webviewManager as any).handleExportCSV(testData, mockPanel, mockUri).then(() => {
                // Verify the data structure matches what the extension expects
                assert.ok(commandData, 'Command data should exist');
                assert.ok(commandData.data, 'Nested data object should exist');
                assert.strictEqual(typeof commandData.data.csvContent, 'string', 'csvContent should be a string');
                assert.notStrictEqual(commandData.data.csvContent, undefined, 'csvContent should not be undefined');
                assert.notStrictEqual(commandData.data.csvContent, '', 'csvContent should not be empty');
            });
        });
    });
});
