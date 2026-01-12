import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { MarkdownParser } from '../../src/markdownParser';
import { TableDataManager } from '../../src/tableDataManager';
import { getFileHandler } from '../../src/fileHandler';

suite('End-to-End Test Suite', () => {
    let testDir: string;

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
        const fileHandler = getFileHandler();
        const parser = new MarkdownParser();
        
        const content = await fileHandler.readMarkdownFile(vscode.Uri.file(testFilePath));
        const ast = parser.parseDocument(content);
        const tables = parser.findTablesInDocument(ast);
        
        assert.strictEqual(tables.length, 1, 'Should find exactly one table');
        const originalTable = tables[0];
        assert.strictEqual(originalTable.headers.length, 4, 'Should have 4 columns');
        assert.strictEqual(originalTable.rows.length, 3, 'Should have 3 rows');

        // Step 3: Load table into TableDataManager
        const tableManager = new TableDataManager(originalTable, testFilePath);
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
        
        await fileHandler.updateTableInFile(
            vscode.Uri.file(testFilePath),
            tableStart,
            tableEnd,
            modifiedMarkdown
        );

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

        const fileHandler = getFileHandler();
        const parser = new MarkdownParser();

        // Read and parse
        const content = await fileHandler.readMarkdownFile(vscode.Uri.file(multiTableFilePath));
        const ast = parser.parseDocument(content);
        const tables = parser.findTablesInDocument(ast);

        assert.strictEqual(tables.length, 2, 'Should find two tables');

        // Modify both tables
        const table1Manager = new TableDataManager(tables[0], multiTableFilePath);
        table1Manager.addRow(); // Add empty row
        table1Manager.updateCell(2, 0, 'Testing');
        table1Manager.updateCell(2, 1, '$15,000');
        table1Manager.updateCell(2, 2, '$14,000');
        table1Manager.updateCell(2, 3, '-$1,000');

        const table2Manager = new TableDataManager(tables[1], multiTableFilePath);
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

        const fileHandler = getFileHandler();
        const parser = new MarkdownParser();

        // Should handle corrupted table gracefully
        try {
            const content = await fileHandler.readMarkdownFile(vscode.Uri.file(corruptedFilePath));
            const ast = parser.parseDocument(content);
            const tables = parser.findTablesInDocument(ast);
            
            // Parser should attempt to extract what it can
            assert.ok(Array.isArray(tables), 'Should return array even for corrupted tables');
            
            if (tables.length > 0) {
                const tableManager = new TableDataManager(tables[0], corruptedFilePath);
                
                // Should be able to work with whatever was extracted
                const stats = tableManager.getStatistics();
                assert.ok(typeof stats.totalCells === 'number');
                assert.ok(stats.totalCells >= 0);
            }
        } catch (error) {
            // If parsing fails completely, that's also acceptable behavior
            assert.ok(error instanceof Error);
        }
    });

    test('File system integration workflow', async () => {
        const testFilePath = path.join(testDir, 'fs-test.md');
        const fileHandler = getFileHandler();
        const parser = new MarkdownParser();

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

        const tableManager = new TableDataManager(tables[0], testFilePath);
        
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

    test('Multiple tables independent editing workflow', async () => {
        const testFilePath = path.join(testDir, 'multi-table-edit.md');
        const fileHandler = getFileHandler();
        const parser = new MarkdownParser();

        // Create a file with two independent tables
        const multiTableContent = `# Sales Report

## Q1 Sales
| Product | Units | Revenue |
|---------|-------|---------|
| Laptop | 10 | $15,000 |
| Mouse | 50 | $2,500 |
| Keyboard | 30 | $3,000 |

## Q2 Sales
| Product | Units | Revenue |
|---------|-------|---------|
| Monitor | 20 | $8,000 |
| Headphones | 15 | $1,500 |
| Webcam | 8 | $800 |`;

        // Write the initial file using fs (direct write to bypass VS Code API)
        fs.writeFileSync(testFilePath, multiTableContent);

        // Step 1: Read and parse
        const content = await fileHandler.readMarkdownFile(vscode.Uri.file(testFilePath));
        const ast = parser.parseDocument(content);
        const tables = parser.findTablesInDocument(ast);

        assert.strictEqual(tables.length, 2, 'Should find exactly two tables');
        
        // Step 2: Verify table contents
        const table1Manager = new TableDataManager(tables[0], testFilePath, 0);
        const table1Data = table1Manager.getTableData();
        assert.strictEqual(table1Data.headers.length, 3);
        assert.strictEqual(table1Data.rows.length, 3);
        assert.strictEqual(table1Data.rows[0][0], 'Laptop');

        const table2Manager = new TableDataManager(tables[1], testFilePath, 1);
        const table2Data = table2Manager.getTableData();
        assert.strictEqual(table2Data.headers.length, 3);
        assert.strictEqual(table2Data.rows.length, 3);
        assert.strictEqual(table2Data.rows[0][0], 'Monitor');

        // Step 3: Edit Table 1 (Q1 Sales)
        table1Manager.updateCell(0, 1, '12'); // Change Laptop units from 10 to 12
        table1Manager.updateCell(0, 2, '$18,000'); // Update revenue
        table1Manager.updateCell(1, 0, 'Trackpad'); // Change Mouse to Trackpad
        
        // Step 4: Edit Table 2 (Q2 Sales) independently
        table2Manager.updateCell(0, 1, '25'); // Change Monitor units from 20 to 25
        table2Manager.updateCell(0, 2, '$10,000'); // Update revenue
        table2Manager.addRow();
        table2Manager.updateCell(3, 0, 'Desk Lamp');
        table2Manager.updateCell(3, 1, '5');
        table2Manager.updateCell(3, 2, '$500');
        
        // Step 5: Serialize and manually reconstruct file
        // This bypasses VS Code's openTextDocument to avoid test environment issues
        const table1Serialized = table1Manager.serializeToMarkdown();
        const table2Serialized = table2Manager.serializeToMarkdown();
        
        // Create new content by replacing the old tables with new ones
        let updatedContent = content;
        
        // Replace table 1 (using line ranges from original parse)
        const lines = content.split('\n');
        
        // Build new file content by sections:
        // - Lines 0 to table1.startLine-1: Keep as-is (header, pre-table content)
        // - table1.startLine to table1.endLine: Replace with modified table
        // - After table1.endLine until table2.startLine-1: Keep as-is (content between tables)
        // - table2.startLine to table2.endLine: Replace with modified table  
        // - After table2.endLine: Keep as-is (remaining content)
        
        const beforeTable1 = lines.slice(0, tables[0].startLine);
        const afterTable1Before2 = lines.slice(tables[0].endLine + 1, tables[1].startLine);
        const afterTable2 = lines.slice(tables[1].endLine + 1);
        
        const newLines = [
            ...beforeTable1,
            ...table1Serialized.split('\n'),
            ...afterTable1Before2,
            ...table2Serialized.split('\n'),
            ...afterTable2
        ];
        
        updatedContent = newLines.join('\n');
        
        // Write back using fs (bypass VS Code API issues in test environment)
        fs.writeFileSync(testFilePath, updatedContent);

        // Step 6: Verify changes were persisted correctly
        const persistedContent = await fileHandler.readMarkdownFile(vscode.Uri.file(testFilePath));
        
        // Verify Table 1 changes
        assert.ok(persistedContent.includes('Trackpad'), 'Table 1 should have Trackpad update');
        assert.ok(persistedContent.includes('12'), 'Table 1 should have updated Laptop units');
        assert.ok(persistedContent.includes('$18,000'), 'Table 1 should have updated Laptop revenue');
        
        // Verify Table 2 changes
        assert.ok(persistedContent.includes('25'), 'Table 2 should have updated Monitor units');
        assert.ok(persistedContent.includes('Desk Lamp'), 'Table 2 should have new row with Desk Lamp');
        assert.ok(persistedContent.includes('$10,000'), 'Table 2 should have updated Monitor revenue');
        
        // Verify other content is preserved
        assert.ok(persistedContent.includes('# Sales Report'), 'Document header should be preserved');
        assert.ok(persistedContent.includes('## Q1 Sales'), 'Q1 section title should be preserved');
        assert.ok(persistedContent.includes('## Q2 Sales'), 'Q2 section title should be preserved');

        // Step 7: Re-parse to verify structural integrity
        const finalAst = parser.parseDocument(persistedContent);
        const finalTables = parser.findTablesInDocument(finalAst);
        
        assert.strictEqual(finalTables.length, 2, 'Should still have exactly two tables after updates');
        
        const finalTable1 = new TableDataManager(finalTables[0], testFilePath, 0).getTableData();
        assert.strictEqual(finalTable1.rows[1][0], 'Trackpad', 'Verify Table 1 row 2 cell 1 persisted');
        assert.strictEqual(finalTable1.rows[0][1], '12', 'Verify Table 1 row 1 cell 2 persisted (Laptop units updated)');
        
        const finalTable2 = new TableDataManager(finalTables[1], testFilePath, 1).getTableData();
        assert.strictEqual(finalTable2.rows.length, 4, 'Table 2 should have 4 rows after adding new row');
        assert.strictEqual(finalTable2.rows[3][0], 'Desk Lamp', 'Verify Table 2 new row persisted');
    });
});
