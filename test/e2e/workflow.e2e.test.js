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
const tableDataManager_1 = require("../../src/tableDataManager");
const fileHandler_1 = require("../../src/fileHandler");
suite('End-to-End Test Suite', () => {
    let testDir;
    suiteSetup(() => {
        // Create temporary test directory
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-table-editor-e2e-'));
    });
    suiteTeardown(() => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });
    test('Complete table editing workflow', async () => {
        const testFilePath = path.join(testDir, 'workflow-test.md');
        // Step 1: Create a markdown file with a table
        const originalContent = `# Project Management

## Team Members

| Name | Role | Experience | Salary |
|------|------|------------|--------|
| Alice | Manager | 5 years | $80,000 |
| Bob | Developer | 3 years | $70,000 |
| Carol | Designer | 2 years | $60,000 |

## Project Status
Current status: In Progress`;
        fs.writeFileSync(testFilePath, originalContent);
        // Step 2: Read and parse the file
        const fileHandler = (0, fileHandler_1.getFileHandler)();
        const parser = new markdownParser_1.MarkdownParser();
        const content = await fileHandler.readMarkdownFile(vscode.Uri.file(testFilePath));
        const ast = parser.parseDocument(content);
        const tables = parser.findTablesInDocument(ast);
        assert.strictEqual(tables.length, 1, 'Should find exactly one table');
        const originalTable = tables[0];
        assert.strictEqual(originalTable.headers.length, 4, 'Should have 4 columns');
        assert.strictEqual(originalTable.rows.length, 3, 'Should have 3 rows');
        // Step 3: Load table into TableDataManager
        const tableManager = new tableDataManager_1.TableDataManager(originalTable, testFilePath);
        const tableData = tableManager.getTableData();
        // Verify loaded data
        assert.strictEqual(tableData.rows.length, 3);
        assert.strictEqual(tableData.headers.length, 4);
        assert.strictEqual(tableData.rows[0][0], 'Alice');
        // Step 4: Perform basic table operations
        // Add a new team member (row)
        tableManager.addRow(); // Add empty row
        tableManager.updateCell(3, 0, 'David');
        tableManager.updateCell(3, 1, 'Tester');
        tableManager.updateCell(3, 2, '1 year');
        tableManager.updateCell(3, 3, '$50,000');
        const updatedData = tableManager.getTableData();
        assert.strictEqual(updatedData.rows.length, 4);
        assert.strictEqual(updatedData.rows[3][0], 'David');
        // Update a salary
        tableManager.updateCell(1, 3, '$75,000');
        assert.strictEqual(tableManager.getTableData().rows[1][3], '$75,000');
        // Add a new column
        tableManager.addColumn(); // Add empty column
        // Update header and values for new column
        const newData = tableManager.getTableData();
        newData.headers[4] = 'Department';
        newData.rows[0][4] = 'HR';
        newData.rows[1][4] = 'IT';
        newData.rows[2][4] = 'Design';
        newData.rows[3][4] = 'QA';
        assert.strictEqual(newData.headers.length, 5);
        assert.strictEqual(newData.rows[0][4], 'HR');
        // Step 5: Serialize back to Markdown
        const modifiedMarkdown = tableManager.serializeToMarkdown();
        // Verify serialized content structure
        assert.ok(modifiedMarkdown.includes('David'));
        assert.ok(modifiedMarkdown.includes('$75,000'));
        // Step 6: Update the file with modified table
        const tableStart = originalTable.startLine;
        const tableEnd = originalTable.endLine;
        await fileHandler.updateTableInFile(vscode.Uri.file(testFilePath), tableStart, tableEnd, modifiedMarkdown);
        // Step 7: Verify the file was updated correctly
        const updatedContent = await fileHandler.readMarkdownFile(vscode.Uri.file(testFilePath));
        // Parse the updated file
        const updatedAst = parser.parseDocument(updatedContent);
        const updatedTables = parser.findTablesInDocument(updatedAst);
        assert.strictEqual(updatedTables.length, 1);
        const updatedTable = updatedTables[0];
        assert.strictEqual(updatedTable.rows.length, 4, 'Should have 4 rows after adding David');
        // Verify specific changes
        assert.ok(updatedContent.includes('David'));
        assert.ok(updatedContent.includes('$75,000'));
        assert.ok(updatedContent.includes('# Project Management')); // Original content preserved
        assert.ok(updatedContent.includes('Current status: In Progress')); // Original content preserved
    });
    test('Multiple tables editing workflow', async () => {
        const multiTableFilePath = path.join(testDir, 'multi-table.md');
        const multiTableContent = `# Project Report

## Budget Overview
| Category | Planned | Actual | Variance |
|----------|---------|--------|----------|
| Development | $50,000 | $48,000 | -$2,000 |
| Marketing | $20,000 | $22,000 | +$2,000 |

## Team Performance
| Member | Tasks | Completed | Efficiency |
|--------|-------|-----------|------------|
| Alice | 10 | 9 | 90% |
| Bob | 8 | 8 | 100% |

End of report.`;
        fs.writeFileSync(multiTableFilePath, multiTableContent);
        const fileHandler = (0, fileHandler_1.getFileHandler)();
        const parser = new markdownParser_1.MarkdownParser();
        // Read and parse
        const content = await fileHandler.readMarkdownFile(vscode.Uri.file(multiTableFilePath));
        const ast = parser.parseDocument(content);
        const tables = parser.findTablesInDocument(ast);
        assert.strictEqual(tables.length, 2, 'Should find two tables');
        // Modify both tables
        const table1Manager = new tableDataManager_1.TableDataManager(tables[0], multiTableFilePath);
        table1Manager.addRow(); // Add empty row
        table1Manager.updateCell(2, 0, 'Testing');
        table1Manager.updateCell(2, 1, '$15,000');
        table1Manager.updateCell(2, 2, '$14,000');
        table1Manager.updateCell(2, 3, '-$1,000');
        const table2Manager = new tableDataManager_1.TableDataManager(tables[1], multiTableFilePath);
        table2Manager.addRow(); // Add empty row
        table2Manager.updateCell(2, 0, 'Carol');
        table2Manager.updateCell(2, 1, '12');
        table2Manager.updateCell(2, 2, '11');
        table2Manager.updateCell(2, 3, '92%');
        // Update both tables in file
        const updates = [
            {
                startLine: tables[0].startLine,
                endLine: tables[0].endLine,
                newContent: table1Manager.serializeToMarkdown()
            },
            {
                startLine: tables[1].startLine,
                endLine: tables[1].endLine,
                newContent: table2Manager.serializeToMarkdown()
            }
        ];
        await fileHandler.updateMultipleTablesInFile(vscode.Uri.file(multiTableFilePath), updates);
        // Verify updates
        const updatedContent = await fileHandler.readMarkdownFile(vscode.Uri.file(multiTableFilePath));
        assert.ok(updatedContent.includes('Testing'));
        assert.ok(updatedContent.includes('Carol'));
        assert.ok(updatedContent.includes('# Project Report')); // Header preserved
        assert.ok(updatedContent.includes('End of report.')); // Footer preserved
    });
    test('Error handling workflow', async () => {
        const corruptedFilePath = path.join(testDir, 'corrupted.md');
        const corruptedContent = `# Corrupted Table Test

| Header1 | Header2 |
|---------|
| Row1Col1 | Row1Col2 |
| Row2Col1 |
| Row3Col1 | Row3Col2 | Row3Col3 |

Normal text continues here.`;
        fs.writeFileSync(corruptedFilePath, corruptedContent);
        const fileHandler = (0, fileHandler_1.getFileHandler)();
        const parser = new markdownParser_1.MarkdownParser();
        // Should handle corrupted table gracefully
        try {
            const content = await fileHandler.readMarkdownFile(vscode.Uri.file(corruptedFilePath));
            const ast = parser.parseDocument(content);
            const tables = parser.findTablesInDocument(ast);
            // Parser should attempt to extract what it can
            assert.ok(Array.isArray(tables), 'Should return array even for corrupted tables');
            if (tables.length > 0) {
                const tableManager = new tableDataManager_1.TableDataManager(tables[0], corruptedFilePath);
                // Should be able to work with whatever was extracted
                const stats = tableManager.getStatistics();
                assert.ok(typeof stats.totalCells === 'number');
                assert.ok(stats.totalCells >= 0);
            }
        }
        catch (error) {
            // If parsing fails completely, that's also acceptable behavior
            assert.ok(error instanceof Error);
        }
    });
    test('File system integration workflow', async () => {
        const testFilePath = path.join(testDir, 'fs-test.md');
        const fileHandler = (0, fileHandler_1.getFileHandler)();
        const parser = new markdownParser_1.MarkdownParser();
        // Test creating and reading a simple table
        const simpleTableContent = `| A | B |
|---|---|
| 1 | 2 |`;
        fs.writeFileSync(testFilePath, simpleTableContent);
        // Read and verify
        const content = await fileHandler.readMarkdownFile(vscode.Uri.file(testFilePath));
        assert.strictEqual(content, simpleTableContent);
        // Parse and modify
        const ast = parser.parseDocument(content);
        const tables = parser.findTablesInDocument(ast);
        assert.strictEqual(tables.length, 1);
        const tableManager = new tableDataManager_1.TableDataManager(tables[0], testFilePath);
        // Add some data
        tableManager.addRow();
        tableManager.updateCell(1, 0, '3');
        tableManager.updateCell(1, 1, '4');
        // Write back
        const newContent = tableManager.serializeToMarkdown();
        await fileHandler.writeMarkdownFile(vscode.Uri.file(testFilePath), newContent);
        // Verify persistence
        const readBack = await fileHandler.readMarkdownFile(vscode.Uri.file(testFilePath));
        assert.ok(readBack.includes('3'));
        assert.ok(readBack.includes('4'));
    });
    test('Backup functionality workflow', async () => {
        const backupTestFile = path.join(testDir, 'backup-test.md');
        const originalContent = `| Original | Table |
|----------|-------|
| Data     | Here  |`;
        fs.writeFileSync(backupTestFile, originalContent);
        const fileHandler = (0, fileHandler_1.getFileHandler)();
        // Create backup
        const backupPath = await fileHandler.createBackup(vscode.Uri.file(backupTestFile));
        assert.ok(backupPath);
        assert.ok(fs.existsSync(backupPath));
        // Verify backup content
        const backupContent = fs.readFileSync(backupPath, 'utf8');
        assert.strictEqual(backupContent, originalContent);
        // Modify original file
        const modifiedContent = originalContent.replace('Original', 'Modified');
        await fileHandler.writeMarkdownFile(vscode.Uri.file(backupTestFile), modifiedContent);
        // Verify original is modified but backup is unchanged
        const currentContent = await fileHandler.readMarkdownFile(vscode.Uri.file(backupTestFile));
        assert.ok(currentContent.includes('Modified'));
        const backupContentAfter = fs.readFileSync(backupPath, 'utf8');
        assert.ok(backupContentAfter.includes('Original'));
    });
});
//# sourceMappingURL=workflow.e2e.test.js.map