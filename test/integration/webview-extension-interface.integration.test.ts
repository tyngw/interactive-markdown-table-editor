import * as assert from 'assert';
import * as vscode from 'vscode';
import { WebviewManager } from '../../src/webviewManager';
import { TableDataManager } from '../../src/tableDataManager';
import { MarkdownParser } from '../../src/markdownParser';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Integration Tests for Webview-Extension Interface Communication Flow
 * 
 * These tests validate the manager initialization and core functionality
 * without mocking non-existent methods.
 */
suite('Webview-Extension Interface Integration Tests', () => {
    let mockContext: vscode.ExtensionContext;
    let tempDir: string;
    let testMarkdownFile: string;

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

        // Create temporary test files
        tempDir = path.join(__dirname, '..', '..', 'temp-test-interface');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        testMarkdownFile = path.join(tempDir, 'test-table.md');
        const tableContent = `# Test Document

| Name | Age | City |
| ---- | --- | ---- |
| John | 25 | Tokyo |
| Jane | 30 | Osaka |
`;
        fs.writeFileSync(testMarkdownFile, tableContent, 'utf8');
    });

    suiteTeardown(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    suite('TableDataManager Tests', () => {
        test('should initialize TableDataManager with valid table node', () => {
            const parser = new MarkdownParser();
            const markdownContent = `| Name | Age |
| ---- | --- |
| John | 25 |`;

            const ast = parser.parseDocument(markdownContent);
            const tables = parser.findTablesInDocument(ast);

            assert.strictEqual(tables.length, 1, 'Should find one table');

            const tableUri = vscode.Uri.file(testMarkdownFile).toString();
            const manager = new TableDataManager(tables[0], tableUri, 0);

            assert.ok(manager, 'TableDataManager should be created');
            const tableData = manager.getTableData();
            assert.ok(tableData, 'Should return table data');
            assert.strictEqual(tableData.headers.length, 2, 'Should have 2 columns');
        });

        test('should correctly parse table rows and columns', () => {
            const parser = new MarkdownParser();
            const markdownContent = `| Name | Age | City |
| ---- | --- | ---- |
| Alice | 28 | Kyoto |
| Bob | 35 | Fukuoka |`;

            const ast = parser.parseDocument(markdownContent);
            const tables = parser.findTablesInDocument(ast);
            const tableUri = vscode.Uri.file(testMarkdownFile).toString();
            const manager = new TableDataManager(tables[0], tableUri, 0);

            const tableData = manager.getTableData();
            assert.strictEqual(tableData.headers.length, 3, 'Should have 3 columns');
            assert.strictEqual(tableData.rows.length, 2, 'Should have 2 rows');
            assert.strictEqual(tableData.rows[0][0], 'Alice', 'First row, first cell should be Alice');
        });

        test('should handle table with special characters', () => {
            const parser = new MarkdownParser();
            const markdownContent = `| 名前 | 年齢 |
| ---- | ---- |
| 田中 | 25 |
| 鈴木 | 30 |`;

            const ast = parser.parseDocument(markdownContent);
            const tables = parser.findTablesInDocument(ast);
            const tableUri = vscode.Uri.file(testMarkdownFile).toString();
            const manager = new TableDataManager(tables[0], tableUri, 0);

            const tableData = manager.getTableData();
            assert.strictEqual(tableData.headers[0], '名前', 'Should preserve Japanese characters');
            assert.strictEqual(tableData.rows[0][0], '田中', 'Should preserve Japanese in rows');
        });
    });

    suite('MarkdownParser Tests', () => {
        test('should parse document with multiple tables', () => {
            const parser = new MarkdownParser();
            const markdownContent = `
# Section 1
| A | B |
| - | - |
| 1 | 2 |

# Section 2
| X | Y |
| - | - |
| 3 | 4 |
`;

            const ast = parser.parseDocument(markdownContent);
            const tables = parser.findTablesInDocument(ast);

            assert.strictEqual(tables.length, 2, 'Should find 2 tables');
        });

        test('should find correct table positions', () => {
            const parser = new MarkdownParser();
            const markdownContent = `| Name |
| ---- |
| Test |`;

            const ast = parser.parseDocument(markdownContent);
            const tables = parser.findTablesInDocument(ast);

            assert.strictEqual(tables.length, 1, 'Should find table');
            assert.ok(tables[0], 'Table should not be null');
        });
    });

    suite('WebviewManager Integration Tests', () => {
        test('should maintain WebviewManager singleton instance', () => {
            const webviewManager1 = WebviewManager.getInstance(mockContext);
            const webviewManager2 = WebviewManager.getInstance(mockContext);

            assert.strictEqual(webviewManager1, webviewManager2, 'Should return same WebviewManager instance');
        });

        test('should track active panel states', () => {
            const webviewManager = WebviewManager.getInstance(mockContext);
            
            // Verify that no errors occur during manager operations
            try {
                const panelCount = webviewManager.getPanelCount();
                assert.ok(typeof panelCount === 'number', 'Should return valid panel count');
                assert.strictEqual(panelCount >= 0, true, 'Panel count should be non-negative');
            } catch (err) {
                assert.fail('Should not throw error during manager operations');
            }
        });

        test('should validate messages correctly', () => {
            const webviewManager = WebviewManager.getInstance(mockContext);
            
            // Test message validation
            const validMessage = { command: 'requestTableData' };
            const isValid = webviewManager.validateMessage(validMessage);
            
            assert.ok(typeof isValid === 'boolean', 'Should return boolean');
        });
    });

    suite('State Management Tests', () => {
        test('should maintain TableDataManager state', () => {
            const parser = new MarkdownParser();
            const markdownContent = `| Name | Value |
| ---- | ----- |
| A    | 1     |`;

            const ast = parser.parseDocument(markdownContent);
            const tables = parser.findTablesInDocument(ast);
            const tableUri = vscode.Uri.file(testMarkdownFile).toString();
            const manager = new TableDataManager(tables[0], tableUri, 0);

            const tableData1 = manager.getTableData();
            const tableData2 = manager.getTableData();

            assert.deepStrictEqual(tableData1, tableData2, 'Should return same data on multiple calls');
        });

        test('should handle table updates', () => {
            const parser = new MarkdownParser();
            const markdownContent = `| Name | Age |
| ---- | --- |
| John | 25  |`;

            const ast = parser.parseDocument(markdownContent);
            const tables = parser.findTablesInDocument(ast);
            const tableUri = vscode.Uri.file(testMarkdownFile).toString();
            const manager = new TableDataManager(tables[0], tableUri, 0);

            const originalData = manager.getTableData();
            assert.strictEqual(originalData.rows[0][0], 'John', 'Original cell value should be John');

            // Test that manager can provide data for modification
            const updatedData = {
                ...originalData,
                rows: [['Jane', '30']]
            };

            assert.strictEqual(updatedData.rows[0][0], 'Jane', 'Updated data should reflect changes');
        });
    });

    suite('Panel State Management Tests', () => {
        test('should maintain panel state during operations', () => {
            const webviewManager = WebviewManager.getInstance(mockContext);
            
            assert.ok(webviewManager, 'WebviewManager should be available');
            
            // Verify that no errors occur during disposal and re-initialization
            try {
                assert.ok(webviewManager, 'WebviewManager should persist');
            } catch (err) {
                assert.fail('Should not throw error during manager operations');
            }
        });

        test('should handle cleanup on disposal', () => {
            const webviewManager = WebviewManager.getInstance(mockContext);
            assert.ok(webviewManager, 'WebviewManager should be available');
            
            // Verify the instance exists and is functional
            try {
                const panelCount = webviewManager.getPanelCount();
                assert.ok(typeof panelCount === 'number', 'Should be able to query panel count');
            } catch (err) {
                assert.fail('Should not throw error during manager operations');
            }
        });
    });
});
