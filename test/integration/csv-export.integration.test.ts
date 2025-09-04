import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WebviewManager } from '../../src/webviewManager';

/**
 * CSV Export Integration Tests
 * 
 * These tests validate the end-to-end CSV export functionality,
 * including file system operations and encoding handling.
 */
suite('CSV Export Integration Tests', () => {
    let webviewManager: WebviewManager;
    let testWorkspaceUri: vscode.Uri;
    let tempDir: string;

    suiteSetup(async () => {
        webviewManager = WebviewManager.getInstance();
        
        // Create temporary directory for test files
        tempDir = path.join(__dirname, '..', '..', 'temp-test-csv');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        testWorkspaceUri = vscode.Uri.file(tempDir);
    });

    suiteTeardown(() => {
        // Clean up temporary files
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    suite('CSV Export Command Integration', () => {
        test('should export CSV with UTF-8 encoding', async () => {
            const testData = {
                uri: vscode.Uri.file(path.join(tempDir, 'test.md')).toString(),
                panelId: 'test-panel',
                data: {
                    csvContent: 'Name,Age,City\nJohn,25,Tokyo\nJane,30,Osaka\nBob,35,Kyoto',
                    filename: 'test-export.csv',
                    encoding: 'utf8'
                }
            };

            // Mock file save dialog to return a specific path
            const exportPath = path.join(tempDir, 'exported-utf8.csv');
            const originalShowSaveDialog = vscode.window.showSaveDialog;
            vscode.window.showSaveDialog = () => Promise.resolve(vscode.Uri.file(exportPath));

            try {
                // Execute the export command
                await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', testData);

                // Verify file was created
                assert.ok(fs.existsSync(exportPath), 'CSV file should be created');

                // Verify file content
                const fileContent = fs.readFileSync(exportPath, 'utf8');
                assert.strictEqual(fileContent, testData.data.csvContent, 'File content should match exported data');

                // Verify UTF-8 encoding by checking Japanese characters are preserved
                const japaneseTestData = {
                    ...testData,
                    data: {
                        ...testData.data,
                        csvContent: '名前,年齢,都市\n田中,25,東京\n佐藤,30,大阪'
                    }
                };

                const japaneseExportPath = path.join(tempDir, 'japanese-utf8.csv');
                vscode.window.showSaveDialog = () => Promise.resolve(vscode.Uri.file(japaneseExportPath));

                await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', japaneseTestData);

                assert.ok(fs.existsSync(japaneseExportPath), 'Japanese CSV file should be created');
                const japaneseContent = fs.readFileSync(japaneseExportPath, 'utf8');
                assert.strictEqual(japaneseContent, japaneseTestData.data.csvContent, 'Japanese content should be preserved in UTF-8');

            } finally {
                vscode.window.showSaveDialog = originalShowSaveDialog;
            }
        });

        test('should export CSV with Shift_JIS encoding', async function() {
            // Skip this test if iconv-lite is not available
            let iconv: any;
            try {
                iconv = require('iconv-lite');
            } catch (error) {
                this.skip();
                return;
            }

            const testData = {
                uri: vscode.Uri.file(path.join(tempDir, 'test.md')).toString(),
                panelId: 'test-panel',
                data: {
                    csvContent: '名前,年齢,都市\n田中,25,東京\n佐藤,30,大阪',
                    filename: 'japanese-export.csv',
                    encoding: 'sjis'
                }
            };

            const exportPath = path.join(tempDir, 'exported-sjis.csv');
            const originalShowSaveDialog = vscode.window.showSaveDialog;
            vscode.window.showSaveDialog = () => Promise.resolve(vscode.Uri.file(exportPath));

            try {
                await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', testData);

                assert.ok(fs.existsSync(exportPath), 'CSV file should be created');

                // Verify Shift_JIS encoding
                const fileBuffer = fs.readFileSync(exportPath);
                const decodedContent = iconv.decode(fileBuffer, 'shift_jis');
                assert.strictEqual(decodedContent, testData.data.csvContent, 'Content should be correctly encoded in Shift_JIS');

            } finally {
                vscode.window.showSaveDialog = originalShowSaveDialog;
            }
        });

        test('should handle export cancellation gracefully', async () => {
            const testData = {
                uri: vscode.Uri.file(path.join(tempDir, 'test.md')).toString(),
                panelId: 'test-panel',
                data: {
                    csvContent: 'Name,Age\nJohn,25',
                    filename: 'cancelled-export.csv',
                    encoding: 'utf8'
                }
            };

            // Mock file save dialog to return undefined (cancelled)
            const originalShowSaveDialog = vscode.window.showSaveDialog;
            vscode.window.showSaveDialog = () => Promise.resolve(undefined);

            try {
                // This should not throw an error
                await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', testData);
                
                // No file should be created
                const expectedPath = path.join(tempDir, 'cancelled-export.csv');
                assert.ok(!fs.existsSync(expectedPath), 'No file should be created when export is cancelled');

            } finally {
                vscode.window.showSaveDialog = originalShowSaveDialog;
            }
        });

        test('should handle missing csvContent gracefully', async () => {
            const testData = {
                uri: vscode.Uri.file(path.join(tempDir, 'test.md')).toString(),
                panelId: 'test-panel',
                data: {
                    // csvContent is missing
                    filename: 'missing-content.csv',
                    encoding: 'utf8'
                }
            };

            // This should not throw an error and should exit early
            await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', testData);
            
            // No file should be created
            const expectedPath = path.join(tempDir, 'missing-content.csv');
            assert.ok(!fs.existsSync(expectedPath), 'No file should be created when csvContent is missing');
        });

        test('should handle undefined csvContent gracefully', async () => {
            const testData = {
                uri: vscode.Uri.file(path.join(tempDir, 'test.md')).toString(),
                panelId: 'test-panel',
                data: {
                    csvContent: undefined,
                    filename: 'undefined-content.csv',
                    encoding: 'utf8'
                }
            };

            // This should not throw an error and should exit early
            await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', testData);
            
            // No file should be created
            const expectedPath = path.join(tempDir, 'undefined-content.csv');
            assert.ok(!fs.existsSync(expectedPath), 'No file should be created when csvContent is undefined');
        });
    });

    suite('CSV Content Processing Tests', () => {
        test('should handle complex CSV content with special characters', async () => {
            const complexContent = 'Name,Description,Notes\n' +
                                 '"John, Jr.","A ""smart"" person","Line 1\nLine 2"\n' +
                                 'Jane,Simple text,Normal note\n' +
                                 '"Special chars: áéíóú","Unicode: 漢字","Mixed: abc123"';

            const testData = {
                uri: vscode.Uri.file(path.join(tempDir, 'test.md')).toString(),
                panelId: 'test-panel',
                data: {
                    csvContent: complexContent,
                    filename: 'complex-export.csv',
                    encoding: 'utf8'
                }
            };

            const exportPath = path.join(tempDir, 'complex-exported.csv');
            const originalShowSaveDialog = vscode.window.showSaveDialog;
            vscode.window.showSaveDialog = () => Promise.resolve(vscode.Uri.file(exportPath));

            try {
                await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', testData);

                assert.ok(fs.existsSync(exportPath), 'Complex CSV file should be created');

                const fileContent = fs.readFileSync(exportPath, 'utf8');
                assert.strictEqual(fileContent, complexContent, 'Complex content should be preserved exactly');

            } finally {
                vscode.window.showSaveDialog = originalShowSaveDialog;
            }
        });

        test('should handle large CSV content', async () => {
            // Generate large CSV content (1000 rows)
            let largeContent = 'ID,Name,Email,Phone,Address\n';
            for (let i = 1; i <= 1000; i++) {
                largeContent += `${i},User${i},user${i}@example.com,+1-555-${String(i).padStart(4, '0')},${i} Main St\n`;
            }

            const testData = {
                uri: vscode.Uri.file(path.join(tempDir, 'test.md')).toString(),
                panelId: 'test-panel',
                data: {
                    csvContent: largeContent,
                    filename: 'large-export.csv',
                    encoding: 'utf8'
                }
            };

            const exportPath = path.join(tempDir, 'large-exported.csv');
            const originalShowSaveDialog = vscode.window.showSaveDialog;
            vscode.window.showSaveDialog = () => Promise.resolve(vscode.Uri.file(exportPath));

            try {
                await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', testData);

                assert.ok(fs.existsSync(exportPath), 'Large CSV file should be created');

                const fileContent = fs.readFileSync(exportPath, 'utf8');
                assert.strictEqual(fileContent, largeContent, 'Large content should be preserved exactly');

                // Verify file size is reasonable (should be > 50KB for 1000 rows)
                const stats = fs.statSync(exportPath);
                assert.ok(stats.size > 50000, 'Large file should have appropriate size');

            } finally {
                vscode.window.showSaveDialog = originalShowSaveDialog;
            }
        });
    });

    suite('Error Recovery Tests', () => {
        test('should handle file system errors gracefully', async () => {
            const testData = {
                uri: vscode.Uri.file(path.join(tempDir, 'test.md')).toString(),
                panelId: 'test-panel',
                data: {
                    csvContent: 'Name,Age\nJohn,25',
                    filename: 'fs-error-test.csv',
                    encoding: 'utf8'
                }
            };

            // Try to write to an invalid path
            const invalidPath = '/invalid/path/that/does/not/exist/file.csv';
            const originalShowSaveDialog = vscode.window.showSaveDialog;
            vscode.window.showSaveDialog = () => Promise.resolve(vscode.Uri.file(invalidPath));

            try {
                // This should not throw an unhandled error
                await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', testData);
                
                // Should handle the error gracefully (file won't be created)
                assert.ok(!fs.existsSync(invalidPath), 'File should not be created at invalid path');

            } finally {
                vscode.window.showSaveDialog = originalShowSaveDialog;
            }
        });

        test('should handle encoding errors with fallback', async function() {
            // This test verifies that encoding errors fall back to UTF-8
            const testData = {
                uri: vscode.Uri.file(path.join(tempDir, 'test.md')).toString(),
                panelId: 'test-panel',
                data: {
                    csvContent: 'Name,Age\nJohn,25\nJane,30',
                    filename: 'encoding-fallback.csv',
                    encoding: 'sjis'
                }
            };

            const exportPath = path.join(tempDir, 'encoding-fallback.csv');
            const originalShowSaveDialog = vscode.window.showSaveDialog;
            vscode.window.showSaveDialog = () => Promise.resolve(vscode.Uri.file(exportPath));

            // Mock iconv-lite to throw an error
            const originalRequire = require;
            const mockRequire = (id: string) => {
                if (id === 'iconv-lite') {
                    throw new Error('iconv-lite not available');
                }
                return originalRequire(id);
            };

            try {
                // Replace require temporarily
                (global as any).require = mockRequire;

                await vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', testData);

                assert.ok(fs.existsSync(exportPath), 'CSV file should be created despite encoding error');

                // Should fall back to UTF-8
                const fileContent = fs.readFileSync(exportPath, 'utf8');
                assert.strictEqual(fileContent, testData.data.csvContent, 'Content should be preserved with UTF-8 fallback');

            } finally {
                (global as any).require = originalRequire;
                vscode.window.showSaveDialog = originalShowSaveDialog;
            }
        });
    });
});
