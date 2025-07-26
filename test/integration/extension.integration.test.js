"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const markdownParser_1 = require("../../src/markdownParser");
const fileHandler_1 = require("../../src/fileHandler");
const webviewManager_1 = require("../../src/webviewManager");
suite('Extension Integration Tests', () => {
    let testDir;
    let testFilePath;
    suiteSetup(() => {
        // Create temporary test directory
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-table-editor-test-'));
        testFilePath = path.join(testDir, 'test.md');
    });
    suiteTeardown(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });
    test('Extension should activate correctly', async () => {
        // Check if extension is activated
        const extension = vscode.extensions.getExtension('tyngw.markdown-table-editor');
        assert.ok(extension, 'Extension should be found');
        await extension.activate();
        assert.ok(extension.isActive, 'Extension should be active');
    });
    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);
        assert.ok(commands.includes('markdownTableEditor.editTable'), 'editTable command should be registered');
        assert.ok(commands.includes('markdownTableEditor.createTable'), 'createTable command should be registered');
    });
    test('File system integration should work end-to-end', async () => {
        const testContent = `# Test Document

This is a test document with a table:

| Name | Age | City |
|------|-----|------|
| John | 25  | NYC  |
| Jane | 30  | LA   |

Some text after the table.`;
        // Write test file
        fs.writeFileSync(testFilePath, testContent);
        // Read and parse file
        const fileHandler = (0, fileHandler_1.getFileHandler)();
        const content = await fileHandler.readMarkdownFile(vscode.Uri.file(testFilePath));
        assert.strictEqual(content, testContent);
        // Parse and find tables
        const parser = new markdownParser_1.MarkdownParser();
        const ast = parser.parseDocument(content);
        const tables = parser.findTablesInDocument(ast);
        assert.strictEqual(tables.length, 1);
        assert.strictEqual(tables[0].headers.length, 3);
        assert.strictEqual(tables[0].rows.length, 2);
        // Modify table and write back
        const modifiedContent = content.replace('John', 'Johnny');
        await fileHandler.writeMarkdownFile(vscode.Uri.file(testFilePath), modifiedContent);
        // Verify modification
        const readContent = await fileHandler.readMarkdownFile(vscode.Uri.file(testFilePath));
        assert.ok(readContent.includes('Johnny'));
        assert.ok(!readContent.includes('John |'));
    });
    test('Webview manager should initialize correctly', () => {
        // Create a mock context for WebviewManager
        const mockContext = {
            extensionPath: '/test',
            subscriptions: []
        };
        const webviewManager = webviewManager_1.WebviewManager.getInstance(mockContext);
        assert.ok(webviewManager, 'WebviewManager should be created');
        // Test singleton behavior
        const webviewManager2 = webviewManager_1.WebviewManager.getInstance();
        assert.strictEqual(webviewManager, webviewManager2, 'Should return same instance');
    });
    test('Parser and file handler integration', async () => {
        const complexMarkdown = `# Complex Document

First table:
| Product | Price | Stock |
|---------|-------|-------|
| Apple   | $1.50 | 100   |
| Orange  | $2.00 | 50    |

Some content in between.

Second table:
| Name | Role | Department |
|------|------|------------|
| Alice | Manager | Sales |
| Bob | Developer | IT |
| Carol | Designer | Marketing |

More content here.`;
        // Write complex file
        const complexFilePath = path.join(testDir, 'complex.md');
        fs.writeFileSync(complexFilePath, complexMarkdown);
        const fileHandler = (0, fileHandler_1.getFileHandler)();
        const parser = new markdownParser_1.MarkdownParser();
        // Read and parse
        const content = await fileHandler.readMarkdownFile(vscode.Uri.file(complexFilePath));
        const ast = parser.parseDocument(content);
        const tables = parser.findTablesInDocument(ast);
        assert.strictEqual(tables.length, 2);
        // Verify first table
        assert.strictEqual(tables[0].headers.length, 3);
        assert.deepStrictEqual(tables[0].headers, ['Product', 'Price', 'Stock']);
        assert.strictEqual(tables[0].rows.length, 2);
        // Verify second table
        assert.strictEqual(tables[1].headers.length, 3);
        assert.deepStrictEqual(tables[1].headers, ['Name', 'Role', 'Department']);
        assert.strictEqual(tables[1].rows.length, 3);
        // Test table position finding
        const tableAtLine5 = parser.findTableAtPosition(ast, new vscode.Position(4, 0));
        assert.ok(tableAtLine5);
        assert.deepStrictEqual(tableAtLine5.headers, ['Product', 'Price', 'Stock']);
        const tableAtLine15 = parser.findTableAtPosition(ast, new vscode.Position(14, 0));
        assert.ok(tableAtLine15);
        assert.deepStrictEqual(tableAtLine15.headers, ['Name', 'Role', 'Department']);
    });
    test('Error handling integration', async () => {
        const fileHandler = (0, fileHandler_1.getFileHandler)();
        const parser = new markdownParser_1.MarkdownParser();
        // Test non-existent file
        try {
            await fileHandler.readMarkdownFile(vscode.Uri.file('/non/existent/file.md'));
            assert.fail('Should have thrown an error');
        }
        catch (error) {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('Failed to read file'));
        }
        // Test invalid markdown parsing
        const invalidMarkdown = `| Header |
|--------|
| Row 1
| Row 2 |`;
        try {
            const ast = parser.parseDocument(invalidMarkdown);
            const tables = parser.findTablesInDocument(ast);
            // Should not throw, but may return malformed tables
            assert.ok(Array.isArray(tables));
        }
        catch (error) {
            // Expected for severely malformed tables
            assert.ok(error instanceof Error);
        }
    });

    test('Multiple file operations integration', async () => {
        const fileHandler = (0, fileHandler_1.getFileHandler)();
        const parser = new markdownParser_1.MarkdownParser();
        const files = [
            { name: 'file1.md', content: '| A | B |\n|---|---|\n| 1 | 2 |' },
            { name: 'file2.md', content: '| X | Y | Z |\n|---|---|---|\n| 3 | 4 | 5 |' },
            { name: 'file3.md', content: '| Name |\n|------|\n| Test |' }
        ];
        // Create multiple files
        const filePaths = files.map(file => {
            const filePath = path.join(testDir, file.name);
            fs.writeFileSync(filePath, file.content);
            return filePath;
        });
        // Process all files
        const results = await Promise.all(filePaths.map(async (filePath) => {
            const content = await fileHandler.readMarkdownFile(vscode.Uri.file(filePath));
            const ast = parser.parseDocument(content);
            const tables = parser.findTablesInDocument(ast);
            return { filePath, tableCount: tables.length, tables };
        }));
        // Verify results
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0].tableCount, 1);
        assert.strictEqual(results[1].tableCount, 1);
        assert.strictEqual(results[2].tableCount, 1);
        // Verify table structures
        assert.strictEqual(results[0].tables[0].headers.length, 2);
        assert.strictEqual(results[1].tables[0].headers.length, 3);
        assert.strictEqual(results[2].tables[0].headers.length, 1);
    });
});
//# sourceMappingURL=extension.integration.test.js.map