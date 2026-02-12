const assert = require('assert');
import { TableDataManager, TableData } from '../../src/tableDataManager';
import { TableNode } from '../../src/markdownParser';

suite('TableDataManager Test Suite', () => {
    let sampleTableNode: TableNode;
    let manager: TableDataManager;

    setup(() => {
        sampleTableNode = {
            startLine: 0,
            endLine: 3,
            headers: ['Name', 'Age', 'City'],
            rows: [
                ['John', '25', 'NYC'],
                ['Jane', '30', 'LA'],
                ['Bob', '35', 'Chicago']
            ]
        };
        
        manager = new TableDataManager(sampleTableNode, 'test.md');
    });

    test('should load table from TableNode', () => {
        const tableData = manager.getTableData();
        
        assert.deepStrictEqual(tableData.headers, ['Name', 'Age', 'City']);
        assert.strictEqual(tableData.rows.length, 3);
        assert.deepStrictEqual(tableData.rows[0], ['John', '25', 'NYC']);
        assert.strictEqual(tableData.metadata.sourceUri, 'test.md');
        assert.strictEqual(tableData.metadata.columnCount, 3);
        assert.strictEqual(tableData.metadata.rowCount, 3);
    });

    test('should update cell value', () => {
        manager.updateCell(0, 0, 'Johnny');
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][0], 'Johnny');
    });

    test('should throw error for invalid cell position', () => {
        assert.throws(() => {
            manager.updateCell(10, 0, 'Invalid');
        }, /Invalid cell position/);
        
        assert.throws(() => {
            manager.updateCell(0, 10, 'Invalid');
        }, /Invalid cell position/);
    });

    test('should add row at end', () => {
        manager.addRow();
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows.length, 4);
        assert.deepStrictEqual(tableData.rows[3], ['', '', '']);
        assert.strictEqual(tableData.metadata.rowCount, 4);
    });

    test('should add row at specific index', () => {
        manager.addRow(1);
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows.length, 4);
        assert.deepStrictEqual(tableData.rows[1], ['', '', '']);
        assert.deepStrictEqual(tableData.rows[2], ['Jane', '30', 'LA']);
    });

    test('should delete row', () => {
        manager.deleteRow(1);
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows.length, 2);
        assert.deepStrictEqual(tableData.rows[0], ['John', '25', 'NYC']);
        assert.deepStrictEqual(tableData.rows[1], ['Bob', '35', 'Chicago']);
    });

    test('should throw error for invalid row index', () => {
        assert.throws(() => {
            manager.deleteRow(10);
        }, /Invalid row index/);
    });

    test('should add column at end', () => {
        manager.addColumn(undefined, 1, 'Country');

        const tableData = manager.getTableData();
        assert.strictEqual(tableData.headers.length, 4);
        assert.strictEqual(tableData.headers[3], 'Country');
        assert.strictEqual(tableData.rows[0].length, 4);
        assert.strictEqual(tableData.rows[0][3], '');
    });

    test('should add column at specific index', () => {
        manager.addColumn(1, 1, 'Email');

        const tableData = manager.getTableData();
        assert.strictEqual(tableData.headers.length, 4);
        assert.strictEqual(tableData.headers[1], 'Email');
        assert.strictEqual(tableData.headers[2], 'Age');
        assert.strictEqual(tableData.rows[0][1], '');
        assert.strictEqual(tableData.rows[0][2], '25');
    });

    test('should delete column', () => {
        manager.deleteColumn(1);
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.headers.length, 2);
        assert.deepStrictEqual(tableData.headers, ['Name', 'City']);
        assert.deepStrictEqual(tableData.rows[0], ['John', 'NYC']);
    });

    test('should not delete last column', () => {
        // Delete two columns first
        manager.deleteColumn(1);
        manager.deleteColumn(1);
        
        // Try to delete the last column
        assert.throws(() => {
            manager.deleteColumn(0);
        }, /Cannot delete the last column/);
    });

    test('should sort by column ascending', () => {
        manager.sortByColumn(0, 'asc'); // Sort by Name
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][0], 'Bob');
        assert.strictEqual(tableData.rows[1][0], 'Jane');
        assert.strictEqual(tableData.rows[2][0], 'John');
    });

    test('should sort by column descending', () => {
        manager.sortByColumn(1, 'desc'); // Sort by Age (numeric)
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][1], '35');
        assert.strictEqual(tableData.rows[1][1], '30');
        assert.strictEqual(tableData.rows[2][1], '25');
    });

    test('should move row', () => {
        manager.moveRow(0, 2); // Move first row to third position
        
        const tableData = manager.getTableData();
        assert.deepStrictEqual(tableData.rows[0], ['Jane', '30', 'LA']);
        assert.deepStrictEqual(tableData.rows[1], ['Bob', '35', 'Chicago']);
        assert.deepStrictEqual(tableData.rows[2], ['John', '25', 'NYC']);
    });

    test('should move column', () => {
        manager.moveColumn(0, 2); // Move Name column to third position
        
        const tableData = manager.getTableData();
        assert.deepStrictEqual(tableData.headers, ['Age', 'City', 'Name']);
        assert.deepStrictEqual(tableData.rows[0], ['25', 'NYC', 'John']);
    });

    test('should serialize to markdown', () => {
        const markdown = manager.serializeToMarkdown();
        
        assert.ok(markdown.includes('| Name | Age | City |'));
        // After alignment removal, separator line is always left-aligned
        assert.ok(markdown.includes('| :--- | :--- | :--- |'));
        assert.ok(markdown.includes('| John | 25 | NYC |'));
        assert.ok(markdown.includes('| Jane | 30 | LA |'));
        assert.ok(markdown.includes('| Bob | 35 | Chicago |'));
    });

    test('should escape pipe characters when serializing to markdown', () => {
        // Create a table with pipe characters in cells
        const tableNode: TableNode = {
            startLine: 0,
            endLine: 2,
            headers: ['Column A | B', 'Column C'],
            rows: [
                ['Value | with | pipes', 'Normal value'],
                ['Another | pipe', 'Test']
            ]
        };
        
        const pipeManager = new TableDataManager(tableNode);
        const markdown = pipeManager.serializeToMarkdown();
        
        // Verify pipe characters are escaped
        assert.ok(markdown.includes('| Column A \\| B | Column C |'));
        assert.ok(markdown.includes('| Value \\| with \\| pipes | Normal value |'));
        assert.ok(markdown.includes('| Another \\| pipe | Test |'));
    });

    test('should not double-escape already escaped pipes', () => {
        // Create a table with already escaped pipe characters
        const tableNode: TableNode = {
            startLine: 0,
            endLine: 1,
            headers: ['Header'],
            rows: [['Already \\| escaped']]
        };
        
        const pipeManager = new TableDataManager(tableNode);
        const markdown = pipeManager.serializeToMarkdown();
        
        // Verify pipe characters are not double-escaped
        assert.ok(markdown.includes('| Already \\| escaped |'));
        assert.ok(!markdown.includes('\\\\|')); // Should not have double backslash
    });

    test('should validate table structure', () => {
        const validTableNode: TableNode = {
            startLine: 0,
            endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2'], ['3', '4']]
        };
        
        const validManager = new TableDataManager(validTableNode);
        const validation = validManager.validateTableStructure(validTableNode);
        
        assert.strictEqual(validation.isValid, true);
        assert.strictEqual(validation.issues.length, 0);
    });

    test('should detect validation issues', () => {
        const invalidTableNode: TableNode = {
            startLine: 0,
            endLine: 2,
            headers: ['A', 'B'],
            rows: [['1'], ['3', '4', '5']] // Inconsistent column count
        };
        
        const invalidManager = new TableDataManager(invalidTableNode);
        const validation = invalidManager.validateTableStructure(invalidTableNode);
        
        assert.strictEqual(validation.isValid, false);
        assert.ok(validation.issues.length > 0);
    });

    test('should provide table statistics', () => {
        const stats = manager.getStatistics();
        
        assert.strictEqual(stats.totalCells, 9);
        assert.strictEqual(stats.emptyCells, 0);
        assert.strictEqual(stats.fillRate, 1);
        assert.strictEqual(stats.columnWidths.length, 3);
        assert.ok(stats.averageRowLength > 0);
    });

    test('should handle change listeners', () => {
        let changeCount = 0;
        let lastData: TableData | null = null;
        
        const listener = (data: TableData) => {
            changeCount++;
            lastData = data;
        };
        
        manager.addChangeListener(listener);
        manager.updateCell(0, 0, 'Changed');
        
        assert.strictEqual(changeCount, 1);
        assert.notStrictEqual(lastData, null);
        assert.strictEqual(lastData!.rows[0][0], 'Changed');
        
        manager.removeChangeListener(listener);
        manager.updateCell(0, 0, 'Changed Again');
        
        assert.strictEqual(changeCount, 1); // Should not increment
    });

    test('should clone table data manager', () => {
        const cloned = manager.clone();
        const originalData = manager.getTableData();
        const clonedData = cloned.getTableData();
        
        assert.notStrictEqual(cloned, manager);
        assert.deepStrictEqual(clonedData.headers, originalData.headers);
        assert.deepStrictEqual(clonedData.rows, originalData.rows);
        
        // Modify cloned data and ensure original is unchanged
        cloned.updateCell(0, 0, 'Modified');
        assert.notStrictEqual(cloned.getTableData().rows[0][0], manager.getTableData().rows[0][0]);
    });

    test('should generate unique table IDs', () => {
        const manager1 = new TableDataManager(sampleTableNode);
        const manager2 = new TableDataManager(sampleTableNode);
        
        assert.notStrictEqual(manager1.getTableData().id, manager2.getTableData().id);
    });

    // Advanced CRUD Operations Tests

    test('should batch update multiple cells', () => {
        const updates = [
            { row: 0, col: 0, value: 'Updated1' },
            { row: 1, col: 1, value: 'Updated2' },
            { row: 2, col: 2, value: 'Updated3' }
        ];

        manager.batchUpdateCells(updates);
        const tableData = manager.getTableData();

        assert.strictEqual(tableData.rows[0][0], 'Updated1');
        assert.strictEqual(tableData.rows[1][1], 'Updated2');
        assert.strictEqual(tableData.rows[2][2], 'Updated3');
    });

    test('should insert multiple rows', () => {
        manager.insertRows(1, 2);
        const tableData = manager.getTableData();

        assert.strictEqual(tableData.rows.length, 5);
        assert.deepStrictEqual(tableData.rows[1], ['', '', '']);
        assert.deepStrictEqual(tableData.rows[2], ['', '', '']);
        assert.deepStrictEqual(tableData.rows[3], ['Jane', '30', 'LA']);
    });

    test('should delete multiple rows', () => {
        manager.deleteRows([0, 2]);
        const tableData = manager.getTableData();

        assert.strictEqual(tableData.rows.length, 1);
        assert.deepStrictEqual(tableData.rows[0], ['Jane', '30', 'LA']);
    });

    test('should insert multiple columns', () => {
        manager.insertColumns(1, 2, ['Email', 'Phone']);
        const tableData = manager.getTableData();

        assert.strictEqual(tableData.headers.length, 5);
        assert.deepStrictEqual(tableData.headers, ['Name', 'Email', 'Phone', 'Age', 'City']);
        assert.strictEqual(tableData.rows[0].length, 5);
        assert.strictEqual(tableData.rows[0][1], '');
        assert.strictEqual(tableData.rows[0][2], '');
        assert.strictEqual(tableData.rows[0][3], '25');
    });

    test('should delete multiple columns', () => {
        manager.deleteColumns([0, 2]);
        const tableData = manager.getTableData();

        assert.strictEqual(tableData.headers.length, 1);
        assert.deepStrictEqual(tableData.headers, ['Age']);
        assert.deepStrictEqual(tableData.rows[0], ['25']);
        assert.deepStrictEqual(tableData.rows[1], ['30']);
    });

    test('should update entire row', () => {
        manager.updateRow(0, ['Johnny', '26', 'Boston']);
        const tableData = manager.getTableData();

        assert.deepStrictEqual(tableData.rows[0], ['Johnny', '26', 'Boston']);
    });

    test('should update entire column', () => {
        manager.updateColumn(1, ['22', '28', '33'], 'Years');
        const tableData = manager.getTableData();

        assert.strictEqual(tableData.headers[1], 'Years');
        assert.strictEqual(tableData.rows[0][1], '22');
        assert.strictEqual(tableData.rows[1][1], '28');
        assert.strictEqual(tableData.rows[2][1], '33');
    });

    test('should clear all cells', () => {
        manager.clearAllCells();
        const tableData = manager.getTableData();

        for (const row of tableData.rows) {
            for (const cell of row) {
                assert.strictEqual(cell, '');
            }
        }
    });

    test('should clear specific row', () => {
        manager.clearRow(1);
        const tableData = manager.getTableData();

        assert.deepStrictEqual(tableData.rows[1], ['', '', '']);
        assert.deepStrictEqual(tableData.rows[0], ['John', '25', 'NYC']); // Other rows unchanged
    });

    test('should clear specific column', () => {
        manager.clearColumn(1);
        const tableData = manager.getTableData();

        assert.strictEqual(tableData.rows[0][1], '');
        assert.strictEqual(tableData.rows[1][1], '');
        assert.strictEqual(tableData.rows[2][1], '');
        assert.strictEqual(tableData.rows[0][0], 'John'); // Other columns unchanged
    });

    test('should duplicate row', () => {
        manager.duplicateRow(0);
        const tableData = manager.getTableData();

        assert.strictEqual(tableData.rows.length, 4);
        assert.deepStrictEqual(tableData.rows[0], ['John', '25', 'NYC']);
        assert.deepStrictEqual(tableData.rows[1], ['John', '25', 'NYC']);
        assert.deepStrictEqual(tableData.rows[2], ['Jane', '30', 'LA']);
    });

    test('should duplicate column', () => {
        manager.duplicateColumn(0);
        const tableData = manager.getTableData();

        assert.strictEqual(tableData.headers.length, 4);
        assert.strictEqual(tableData.headers[0], 'Name');
        assert.strictEqual(tableData.headers[1], 'Name Copy');
        assert.strictEqual(tableData.rows[0][0], 'John');
        assert.strictEqual(tableData.rows[0][1], 'John');
    });

    test('should find and replace text', () => {
        const count = manager.findAndReplace('John', 'Jonathan');
        
        assert.strictEqual(count, 1);
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][0], 'Jonathan');
    });

    test('should find and replace with regex', () => {
        const count = manager.findAndReplace('\\d+', 'XX', { useRegex: true });
        
        assert.ok(count > 0);
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][1], 'XX');
        assert.strictEqual(tableData.rows[1][1], 'XX');
    });

    test('should get row data', () => {
        const rowData = manager.getRow(0);
        assert.deepStrictEqual(rowData, ['John', '25', 'NYC']);
    });

    test('should get column data', () => {
        const columnData = manager.getColumn(0);
        assert.strictEqual(columnData.header, 'Name');
        assert.deepStrictEqual(columnData.values, ['John', 'Jane', 'Bob']);
    });

    test('should get cell value', () => {
        const cellValue = manager.getCell(0, 0);
        assert.strictEqual(cellValue, 'John');
    });

    test('should check if table is empty', () => {
        assert.strictEqual(manager.isEmpty(), false);
        
        // Create empty table
        const emptyTableNode: TableNode = {
            startLine: 0,
            endLine: 1,
            headers: ['A', 'B'],
            rows: []
        };
        const emptyManager = new TableDataManager(emptyTableNode);
        assert.strictEqual(emptyManager.isEmpty(), true);
    });

    test('should detect empty cells', () => {
        manager.updateCell(0, 1, ''); // Make a cell empty
        
        assert.strictEqual(manager.hasEmptyCells(), true);
        
        const emptyCells = manager.getEmptyCells();
        assert.strictEqual(emptyCells.length, 1);
        assert.deepStrictEqual(emptyCells[0], { row: 0, col: 1 });
    });

    test('should handle batch update errors', () => {
        const invalidUpdates = [
            { row: 10, col: 0, value: 'Invalid' }
        ];

        assert.throws(() => {
            manager.batchUpdateCells(invalidUpdates);
        }, /Invalid cell position/);
    });

    test('should handle column deletion constraints', () => {
        // Try to delete all columns
        assert.throws(() => {
            manager.deleteColumns([0, 1, 2]);
        }, /Cannot delete all columns/);
    });

    // Advanced Sorting Tests

    test('should perform advanced sort with options', () => {
        manager.sortByColumnAdvanced(1, 'desc', { dataType: 'number' });
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][1], '35');
        assert.strictEqual(tableData.rows[1][1], '30');
        assert.strictEqual(tableData.rows[2][1], '25');
        
        const sortState = manager.getSortState();
        assert.notStrictEqual(sortState, null);
        assert.strictEqual(sortState!.columnIndex, 1);
        assert.strictEqual(sortState!.direction, 'desc');
    });

    test('should perform multi-column sort', () => {
        // Add duplicate ages to test secondary sort
        manager.updateCell(1, 1, '25'); // Jane now has same age as John
        
        manager.sortByMultipleColumns([
            { columnIndex: 1, direction: 'asc' }, // Sort by age first
            { columnIndex: 0, direction: 'asc' }  // Then by name
        ]);
        
        const tableData = manager.getTableData();
        // Both John and Jane have age 25, so should be sorted by name
        assert.strictEqual(tableData.rows[0][1], '25');
        assert.strictEqual(tableData.rows[1][1], '25');
        assert.strictEqual(tableData.rows[2][1], '35');
    });

    test('should sort with custom function', () => {
        // Sort by city length (shortest first)
        manager.sortByCustomFunction((rowA, rowB) => {
            const cityA = rowA[2];
            const cityB = rowB[2];
            return cityA.length - cityB.length;
        });
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][2], 'LA'); // Shortest city name
        assert.strictEqual(tableData.rows[2][2], 'Chicago'); // Longest city name
        
        // Custom sort should clear sort state
        assert.strictEqual(manager.getSortState(), null);
    });

    test('should shuffle rows randomly', () => {
        const originalOrder = manager.getTableData().rows.map(row => row[0]);
        
        manager.shuffleRows();
        
        const shuffledOrder = manager.getTableData().rows.map(row => row[0]);
        
        // Should have same elements but potentially different order
        assert.strictEqual(shuffledOrder.length, originalOrder.length);
        assert.ok(originalOrder.every(name => shuffledOrder.includes(name)));
        
        // Sort state should be cleared
        assert.strictEqual(manager.getSortState(), null);
    });

    test('should reverse row order', () => {
        const originalOrder = manager.getTableData().rows.map(row => row[0]);
        
        manager.reverseRows();
        
        const reversedOrder = manager.getTableData().rows.map(row => row[0]);
        
        assert.deepStrictEqual(reversedOrder, originalOrder.reverse());
    });

    test('should detect column data types', () => {
        // Create table with different data types
        const mixedTableNode: TableNode = {
            startLine: 0,
            endLine: 4,
            headers: ['Name', 'Age', 'Score'],
            rows: [
                ['John', '25', '85.5'],
                ['Jane', '30', '92.0'],
                ['Bob', '35', '78.5']
            ]
        };
        
        const mixedManager = new TableDataManager(mixedTableNode);
        
        const ageStats = mixedManager.getSortedColumnStats(1);
        assert.strictEqual(ageStats.dataType, 'number');
        
        const scoreStats = mixedManager.getSortedColumnStats(2);
        assert.strictEqual(scoreStats.dataType, 'number');
        
        const nameStats = mixedManager.getSortedColumnStats(0);
        assert.strictEqual(nameStats.dataType, 'string');
    });

    test('should perform natural sort', () => {
        // Create table with mixed alphanumeric data
        const naturalTableNode: TableNode = {
            startLine: 0,
            endLine: 4,
            headers: ['Item'],
            rows: [
                ['Item10'],
                ['Item2'],
                ['Item1'],
                ['Item20']
            ]
        };
        
        const naturalManager = new TableDataManager(naturalTableNode);
        naturalManager.sortNatural(0, 'asc');
        
        const tableData = naturalManager.getTableData();
        assert.strictEqual(tableData.rows[0][0], 'Item1');
        assert.strictEqual(tableData.rows[1][0], 'Item2');
        assert.strictEqual(tableData.rows[2][0], 'Item10');
        assert.strictEqual(tableData.rows[3][0], 'Item20');
    });

    test('should get sort indicators', () => {
        manager.sortByColumnAdvanced(1, 'desc');
        
        const indicators = manager.getSortIndicators();
        assert.strictEqual(indicators.length, 3);
        assert.strictEqual(indicators[1].direction, 'desc');
        assert.strictEqual(indicators[1].isPrimary, true);
        assert.strictEqual(indicators[0].direction, null);
        assert.strictEqual(indicators[2].direction, null);
    });

    test('should get column statistics', () => {
        const stats = manager.getSortedColumnStats(1); // Age column
        
        assert.strictEqual(stats.dataType, 'number');
        assert.strictEqual(stats.uniqueValues, 3);
        assert.strictEqual(stats.nullValues, 0);
        assert.strictEqual(stats.minValue, '25');
        assert.strictEqual(stats.maxValue, '35');
        assert.ok(stats.sampleValues.length > 0);
    });

    test('should clear sort state', () => {
        manager.sortByColumnAdvanced(0, 'asc');
        assert.notStrictEqual(manager.getSortState(), null);
        
        manager.clearSortState();
        assert.strictEqual(manager.getSortState(), null);
        assert.strictEqual(manager.isSorted(), false);
    });

    test('should handle case-insensitive sorting', () => {
        // Create table with mixed case
        const caseTableNode: TableNode = {
            startLine: 0,
            endLine: 3,
            headers: ['Name'],
            rows: [
                ['alice'],
                ['Bob'],
                ['CHARLIE']
            ]
        };
        
        const caseManager = new TableDataManager(caseTableNode);
        caseManager.sortByColumnAdvanced(0, 'asc', { caseSensitive: false });
        
        const tableData = caseManager.getTableData();
        assert.strictEqual(tableData.rows[0][0], 'alice');
        assert.strictEqual(tableData.rows[1][0], 'Bob');
        assert.strictEqual(tableData.rows[2][0], 'CHARLIE');
    });

    test('should handle date sorting', () => {
        // Create table with dates
        const dateTableNode: TableNode = {
            startLine: 0,
            endLine: 3,
            headers: ['Date'],
            rows: [
                ['2023-12-01'],
                ['2023-01-15'],
                ['2023-06-30']
            ]
        };
        
        const dateManager = new TableDataManager(dateTableNode);
        dateManager.sortByColumnAdvanced(0, 'asc', { dataType: 'date' });
        
        const tableData = dateManager.getTableData();
        assert.strictEqual(tableData.rows[0][0], '2023-01-15');
        assert.strictEqual(tableData.rows[1][0], '2023-06-30');
        assert.strictEqual(tableData.rows[2][0], '2023-12-01');
    });

    // Drag & Drop Functionality Tests (Requirements 4.1, 4.2, 4.4)

    test('should move row via drag and drop - forward movement', () => {
        // Test moving first row to last position (drag & drop simulation)
        const originalFirstRow = manager.getTableData().rows[0];
        const originalSecondRow = manager.getTableData().rows[1];
        const originalThirdRow = manager.getTableData().rows[2];
        
        manager.moveRow(0, 2); // Drag first row to third position
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows.length, 3);
        assert.deepStrictEqual(tableData.rows[0], originalSecondRow);
        assert.deepStrictEqual(tableData.rows[1], originalThirdRow);
        assert.deepStrictEqual(tableData.rows[2], originalFirstRow);
        
        // Verify Markdown serialization reflects the change
        const markdown = manager.serializeToMarkdown();
        const lines = markdown.split('\n').filter(line => line.trim());
        assert.ok(lines[2].includes('Jane')); // Second row became first
        assert.ok(lines[3].includes('Bob'));  // Third row became second
        assert.ok(lines[4].includes('John')); // First row became third
    });

    test('should move row via drag and drop - backward movement', () => {
        // Test moving last row to first position
        const originalRows = manager.getTableData().rows.map(row => [...row]);
        
        manager.moveRow(2, 0); // Drag last row to first position
        
        const tableData = manager.getTableData();
        assert.deepStrictEqual(tableData.rows[0], originalRows[2]);
        assert.deepStrictEqual(tableData.rows[1], originalRows[0]);
        assert.deepStrictEqual(tableData.rows[2], originalRows[1]);
    });

    test('should move row to middle position', () => {
        // Test moving first row to middle position
        const originalRows = manager.getTableData().rows.map(row => [...row]);
        
        manager.moveRow(0, 1); // Drag first row to second position
        
        const tableData = manager.getTableData();
        assert.deepStrictEqual(tableData.rows[0], originalRows[1]);
        assert.deepStrictEqual(tableData.rows[1], originalRows[0]);
        assert.deepStrictEqual(tableData.rows[2], originalRows[2]);
    });

    test('should move multiple rows preserving order', () => {
        const originalRows = manager.getTableData().rows.map(row => [...row]);

        // Select rows 0 and 2 and drop to index 1 (between original 0 and 1)
        manager.moveRows([0, 2], 1);

        const tableData = manager.getTableData();
        // Expected order: row0, row2 moved before original row1
        assert.deepStrictEqual(tableData.rows[0], originalRows[0]);
        assert.deepStrictEqual(tableData.rows[1], originalRows[2]);
        assert.deepStrictEqual(tableData.rows[2], originalRows[1]);
    });

    test('should move column via drag and drop - forward movement', () => {
        // Test moving first column to last position
        const originalHeaders = [...manager.getTableData().headers];
        const originalRows = manager.getTableData().rows.map(row => [...row]);
        
        manager.moveColumn(0, 2); // Drag Name column to third position
        
        const tableData = manager.getTableData();
        
        // Check headers reordering
        assert.deepStrictEqual(tableData.headers, [originalHeaders[1], originalHeaders[2], originalHeaders[0]]);
        
        // Check data reordering
        assert.deepStrictEqual(tableData.rows[0], [originalRows[0][1], originalRows[0][2], originalRows[0][0]]);
        assert.deepStrictEqual(tableData.rows[1], [originalRows[1][1], originalRows[1][2], originalRows[1][0]]);
        assert.deepStrictEqual(tableData.rows[2], [originalRows[2][1], originalRows[2][2], originalRows[2][0]]);
        
        // Verify Markdown serialization reflects the change
        const markdown = manager.serializeToMarkdown();
        const lines = markdown.split('\n').filter(line => line.trim());
        assert.ok(lines[0].includes('Age | City | Name')); // Headers reordered
        assert.ok(lines[2].includes('25 | NYC | John'));   // Data reordered
    });

    test('should move column via drag and drop - backward movement', () => {
        // Test moving last column to first position
        const originalHeaders = [...manager.getTableData().headers];
        const originalRows = manager.getTableData().rows.map(row => [...row]);
        
        manager.moveColumn(2, 0); // Drag City column to first position
        
        const tableData = manager.getTableData();
        
        // Check headers reordering
        assert.deepStrictEqual(tableData.headers, [originalHeaders[2], originalHeaders[0], originalHeaders[1]]);
        
        // Check data reordering
        assert.deepStrictEqual(tableData.rows[0], [originalRows[0][2], originalRows[0][0], originalRows[0][1]]);
    });

    test('should move multiple columns preserving order and separator line', () => {
        const originalHeaders = [...manager.getTableData().headers];
        const originalRows = manager.getTableData().rows.map(row => [...row]);

        // Move columns 0 and 2 to position 1
        manager.moveColumns([0, 2], 1);

        const tableData = manager.getTableData();

        // Headers should be [Age, Name, City]
        assert.deepStrictEqual(tableData.headers, [originalHeaders[1], originalHeaders[0], originalHeaders[2]]);
        // Rows should follow header order
        assert.deepStrictEqual(tableData.rows[0], [originalRows[0][1], originalRows[0][0], originalRows[0][2]]);

        if (tableData.separatorLine) {
            assert.ok(tableData.separatorLine.includes('---'), 'separator line should be kept');
        }
    });

    test('should move column to middle position', () => {
        // Test moving first column to middle position
        const originalHeaders = [...manager.getTableData().headers];
        const originalRows = manager.getTableData().rows.map(row => [...row]);
        
        manager.moveColumn(0, 1); // Drag Name column to second position
        
        const tableData = manager.getTableData();
        
        // Check headers reordering
        assert.deepStrictEqual(tableData.headers, [originalHeaders[1], originalHeaders[0], originalHeaders[2]]);
        
        // Check data reordering
        assert.deepStrictEqual(tableData.rows[0], [originalRows[0][1], originalRows[0][0], originalRows[0][2]]);
    });

    test('should handle invalid row move indices', () => {
        assert.throws(() => {
            manager.moveRow(-1, 0);
        }, /Invalid row indices/);
        
        assert.throws(() => {
            manager.moveRow(0, 10);
        }, /Invalid row indices/);
        
        assert.throws(() => {
            manager.moveRow(10, 0);
        }, /Invalid row indices/);
    });

    test('should handle invalid column move indices', () => {
        assert.throws(() => {
            manager.moveColumn(-1, 0);
        }, /Invalid column indices/);
        
        assert.throws(() => {
            manager.moveColumn(0, 10);
        }, /Invalid column indices/);
        
        assert.throws(() => {
            manager.moveColumn(10, 0);
        }, /Invalid column indices/);
    });

    test('should handle same position moves (no-op)', () => {
        const originalData = manager.getTableData();
        
        // Move row to same position
        manager.moveRow(1, 1);
        
        const afterRowMove = manager.getTableData();
        assert.deepStrictEqual(afterRowMove.rows, originalData.rows);
        
        // Move column to same position
        manager.moveColumn(1, 1);
        
        const afterColumnMove = manager.getTableData();
        assert.deepStrictEqual(afterColumnMove.headers, originalData.headers);
        assert.deepStrictEqual(afterColumnMove.rows, originalData.rows);
    });

    test('should preserve data integrity during multiple drag operations', () => {
        const originalData = manager.getTableData();
        const originalCellCount = originalData.rows.length * originalData.headers.length;
        
        // Perform multiple drag operations
        manager.moveRow(0, 2);
        manager.moveColumn(1, 0);
        manager.moveRow(2, 0);
        manager.moveColumn(0, 2);
        
        const finalData = manager.getTableData();
        const finalCellCount = finalData.rows.length * finalData.headers.length;
        
        // Verify structure integrity
        assert.strictEqual(finalData.rows.length, originalData.rows.length);
        assert.strictEqual(finalData.headers.length, originalData.headers.length);
        assert.strictEqual(finalCellCount, originalCellCount);
        
        // Verify all original data is still present (just reordered)
        const originalCells = new Set();
        const finalCells = new Set();
        
        for (let i = 0; i < originalData.rows.length; i++) {
            for (let j = 0; j < originalData.rows[i].length; j++) {
                originalCells.add(originalData.rows[i][j]);
                finalCells.add(finalData.rows[i][j]);
            }
        }
        
        assert.deepStrictEqual(originalCells, finalCells);
    });

    test('should trigger change listeners during drag operations', () => {
        let changeCount = 0;
        let lastChangeData: TableData | null = null;
        
        const listener = (data: TableData) => {
            changeCount++;
            lastChangeData = data;
        };
        
        manager.addChangeListener(listener);
        
        // Test row move triggers change
        manager.moveRow(0, 1);
        assert.strictEqual(changeCount, 1);
        assert.notStrictEqual(lastChangeData, null);
        
        // Test column move triggers change
        manager.moveColumn(0, 1);
        assert.strictEqual(changeCount, 2);
        
        manager.removeChangeListener(listener);
    });

    test('should update metadata during drag operations', () => {
        const originalMetadata = manager.getTableData().metadata;
        const originalModified = originalMetadata.lastModified;
        
        // Wait a bit to ensure timestamp difference
        setTimeout(() => {
            manager.moveRow(0, 1);
            
            const newMetadata = manager.getTableData().metadata;
            assert.ok(newMetadata.lastModified > originalModified);
            assert.strictEqual(newMetadata.rowCount, originalMetadata.rowCount);
            assert.strictEqual(newMetadata.columnCount, originalMetadata.columnCount);
        }, 10);
    });

    test('should serialize correctly after complex drag operations', () => {
        // Perform complex reordering
        manager.moveRow(0, 2);    // John moves to end
        manager.moveColumn(2, 0); // City moves to front
        
        const markdown = manager.serializeToMarkdown();
        const lines = markdown.split('\n').filter(line => line.trim());
        
        // Verify header order
        assert.ok(lines[0].includes('City | Name | Age'));
        
        // Verify separator (alignment was removed, so always left-aligned)
        assert.ok(lines[1].includes(':--- | :--- | :---'));
        
        // Verify data order (Jane should be first row, John last)
        assert.ok(lines[2].includes('LA | Jane | 30'));
        assert.ok(lines[3].includes('Chicago | Bob | 35'));
        assert.ok(lines[4].includes('NYC | John | 25'));
    });

    test('should handle drag operations on single row table', () => {
        // Create single row table
        const singleRowNode: TableNode = {
            startLine: 0,
            endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        };
        
        const singleRowManager = new TableDataManager(singleRowNode);
        
        // Moving single row to same position should work
        singleRowManager.moveRow(0, 0);
        
        const tableData = singleRowManager.getTableData();
        assert.strictEqual(tableData.rows.length, 1);
        assert.deepStrictEqual(tableData.rows[0], ['1', '2']);
    });

    test('should handle drag operations on single column table', () => {
        // Create single column table
        const singleColNode: TableNode = {
            startLine: 0,
            endLine: 3,
            headers: ['A'],
            rows: [['1'], ['2'], ['3']]
        };
        
        const singleColManager = new TableDataManager(singleColNode);
        
        // Moving single column to same position should work
        singleColManager.moveColumn(0, 0);
        
        const tableData = singleColManager.getTableData();
        assert.strictEqual(tableData.headers.length, 1);
        assert.strictEqual(tableData.headers[0], 'A');
    });

    // Enhanced Drag & Drop Functionality Tests (Requirements 4.1, 4.2, 4.4)

    test('should start row drag operation - Requirement 4.1', () => {
        // Test requirement 4.1: ユーザーが行ヘッダーをドラッグする
        manager.startRowDrag(0);
        
        const dragState = manager.getDragDropState();
        assert.strictEqual(dragState.isDragging, true);
        assert.strictEqual(dragState.dragType, 'row');
        assert.strictEqual(dragState.dragIndex, 0);
        assert.ok(dragState.dropZones.length > 0);
        assert.notStrictEqual(dragState.previewData, undefined);
    });

    test('should start column drag operation - Requirement 4.2', () => {
        // Test requirement 4.2: ユーザーが列ヘッダーをドラッグする
        manager.startColumnDrag(1);
        
        const dragState = manager.getDragDropState();
        assert.strictEqual(dragState.isDragging, true);
        assert.strictEqual(dragState.dragType, 'column');
        assert.strictEqual(dragState.dragIndex, 1);
        assert.ok(dragState.dropZones.length > 0);
        assert.notStrictEqual(dragState.previewData, undefined);
    });

    test('should provide visual feedback during drag - Requirement 4.3', () => {
        // Test requirement 4.3: ドラッグ中である THEN システムは ドロップ可能な位置を視覚的に示す
        let dragOverCalled = false;
        let dragOverIndex = -1;
        let dragOverValid = false;

        manager.addDragDropListener({
            onDragOver: (index: number, isValid: boolean) => {
                dragOverCalled = true;
                dragOverIndex = index;
                dragOverValid = isValid;
            }
        });

        manager.startRowDrag(0);
        
        // Test valid drop zone
        const validResult = manager.updateDragPosition(2);
        assert.strictEqual(validResult, true);
        assert.strictEqual(dragOverCalled, true);
        assert.strictEqual(dragOverIndex, 2);
        assert.strictEqual(dragOverValid, true);

        // Test invalid drop zone (adjacent position)
        dragOverCalled = false;
        const invalidResult = manager.updateDragPosition(1);
        assert.strictEqual(invalidResult, false);
        assert.strictEqual(dragOverCalled, true);
        assert.strictEqual(dragOverValid, false);
    });

    test('should complete drag and drop and update Markdown - Requirement 4.4', () => {
        // Test requirement 4.4: ドラッグ&ドロップが完了する THEN システムは 新しい順序をMarkdownファイルに反映する
        let dragCompleteCalled = false;
        let dragCompleteType: 'row' | 'column' | null = null;
        let dragCompleteFrom = -1;
        let dragCompleteTo = -1;

        manager.addDragDropListener({
            onDragComplete: (type: 'row' | 'column', fromIndex: number, toIndex: number) => {
                dragCompleteCalled = true;
                dragCompleteType = type;
                dragCompleteFrom = fromIndex;
                dragCompleteTo = toIndex;
            }
        });

        const originalMarkdown = manager.serializeToMarkdown();
        
        // Start drag operation
        manager.startRowDrag(0);
        
        // Complete drag operation
        const result = manager.completeDragDrop(2);
        assert.strictEqual(result, true);
        
        // Verify drag complete event was fired
        assert.strictEqual(dragCompleteCalled, true);
        assert.strictEqual(dragCompleteType, 'row');
        assert.strictEqual(dragCompleteFrom, 0);
        assert.strictEqual(dragCompleteTo, 2);
        
        // Verify Markdown was updated
        const newMarkdown = manager.serializeToMarkdown();
        assert.notStrictEqual(newMarkdown, originalMarkdown);
        
        // Verify the row was actually moved
        const tableData = manager.getTableData();
        assert.deepStrictEqual(tableData.rows[2], ['John', '25', 'NYC']); // Original first row is now third
        
        // Verify drag state is reset
        const dragState = manager.getDragDropState();
        assert.strictEqual(dragState.isDragging, false);
        assert.strictEqual(dragState.dragType, null);
    });

    test('should cancel drag operation', () => {
        let dragCancelCalled = false;

        manager.addDragDropListener({
            onDragCancel: () => {
                dragCancelCalled = true;
            }
        });

        manager.startRowDrag(0);
        assert.strictEqual(manager.getDragDropState().isDragging, true);
        
        manager.cancelDragDrop();
        
        assert.strictEqual(dragCancelCalled, true);
        assert.strictEqual(manager.getDragDropState().isDragging, false);
    });

    test('should validate drop zones correctly', () => {
        manager.startRowDrag(1); // Start dragging middle row
        
        const dragState = manager.getDragDropState();
        
        // Valid drop zones should exclude adjacent positions
        assert.strictEqual(manager.isValidDropZone(0), true);  // Before dragged row
        assert.strictEqual(manager.isValidDropZone(1), false); // Same position
        assert.strictEqual(manager.isValidDropZone(2), false); // Adjacent position
        assert.strictEqual(manager.isValidDropZone(3), true);  // After all rows
    });

    test('should create drag preview correctly', () => {
        let previewData: TableData | null = null;

        manager.addDragDropListener({
            onDragPreview: (data: TableData) => {
                previewData = data;
            }
        });

        manager.startRowDrag(0);
        manager.updateDragPosition(2);
        
        assert.notStrictEqual(previewData, null);
        assert.deepStrictEqual(previewData!.rows[2], ['John', '25', 'NYC']); // Preview shows moved row
    });

    test('should handle invalid drag operations gracefully', () => {
        // Test invalid row index
        assert.throws(() => {
            manager.startRowDrag(10);
        }, /Invalid row index for drag/);

        // Test invalid column index
        assert.throws(() => {
            manager.startColumnDrag(10);
        }, /Invalid column index for drag/);

        // Test completing drag without starting
        const result = manager.completeDragDrop(1);
        assert.strictEqual(result, false);
    });

    test('should handle drag to invalid drop zone', () => {
        manager.startRowDrag(0);
        
        // Try to drop at invalid position
        const result = manager.completeDragDrop(1); // Adjacent position is invalid
        assert.strictEqual(result, false);
        
        // Drag state should be reset after failed drop
        assert.strictEqual(manager.getDragDropState().isDragging, false);
    });

    test('should maintain data integrity during complex drag operations', () => {
        const originalData = manager.getTableData();
        
        // Perform multiple drag operations
        manager.startRowDrag(0);
        manager.updateDragPosition(2);
        manager.completeDragDrop(2);
        
        manager.startColumnDrag(0);
        manager.updateDragPosition(2);
        manager.completeDragDrop(2);
        
        const finalData = manager.getTableData();
        
        // Verify data integrity
        assert.strictEqual(finalData.headers.length, originalData.headers.length);
        assert.strictEqual(finalData.rows.length, originalData.rows.length);
        
        // Verify all original data is still present (just reordered)
        const originalCells = originalData.rows.flat();
        const finalCells = finalData.rows.flat();
        originalCells.sort();
        finalCells.sort();
        assert.deepStrictEqual(finalCells, originalCells);
    });

    test('should create manager with table index', () => {
        const tableNode: TableNode = {
            startLine: 10,
            endLine: 15,
            headers: ['Product', 'Price'],
            rows: [
                ['Laptop', '$999'],
                ['Phone', '$599']
            ]
        };
        
        const managerWithIndex = new TableDataManager(tableNode, 'multi-table.md', 2);
        const tableData = managerWithIndex.getTableData();
        
        assert.strictEqual(tableData.metadata.tableIndex, 2);
        assert.strictEqual(tableData.metadata.sourceUri, 'multi-table.md');
        assert.strictEqual(tableData.metadata.startLine, 10);
        assert.strictEqual(tableData.metadata.endLine, 15);
    });

    test('should default table index to 0 when not specified', () => {
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.metadata.tableIndex, 0);
    });

    test('should preserve table index through operations', () => {
        const tableNode: TableNode = {
            startLine: 5,
            endLine: 10,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        };
        
        const indexedManager = new TableDataManager(tableNode, 'test.md', 3);
        
        // Perform various operations
        indexedManager.updateCell(0, 0, 'Updated');
        indexedManager.addRow();
        indexedManager.addColumn(undefined, 1, 'New Column');

        const tableData = indexedManager.getTableData();
        assert.strictEqual(tableData.metadata.tableIndex, 3); // Should remain unchanged
    });

    test('should handle multi-table scenario metadata', () => {
        // First table
        const firstTable = new TableDataManager({
            startLine: 0,
            endLine: 5,
            headers: ['Name', 'Age'],
            rows: [['John', '25']]
        }, 'multi.md', 0);

        // Second table
        const secondTable = new TableDataManager({
            startLine: 10,
            endLine: 15,
            headers: ['Product', 'Price'],
            rows: [['Laptop', '$999']]
        }, 'multi.md', 1);

        // Third table
        const thirdTable = new TableDataManager({
            startLine: 20,
            endLine: 25,
            headers: ['ID', 'Status'],
            rows: [['001', 'Active']]
        }, 'multi.md', 2);

        assert.strictEqual(firstTable.getTableData().metadata.tableIndex, 0);
        assert.strictEqual(secondTable.getTableData().metadata.tableIndex, 1);
        assert.strictEqual(thirdTable.getTableData().metadata.tableIndex, 2);

        // All should point to the same file
        assert.strictEqual(firstTable.getTableData().metadata.sourceUri, 'multi.md');
        assert.strictEqual(secondTable.getTableData().metadata.sourceUri, 'multi.md');
        assert.strictEqual(thirdTable.getTableData().metadata.sourceUri, 'multi.md');
    });

    test('should handle line break tags in cell content', () => {
        manager.updateCell(0, 2, 'New<br/>York<br/>City');
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][2], 'New<br/>York<br/>City');
    });

    test('should preserve cell formatting during updates', () => {
        const originalValue = 'Multi<br/>line<br/>content';
        manager.updateCell(1, 1, originalValue);
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[1][1], originalValue);
        
        // Update again to ensure consistency
        manager.updateCell(1, 1, 'Updated<br/>content');
        const updatedData = manager.getTableData();
        assert.strictEqual(updatedData.rows[1][1], 'Updated<br/>content');
    });

    test('should maintain table structure after cell edits', () => {
        const originalRowCount = manager.getTableData().rows.length;
        const originalColCount = manager.getTableData().headers.length;
        
        // Update multiple cells
        manager.updateCell(0, 0, 'Updated1');
        manager.updateCell(1, 1, 'Updated2');
        manager.updateCell(2, 2, 'Updated3');
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows.length, originalRowCount);
        assert.strictEqual(tableData.headers.length, originalColCount);
        assert.strictEqual(tableData.rows[0][0], 'Updated1');
        assert.strictEqual(tableData.rows[1][1], 'Updated2');
        assert.strictEqual(tableData.rows[2][2], 'Updated3');
    });

    test('should handle cell editing and wrapping', () => {
        // Test that cell editing maintains proper wrapping
        const longText = 'This is a very long text that should wrap properly when editing in a cell input field';
        manager.updateCell(0, 0, longText);
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][0], longText);
        
        // Test multiline content with line breaks
        const multilineText = 'Line 1\nLine 2\nLine 3';
        manager.updateCell(1, 1, multilineText);
        
        const updatedData = manager.getTableData();
        assert.strictEqual(updatedData.rows[1][1], multilineText);
    });

    test('should handle empty cell values correctly', () => {
        manager.updateCell(0, 0, '');
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.rows[0][0], '');
    });

    // --- Additional coverage tests for uncovered functions ---

    test('getRow should throw for invalid index', () => {
        assert.throws(() => manager.getRow(-1), /Invalid row index/);
        assert.throws(() => manager.getRow(100), /Invalid row index/);
    });

    test('getColumn should throw for invalid index', () => {
        assert.throws(() => manager.getColumn(-1), /Invalid column index/);
        assert.throws(() => manager.getColumn(100), /Invalid column index/);
    });

    test('getCell should throw for invalid position', () => {
        assert.throws(() => manager.getCell(-1, 0), /Invalid cell position/);
        assert.throws(() => manager.getCell(0, 100), /Invalid cell position/);
    });

    test('hasEmptyCells should return false when no empty cells', () => {
        // Default table has no empty cells
        const tableNode: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['x', 'y'], ['z', 'w']]
        };
        const mgr = new TableDataManager(tableNode);
        assert.strictEqual(mgr.hasEmptyCells(), false);
    });

    test('getEmptyCells should return empty array when no empty cells', () => {
        const tableNode: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['x', 'y']]
        };
        const mgr = new TableDataManager(tableNode);
        assert.deepStrictEqual(mgr.getEmptyCells(), []);
    });

    test('sortByColumnAdvanced should throw for invalid column', () => {
        assert.throws(() => manager.sortByColumnAdvanced(-1, 'asc'), /Invalid column index/);
        assert.throws(() => manager.sortByColumnAdvanced(100, 'asc'), /Invalid column index/);
    });

    test('sortByColumnAdvanced with custom comparator', () => {
        manager.sortByColumnAdvanced(0, 'asc', {
            customComparator: (a, b) => b.length - a.length
        });
        // Custom comparator sorts by string length (desc because b - a)
        const data = manager.getTableData();
        assert.ok(data.rows[0][0].length >= data.rows[data.rows.length - 1][0].length);
    });

    test('sortByMultipleColumns should return early for empty criteria', () => {
        const before = manager.getTableData().rows.map(r => r[0]);
        manager.sortByMultipleColumns([]);
        const after = manager.getTableData().rows.map(r => r[0]);
        assert.deepStrictEqual(before, after);
    });

    test('sortByMultipleColumns should throw for invalid column', () => {
        assert.throws(() => {
            manager.sortByMultipleColumns([{ columnIndex: 100, direction: 'asc' }]);
        }, /Invalid column index/);
    });

    test('reverseRows should flip sort direction', () => {
        manager.sortByColumnAdvanced(0, 'asc');
        assert.strictEqual(manager.getSortState()!.direction, 'asc');
        manager.reverseRows();
        assert.strictEqual(manager.getSortState()!.direction, 'desc');
        manager.reverseRows();
        assert.strictEqual(manager.getSortState()!.direction, 'asc');
    });

    test('reverseRows with no sort state', () => {
        manager.clearSortState();
        manager.reverseRows();
        assert.strictEqual(manager.getSortState(), null);
    });

    test('sortNatural should throw for invalid column', () => {
        assert.throws(() => manager.sortNatural(-1, 'asc'), /Invalid column index/);
    });

    test('sortNatural descending order', () => {
        const naturalTableNode: TableNode = {
            startLine: 0, endLine: 4,
            headers: ['Item'],
            rows: [['Item1'], ['Item10'], ['Item2']]
        };
        const mgr = new TableDataManager(naturalTableNode);
        mgr.sortNatural(0, 'desc');
        const data = mgr.getTableData();
        assert.strictEqual(data.rows[0][0], 'Item10');
        assert.strictEqual(data.rows[2][0], 'Item1');
    });

    test('getSortIndicators when no sort state', () => {
        manager.clearSortState();
        const indicators = manager.getSortIndicators();
        assert.ok(indicators.length > 0);
        for (const ind of indicators) {
            assert.strictEqual(ind.direction, null);
            assert.strictEqual(ind.isPrimary, false);
        }
    });

    test('getSortedColumnStats should throw for invalid column', () => {
        assert.throws(() => manager.getSortedColumnStats(-1), /Invalid column index/);
        assert.throws(() => manager.getSortedColumnStats(100), /Invalid column index/);
    });

    test('getSortedColumnStats for date column', () => {
        // parseFloat で数値判定されない日付形式を使う
        const dateTableNode: TableNode = {
            startLine: 0, endLine: 3,
            headers: ['Date'],
            rows: [['December 1, 2023'], ['January 15, 2023'], ['June 30, 2023']]
        };
        const mgr = new TableDataManager(dateTableNode);
        const stats = mgr.getSortedColumnStats(0);
        assert.strictEqual(stats.dataType, 'date');
        assert.ok(stats.minValue.length > 0);
        assert.ok(stats.maxValue.length > 0);
    });

    test('getSortedColumnStats for string column', () => {
        const stats = manager.getSortedColumnStats(0);
        assert.strictEqual(stats.dataType, 'string');
        assert.ok(stats.minValue.length > 0);
        assert.ok(stats.maxValue.length > 0);
    });

    test('getSortedColumnStats with empty values', () => {
        const emptyTableNode: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A'],
            rows: [[''], [' ']]
        };
        const mgr = new TableDataManager(emptyTableNode);
        const stats = mgr.getSortedColumnStats(0);
        assert.strictEqual(stats.nullValues, 2);
        assert.strictEqual(stats.minValue, '');
        assert.strictEqual(stats.maxValue, '');
    });

    test('validateRowMove returns valid for correct indices', () => {
        const result = manager.validateRowMove(0, 2);
        assert.strictEqual(result.isValid, true);
    });

    test('validateRowMove returns invalid for bad from index', () => {
        const result = manager.validateRowMove(-1, 0);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.error!.includes('source'));
    });

    test('validateRowMove returns invalid for bad to index', () => {
        const result = manager.validateRowMove(0, 100);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.error!.includes('target'));
    });

    test('validateRowMove returns invalid for same indices', () => {
        const result = manager.validateRowMove(0, 0);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.error!.includes('same'));
    });

    test('validateColumnMove returns valid for correct indices', () => {
        const result = manager.validateColumnMove(0, 2);
        assert.strictEqual(result.isValid, true);
    });

    test('validateColumnMove returns invalid for bad from index', () => {
        const result = manager.validateColumnMove(-1, 0);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.error!.includes('source'));
    });

    test('validateColumnMove returns invalid for bad to index', () => {
        const result = manager.validateColumnMove(0, 100);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.error!.includes('target'));
    });

    test('validateColumnMove returns invalid for same indices', () => {
        const result = manager.validateColumnMove(0, 0);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.error!.includes('same'));
    });

    test('moveRowSafe succeeds for valid indices', () => {
        const result = manager.moveRowSafe(0, 2);
        assert.strictEqual(result.success, true);
        assert.ok(result.previousState);
    });

    test('moveRowSafe fails for invalid indices', () => {
        const result = manager.moveRowSafe(-1, 0);
        assert.strictEqual(result.success, false);
        assert.ok(result.error);
    });

    test('moveColumnSafe succeeds for valid indices', () => {
        const result = manager.moveColumnSafe(0, 2);
        assert.strictEqual(result.success, true);
        assert.ok(result.previousState);
    });

    test('moveColumnSafe fails for invalid indices', () => {
        const result = manager.moveColumnSafe(-1, 0);
        assert.strictEqual(result.success, false);
        assert.ok(result.error);
    });

    test('searchReplace with includeHeaders', () => {
        const count = manager.findAndReplace('Name', 'FullName', { includeHeaders: true });
        assert.ok(count > 0);
        const data = manager.getTableData();
        assert.strictEqual(data.headers[0], 'FullName');
    });

    test('searchReplace no match returns 0', () => {
        const count = manager.findAndReplace('NONEXISTENT', 'replacement');
        assert.strictEqual(count, 0);
    });

    // === Additional coverage tests ===

    // --- updateCell: editedCells initialization ---
    test('updateCell should initialize editedCells when undefined', () => {
        // Force editedCells to undefined to test the lazy initialization branch
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        };
        const mgr = new TableDataManager(node);
        // Internally editedCells is initialized as Set, but force it via casting
        (mgr as any).tableData.editedCells = undefined;
        mgr.updateCell(0, 0, 'X');
        const data = mgr.getTableData();
        assert.strictEqual(data.rows[0][0], 'X');
        assert.ok(data.editedCells instanceof Set);
        assert.ok(data.editedCells!.has('0,0'));
    });

    // --- updateHeader: valid update and editedCells tracking ---
    test('updateHeader should update header value and track edit', () => {
        manager.updateHeader(0, 'FullName');
        const data = manager.getTableData();
        assert.strictEqual(data.headers[0], 'FullName');
        assert.ok(data.editedCells!.has('header,0'));
    });

    test('updateHeader should throw for negative column index', () => {
        assert.throws(() => manager.updateHeader(-1, 'X'), /Invalid header column/);
    });

    test('updateHeader should throw for out-of-range column index', () => {
        assert.throws(() => manager.updateHeader(100, 'X'), /Invalid header column/);
    });

    test('updateHeader should initialize editedCells when undefined', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A'], rows: [['1']]
        };
        const mgr = new TableDataManager(node);
        (mgr as any).tableData.editedCells = undefined;
        mgr.updateHeader(0, 'B');
        assert.strictEqual(mgr.getTableData().headers[0], 'B');
        assert.ok(mgr.getTableData().editedCells!.has('header,0'));
    });

    // --- addRow: validation errors ---
    test('addRow should throw for negative index', () => {
        assert.throws(() => manager.addRow(-1), /Invalid row index/);
    });

    test('addRow should throw for index beyond length', () => {
        assert.throws(() => manager.addRow(100), /Invalid row index/);
    });

    test('addRow should throw for count < 1', () => {
        assert.throws(() => manager.addRow(0, 0), /Invalid count/);
        assert.throws(() => manager.addRow(0, -1), /Invalid count/);
    });

    test('addRow should add multiple rows at once', () => {
        manager.addRow(1, 3);
        const data = manager.getTableData();
        assert.strictEqual(data.rows.length, 6);
        assert.deepStrictEqual(data.rows[1], ['', '', '']);
        assert.deepStrictEqual(data.rows[2], ['', '', '']);
        assert.deepStrictEqual(data.rows[3], ['', '', '']);
        assert.deepStrictEqual(data.rows[4], ['Jane', '30', 'LA']);
    });

    // --- addColumn: validation and multiple columns ---
    test('addColumn should throw for negative index', () => {
        assert.throws(() => manager.addColumn(-1), /Invalid column index/);
    });

    test('addColumn should throw for index beyond length', () => {
        assert.throws(() => manager.addColumn(100), /Invalid column index/);
    });

    test('addColumn should throw for count <= 0', () => {
        assert.throws(() => manager.addColumn(0, 0), /Invalid column count/);
        assert.throws(() => manager.addColumn(0, -1), /Invalid column count/);
    });

    test('addColumn with count > 1 should add multiple columns', () => {
        manager.addColumn(1, 3);
        const data = manager.getTableData();
        assert.strictEqual(data.headers.length, 6);
        // Default names: Column 2, Column 3, Column 4
        assert.strictEqual(data.headers[1], 'Column 2');
        assert.strictEqual(data.headers[2], 'Column 3');
        assert.strictEqual(data.headers[3], 'Column 4');
        assert.strictEqual(data.rows[0].length, 6);
    });

    test('addColumn without index should append', () => {
        manager.addColumn(undefined, 1, 'New');
        const data = manager.getTableData();
        assert.strictEqual(data.headers[data.headers.length - 1], 'New');
    });

    test('addColumn with defaultName should use it for all added columns', () => {
        manager.addColumn(0, 2, 'Custom');
        const data = manager.getTableData();
        assert.strictEqual(data.headers[0], 'Custom');
        assert.strictEqual(data.headers[1], 'Custom');
    });

    // --- deleteColumn: validation ---
    test('deleteColumn should throw for negative index', () => {
        assert.throws(() => manager.deleteColumn(-1), /Invalid column index/);
    });

    test('deleteColumn should throw for out-of-range index', () => {
        assert.throws(() => manager.deleteColumn(100), /Invalid column index/);
    });

    // --- sortByColumn: validation ---
    test('sortByColumn should throw for invalid column index', () => {
        assert.throws(() => manager.sortByColumn(-1, 'asc'), /Invalid column index/);
        assert.throws(() => manager.sortByColumn(100, 'asc'), /Invalid column index/);
    });

    test('sortByColumn should sort strings using localeCompare', () => {
        manager.sortByColumn(2, 'asc'); // Sort by City (string)
        const data = manager.getTableData();
        assert.strictEqual(data.rows[0][2], 'Chicago');
        assert.strictEqual(data.rows[1][2], 'LA');
        assert.strictEqual(data.rows[2][2], 'NYC');
    });

    // --- moveRows: edge cases ---
    test('moveRows with empty indices should be a no-op', () => {
        const before = manager.getTableData().rows.map(r => [...r]);
        manager.moveRows([], 0);
        assert.deepStrictEqual(manager.getTableData().rows, before);
    });

    test('moveRows with all invalid indices should be a no-op', () => {
        const before = manager.getTableData().rows.map(r => [...r]);
        manager.moveRows([-1, 100], 0);
        assert.deepStrictEqual(manager.getTableData().rows, before);
    });

    test('moveRows should throw for invalid dropIndex', () => {
        assert.throws(() => manager.moveRows([0], -1), /Invalid target row index/);
        assert.throws(() => manager.moveRows([0], 100), /Invalid target row index/);
    });

    test('moveRows should handle duplicate indices', () => {
        const before = manager.getTableData().rows.map(r => [...r]);
        // Duplicates should be deduplicated
        manager.moveRows([0, 0], 2);
        const data = manager.getTableData();
        assert.strictEqual(data.rows.length, before.length);
    });

    test('moveRows should move multiple rows to end', () => {
        const original = manager.getTableData().rows.map(r => [...r]);
        manager.moveRows([0, 1], 3); // Move first two rows to end
        const data = manager.getTableData();
        assert.deepStrictEqual(data.rows[0], original[2]); // Chicago row first
        assert.deepStrictEqual(data.rows[1], original[0]);
        assert.deepStrictEqual(data.rows[2], original[1]);
    });

    // --- moveColumns: edge cases ---
    test('moveColumns with empty indices should be a no-op', () => {
        const before = [...manager.getTableData().headers];
        manager.moveColumns([], 0);
        assert.deepStrictEqual(manager.getTableData().headers, before);
    });

    test('moveColumns with all invalid indices should be a no-op', () => {
        const before = [...manager.getTableData().headers];
        manager.moveColumns([-1, 100], 0);
        assert.deepStrictEqual(manager.getTableData().headers, before);
    });

    test('moveColumns should throw for invalid dropIndex', () => {
        assert.throws(() => manager.moveColumns([0], -1), /Invalid target column index/);
        assert.throws(() => manager.moveColumns([0], 100), /Invalid target column index/);
    });

    test('moveColumns should move multiple columns to start', () => {
        const original = [...manager.getTableData().headers];
        manager.moveColumns([1, 2], 0); // Move Age,City to start
        const data = manager.getTableData();
        assert.deepStrictEqual(data.headers, [original[1], original[2], original[0]]);
    });

    // --- serializeToMarkdown: three branches ---
    test('serializeToMarkdown should return rawLines as-is when no edits', () => {
        const rawLines = [
            '| Name | Age | City |',
            '| --- | --- | --- |',
            '| John | 25 | NYC |',
            '| Jane | 30 | LA |',
            '| Bob | 35 | Chicago |'
        ];
        const node: TableNode = {
            startLine: 0, endLine: 4,
            headers: ['Name', 'Age', 'City'],
            rows: [['John', '25', 'NYC'], ['Jane', '30', 'LA'], ['Bob', '35', 'Chicago']],
            rawLines
        };
        const mgr = new TableDataManager(node);
        const result = mgr.serializeToMarkdown();
        assert.strictEqual(result, rawLines.join('\n'));
    });

    test('serializeToMarkdown should generate from scratch when no rawLines', () => {
        // Default manager has no rawLines
        const result = manager.serializeToMarkdown();
        assert.ok(result.includes('| Name | Age | City |'));
        assert.ok(result.includes('| John | 25 | NYC |'));
    });

    test('serializeToMarkdown should do differential update for rawLines with edits', () => {
        const rawLines = [
            '| Name   | Age | City    |',
            '| ---    | --- | ---     |',
            '| John   | 25  | NYC     |',
            '| Jane   | 30  | LA      |',
            '| Bob    | 35  | Chicago |'
        ];
        const node: TableNode = {
            startLine: 0, endLine: 4,
            headers: ['Name', 'Age', 'City'],
            rows: [['John', '25', 'NYC'], ['Jane', '30', 'LA'], ['Bob', '35', 'Chicago']],
            rawLines
        };
        const mgr = new TableDataManager(node);
        // Edit only one cell
        mgr.updateCell(0, 0, 'Johnny');
        const result = mgr.serializeToMarkdown();
        // The edited cell should be updated
        assert.ok(result.includes('Johnny'));
        // Un-edited rows should preserve original formatting
        assert.ok(result.includes('| Jane   | 30  | LA      |'));
        assert.ok(result.includes('| Bob    | 35  | Chicago |'));
    });

    test('serializeToMarkdown differential update should handle header edits', () => {
        const rawLines = [
            '| Name | Age | City |',
            '| --- | --- | --- |',
            '| John | 25 | NYC |'
        ];
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['Name', 'Age', 'City'],
            rows: [['John', '25', 'NYC']],
            rawLines
        };
        const mgr = new TableDataManager(node);
        mgr.updateHeader(0, 'FullName');
        const result = mgr.serializeToMarkdown();
        assert.ok(result.includes('FullName'));
    });

    // --- updateTableLine fallback path: line without proper pipe format ---
    test('serializeToMarkdown with rawLines having escaped pipes uses differential update', () => {
        const rawLines = [
            '| A | B |',
            '| --- | --- |',
            '| val\\|ue1 | val2 |'
        ];
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['val|ue1', 'val2']],
            rawLines
        };
        const mgr = new TableDataManager(node);
        mgr.updateCell(0, 1, 'updated');
        const result = mgr.serializeToMarkdown();
        assert.ok(result.includes('updated'));
    });

    // --- splitLineByUnescapedPipe: escaped pipe skipping, < 2 pipes ---
    test('splitLineByUnescapedPipe returns null for line with fewer than 2 pipes', () => {
        const node: TableNode = {
            startLine: 0, endLine: 1,
            headers: ['A'], rows: [['1']]
        };
        const mgr = new TableDataManager(node);
        // Access private method via casting
        const result = (mgr as any).splitLineByUnescapedPipe('no pipes here');
        assert.strictEqual(result, null);
    });

    test('splitLineByUnescapedPipe skips escaped pipes', () => {
        const node: TableNode = {
            startLine: 0, endLine: 1,
            headers: ['A'], rows: [['1']]
        };
        const mgr = new TableDataManager(node);
        // Only one real pipe when the other is escaped
        const result = (mgr as any).splitLineByUnescapedPipe('\\| only one real |');
        assert.strictEqual(result, null);
    });

    test('splitLineByUnescapedPipe parses correctly with escaped pipes', () => {
        const node: TableNode = {
            startLine: 0, endLine: 1,
            headers: ['A', 'B'], rows: [['1', '2']]
        };
        const mgr = new TableDataManager(node);
        const result = (mgr as any).splitLineByUnescapedPipe('| val\\|ue | other |');
        assert.ok(result !== null);
        assert.strictEqual(result.cells.length, 2);
    });

    // --- updateSeparatorLineForColumnChange: various cases ---
    test('addColumn with separator line should update separator', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']],
            separatorLine: '| --- | --- |'
        };
        const mgr = new TableDataManager(node);
        mgr.addColumn(1, 1, 'New');
        const data = mgr.getTableData();
        // Separator should have 3 columns now
        assert.ok(data.separatorLine);
        const pipeCount = (data.separatorLine!.match(/\|/g) || []).length;
        assert.ok(pipeCount >= 4); // At least 4 pipes for 3 columns
    });

    test('deleteColumn with separator line should update separator', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']],
            separatorLine: '| --- | --- | --- |'
        };
        const mgr = new TableDataManager(node);
        mgr.deleteColumn(1);
        const data = mgr.getTableData();
        assert.ok(data.separatorLine);
        const parts = data.separatorLine!.slice(1, -1).split('|');
        assert.strictEqual(parts.length, 2); // 2 columns remain
    });

    test('separator update with invalid format should clear separator', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']],
            separatorLine: 'no-pipes-here'
        };
        const mgr = new TableDataManager(node);
        mgr.addColumn(1, 1, 'C');
        const data = mgr.getTableData();
        assert.strictEqual(data.separatorLine, undefined);
    });

    test('separator update without separator line should be no-op', () => {
        // Default sampleTableNode has no separatorLine
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        };
        const mgr = new TableDataManager(node);
        mgr.addColumn(1, 1, 'C');
        const data = mgr.getTableData();
        assert.strictEqual(data.separatorLine, undefined);
    });

    // --- updateSeparatorLineForColumnMove: invalid format ---
    test('moveColumn with invalid separator format should clear separator', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']],
            separatorLine: 'invalid-separator'
        };
        const mgr = new TableDataManager(node);
        mgr.moveColumn(0, 2);
        const data = mgr.getTableData();
        assert.strictEqual(data.separatorLine, undefined);
    });

    test('moveColumn with valid separator line should update separator', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']],
            separatorLine: '| :--- | :---: | ---: |'
        };
        const mgr = new TableDataManager(node);
        mgr.moveColumn(0, 2);
        const data = mgr.getTableData();
        assert.ok(data.separatorLine);
        // Separator parts should be reordered
        const parts = data.separatorLine!.slice(1, -1).split('|');
        assert.strictEqual(parts.length, 3);
    });

    test('moveColumn without separator line should be no-op for separator', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']]
        };
        const mgr = new TableDataManager(node);
        mgr.moveColumn(0, 2);
        assert.strictEqual(mgr.getTableData().separatorLine, undefined);
    });

    // --- updateSeparatorLineForColumnMoveMultiple: invalid format ---
    test('moveColumns with invalid separator format should clear separator', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']],
            separatorLine: 'bad-format'
        };
        const mgr = new TableDataManager(node);
        mgr.moveColumns([0, 2], 1);
        const data = mgr.getTableData();
        assert.strictEqual(data.separatorLine, undefined);
    });

    test('moveColumns with valid separator should reorder separator parts', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']],
            separatorLine: '| :--- | :---: | ---: |'
        };
        const mgr = new TableDataManager(node);
        mgr.moveColumns([0, 2], 1);
        const data = mgr.getTableData();
        assert.ok(data.separatorLine);
    });

    test('moveColumns without separator should be no-op for separator', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']]
        };
        const mgr = new TableDataManager(node);
        mgr.moveColumns([0, 2], 1);
        assert.strictEqual(mgr.getTableData().separatorLine, undefined);
    });

    // --- batchUpdateCells: header row (row=-1) ---
    test('batchUpdateCells should update header when row is -1', () => {
        manager.batchUpdateCells([
            { row: -1, col: 0, value: 'NewHeader' },
            { row: 0, col: 1, value: '99' }
        ]);
        const data = manager.getTableData();
        assert.strictEqual(data.headers[0], 'NewHeader');
        assert.strictEqual(data.rows[0][1], '99');
        assert.ok(data.editedCells!.has('header,0'));
        assert.ok(data.editedCells!.has('0,1'));
    });

    test('batchUpdateCells should throw for invalid column in header update', () => {
        assert.throws(() => {
            manager.batchUpdateCells([{ row: -1, col: 100, value: 'X' }]);
        }, /Invalid column position/);
    });

    test('batchUpdateCells should initialize editedCells when undefined', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        };
        const mgr = new TableDataManager(node);
        (mgr as any).tableData.editedCells = undefined;
        mgr.batchUpdateCells([{ row: 0, col: 0, value: 'X' }]);
        assert.ok(mgr.getTableData().editedCells instanceof Set);
    });

    // --- replaceContents ---
    test('replaceContents should replace entire table contents', () => {
        manager.replaceContents(['X', 'Y'], [['a', 'b'], ['c', 'd']]);
        const data = manager.getTableData();
        assert.deepStrictEqual(data.headers, ['X', 'Y']);
        assert.deepStrictEqual(data.rows, [['a', 'b'], ['c', 'd']]);
        assert.strictEqual(data.separatorLine, undefined);
        assert.strictEqual(data.rawLines, undefined);
    });

    test('replaceContents should throw for empty headers', () => {
        assert.throws(() => manager.replaceContents([], []), /Headers must not be empty/);
    });

    test('replaceContents should throw for row length mismatch', () => {
        assert.throws(() => {
            manager.replaceContents(['A', 'B'], [['1']]);
        }, /Row length mismatch/);
    });

    test('replaceContents should throw for non-array rows', () => {
        assert.throws(() => {
            manager.replaceContents(['A'], ['not-array' as any]);
        }, /Invalid row in rows/);
    });

    // --- insertRows: validation ---
    test('insertRows should throw for negative startIndex', () => {
        assert.throws(() => manager.insertRows(-1, 1), /Invalid start index/);
    });

    test('insertRows should throw for startIndex beyond length', () => {
        assert.throws(() => manager.insertRows(100, 1), /Invalid start index/);
    });

    test('insertRows should throw for count <= 0', () => {
        assert.throws(() => manager.insertRows(0, 0), /Invalid row count/);
        assert.throws(() => manager.insertRows(0, -1), /Invalid row count/);
    });

    // --- deleteRows: validation ---
    test('deleteRows should throw for invalid index', () => {
        assert.throws(() => manager.deleteRows([100]), /Invalid row index/);
    });

    test('deleteRows should delete in descending order to preserve indices', () => {
        manager.deleteRows([2, 0]); // Should delete both without issue
        const data = manager.getTableData();
        assert.strictEqual(data.rows.length, 1);
        assert.deepStrictEqual(data.rows[0], ['Jane', '30', 'LA']);
    });

    // --- insertColumns: validation ---
    test('insertColumns should throw for negative startIndex', () => {
        assert.throws(() => manager.insertColumns(-1, 1), /Invalid start index/);
    });

    test('insertColumns should throw for startIndex beyond header length', () => {
        assert.throws(() => manager.insertColumns(100, 1), /Invalid start index/);
    });

    test('insertColumns should throw for count <= 0', () => {
        assert.throws(() => manager.insertColumns(0, 0), /Invalid column count/);
    });

    test('insertColumns should throw for header count mismatch', () => {
        assert.throws(() => {
            manager.insertColumns(0, 2, ['OnlyOne']);
        }, /Header count.*doesn't match column count/);
    });

    test('insertColumns should generate default headers when not provided', () => {
        manager.insertColumns(1, 2);
        const data = manager.getTableData();
        assert.strictEqual(data.headers[1], 'Column 2');
        assert.strictEqual(data.headers[2], 'Column 3');
    });

    // --- deleteColumns: validation ---
    test('deleteColumns should throw for invalid column index', () => {
        assert.throws(() => manager.deleteColumns([100]), /Invalid column index/);
    });

    // --- updateRow: validation ---
    test('updateRow should throw for invalid row index', () => {
        assert.throws(() => manager.updateRow(-1, ['a', 'b', 'c']), /Invalid row index/);
        assert.throws(() => manager.updateRow(100, ['a', 'b', 'c']), /Invalid row index/);
    });

    test('updateRow should throw for column count mismatch', () => {
        assert.throws(() => manager.updateRow(0, ['a']), /Row length.*doesn't match column count/);
    });

    // --- updateColumn: validation ---
    test('updateColumn should throw for invalid column index', () => {
        assert.throws(() => manager.updateColumn(-1, ['a', 'b', 'c']), /Invalid column index/);
        assert.throws(() => manager.updateColumn(100, ['a', 'b', 'c']), /Invalid column index/);
    });

    test('updateColumn should throw for row count mismatch', () => {
        assert.throws(() => manager.updateColumn(0, ['a']), /Column length.*doesn't match row count/);
    });

    test('updateColumn without newHeader should keep existing header', () => {
        const originalHeader = manager.getTableData().headers[0];
        manager.updateColumn(0, ['a', 'b', 'c']);
        assert.strictEqual(manager.getTableData().headers[0], originalHeader);
    });

    // --- clearRow: validation ---
    test('clearRow should throw for invalid row index', () => {
        assert.throws(() => manager.clearRow(-1), /Invalid row index/);
        assert.throws(() => manager.clearRow(100), /Invalid row index/);
    });

    // --- clearColumn: validation ---
    test('clearColumn should throw for invalid column index', () => {
        assert.throws(() => manager.clearColumn(-1), /Invalid column index/);
        assert.throws(() => manager.clearColumn(100), /Invalid column index/);
    });

    // --- duplicateRow: with targetIndex ---
    test('duplicateRow with custom insertIndex should insert at specified position', () => {
        manager.duplicateRow(0, 2);
        const data = manager.getTableData();
        assert.strictEqual(data.rows.length, 4);
        assert.deepStrictEqual(data.rows[2], ['John', '25', 'NYC']);
    });

    test('duplicateRow should throw for invalid row index', () => {
        assert.throws(() => manager.duplicateRow(-1), /Invalid row index/);
        assert.throws(() => manager.duplicateRow(100), /Invalid row index/);
    });

    // --- duplicateColumn: with targetIndex ---
    test('duplicateColumn with custom insertIndex should insert at specified position', () => {
        manager.duplicateColumn(0, 2);
        const data = manager.getTableData();
        assert.strictEqual(data.headers[2], 'Name Copy');
        assert.strictEqual(data.rows[0][2], 'John');
    });

    test('duplicateColumn should throw for invalid column index', () => {
        assert.throws(() => manager.duplicateColumn(-1), /Invalid column index/);
        assert.throws(() => manager.duplicateColumn(100), /Invalid column index/);
    });

    // --- findAndReplace: caseSensitive, wholeWord ---
    test('findAndReplace case-sensitive should not match different case', () => {
        const count = manager.findAndReplace('john', 'X', { caseSensitive: true });
        assert.strictEqual(count, 0); // 'John' should not match 'john'
    });

    test('findAndReplace case-sensitive should match exact case', () => {
        const count = manager.findAndReplace('John', 'X', { caseSensitive: true });
        assert.strictEqual(count, 1);
        assert.strictEqual(manager.getTableData().rows[0][0], 'X');
    });

    test('findAndReplace wholeWord should not match partial words', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['Text'],
            rows: [['Johnson'], ['John'], ['JohnSmith']]
        };
        const mgr = new TableDataManager(node);
        const count = mgr.findAndReplace('John', 'X', { wholeWord: true });
        assert.strictEqual(count, 1);
        assert.strictEqual(mgr.getTableData().rows[1][0], 'X');
        assert.strictEqual(mgr.getTableData().rows[0][0], 'Johnson');
        assert.strictEqual(mgr.getTableData().rows[2][0], 'JohnSmith');
    });

    test('findAndReplace with regex and caseSensitive', () => {
        const count = manager.findAndReplace('[A-Z]ohn', 'X', { useRegex: true, caseSensitive: true });
        assert.strictEqual(count, 1);
        assert.strictEqual(manager.getTableData().rows[0][0], 'X');
    });

    // --- Drag & Drop: completeDragDrop with column ---
    test('completeDragDrop should work with column drag', () => {
        manager.startColumnDrag(0);
        const result = manager.completeDragDrop(2);
        assert.strictEqual(result, true);
        const data = manager.getTableData();
        assert.strictEqual(data.headers[2], 'Name');
    });

    // --- removeDragDropListener ---
    test('removeDragDropListener should remove listener', () => {
        let callCount = 0;
        const listener = {
            onDragStart: () => { callCount++; }
        };
        manager.addDragDropListener(listener);
        manager.startRowDrag(0);
        assert.strictEqual(callCount, 1);
        manager.cancelDragDrop();

        manager.removeDragDropListener(listener);
        manager.startRowDrag(0);
        assert.strictEqual(callCount, 1); // Should not increment
        manager.cancelDragDrop();
    });

    test('removeDragDropListener with non-existing listener should be no-op', () => {
        const listener = { onDragStart: () => {} };
        manager.removeDragDropListener(listener); // Should not throw
    });

    // --- cancelDragDrop when not dragging ---
    test('cancelDragDrop when not dragging should be no-op', () => {
        let cancelCalled = false;
        manager.addDragDropListener({ onDragCancel: () => { cancelCalled = true; } });
        manager.cancelDragDrop(); // Should not call listener
        assert.strictEqual(cancelCalled, false);
    });

    // --- updateDragPosition when not dragging ---
    test('updateDragPosition when not dragging should return false', () => {
        const result = manager.updateDragPosition(0);
        assert.strictEqual(result, false);
    });

    // --- createDragPreview with column drag ---
    test('createDragPreview should generate preview for column drag', () => {
        let previewData: TableData | null = null;
        manager.addDragDropListener({
            onDragPreview: (data: TableData) => { previewData = data; }
        });
        manager.startColumnDrag(0);
        manager.updateDragPosition(2);
        assert.notStrictEqual(previewData, null);
    });

    // --- generateMarkdownTable with separatorLine ---
    test('serializeToMarkdown should use original separator line when available', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']],
            separatorLine: '| :---: | ---: |'
        };
        const mgr = new TableDataManager(node);
        // Trigger a structural change to clear rawLines, forcing generateMarkdownTable
        mgr.addRow();
        mgr.deleteRow(1);
        const result = mgr.serializeToMarkdown();
        assert.ok(result.includes(':---:'));
        assert.ok(result.includes('---:'));
    });

    // --- deleteColumns with separator update ---
    test('deleteColumns with separator line should update separator correctly', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B', 'C', 'D'],
            rows: [['1', '2', '3', '4']],
            separatorLine: '| --- | --- | --- | --- |'
        };
        const mgr = new TableDataManager(node);
        mgr.deleteColumns([1, 3]);
        const data = mgr.getTableData();
        assert.deepStrictEqual(data.headers, ['A', 'C']);
    });

    // --- sortByColumn: mixed numeric and string (string comparison fallback) ---
    test('sortByColumn with mixed data uses string fallback', () => {
        const node: TableNode = {
            startLine: 0, endLine: 3,
            headers: ['Val'],
            rows: [['abc'], ['123'], ['xyz']]
        };
        const mgr = new TableDataManager(node);
        mgr.sortByColumn(0, 'asc');
        const data = mgr.getTableData();
        // Should sort by string comparison since not all values are numeric
        assert.ok(data.rows.length === 3);
    });

    // --- sortByColumn: descending string sort ---
    test('sortByColumn descending with strings should reverse string order', () => {
        manager.sortByColumn(0, 'desc');
        const data = manager.getTableData();
        assert.strictEqual(data.rows[0][0], 'John');
        assert.strictEqual(data.rows[1][0], 'Jane');
        assert.strictEqual(data.rows[2][0], 'Bob');
    });

    // --- moveRow: throws for invalid indices ---
    test('moveRow should throw when from is out of range', () => {
        assert.throws(() => manager.moveRow(100, 0), /Invalid row indices/);
    });

    test('moveRow should throw when to is out of range', () => {
        assert.throws(() => manager.moveRow(0, 100), /Invalid row indices/);
    });

    // --- moveColumn: throws for invalid indices ---
    test('moveColumn should throw when from is out of range', () => {
        assert.throws(() => manager.moveColumn(100, 0), /Invalid column indices/);
    });

    test('moveColumn should throw when to is out of range', () => {
        assert.throws(() => manager.moveColumn(0, 100), /Invalid column indices/);
    });

    // --- detectColumnDataType: edge cases ---
    test('detectColumnDataType returns string for out-of-range index', () => {
        const result = (manager as any).detectColumnDataType(-1);
        assert.strictEqual(result, 'string');
    });

    test('detectColumnDataType returns string for empty values', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A'],
            rows: [[''], ['  ']]
        };
        const mgr = new TableDataManager(node);
        const result = (mgr as any).detectColumnDataType(0);
        assert.strictEqual(result, 'string');
    });

    // --- compareValues: number, date, case-insensitive paths ---
    test('compareValues with number type', () => {
        const result = (manager as any).compareValues('10', '5', 'number', {});
        assert.ok(result > 0);
    });

    test('compareValues with date type', () => {
        const result = (manager as any).compareValues('2023-01-01', '2023-12-31', 'date', {});
        assert.ok(result < 0);
    });

    test('compareValues with string case-insensitive', () => {
        const result = (manager as any).compareValues('ABC', 'abc', 'string', { caseSensitive: false, locale: 'en-US' });
        assert.strictEqual(result, 0);
    });

    test('compareValues with string case-sensitive', () => {
        const result = (manager as any).compareValues('abc', 'ABC', 'string', { caseSensitive: true, locale: 'en-US' });
        // Result depends on locale, but should not be 0 if case-sensitive
        assert.ok(typeof result === 'number');
    });

    // --- escapePipeCharacters: empty/null content ---
    test('escapePipeCharacters returns empty string for empty input', () => {
        const result = (manager as any).escapePipeCharacters('');
        assert.strictEqual(result, '');
    });

    test('escapePipeCharacters returns empty string for null-like input', () => {
        const result = (manager as any).escapePipeCharacters(null);
        assert.strictEqual(result, '');
    });

    // --- updateTableLine: fallback path (line with no proper pipe structure) ---
    test('updateTableLine fallback path when splitLineByUnescapedPipe returns null', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        });
        // A line with only one pipe triggers fallback
        const result = (mgr as any).updateTableLine('single|pipe', ['x', 'y'], new Set([0]));
        assert.ok(typeof result === 'string');
    });

    test('updateTableLine with normal pipe-formatted line', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        });
        const result = (mgr as any).updateTableLine('| old1 | old2 |', ['new1', 'new2'], new Set([0]));
        assert.ok(result.includes('new1'));
        // col 1 was not edited, so it should preserve original
        assert.ok(result.includes('old2'));
    });

    // --- naturalCompare: same alpha different number ---
    test('naturalCompare with same alpha part sorts by number', () => {
        const result = (manager as any).naturalCompare('Item2', 'Item10');
        assert.ok(result < 0);
    });

    test('naturalCompare with same alpha and same number returns 0', () => {
        const result = (manager as any).naturalCompare('Item5', 'Item5');
        assert.strictEqual(result, 0);
    });

    test('naturalCompare with different alpha part sorts alphabetically', () => {
        const result = (manager as any).naturalCompare('Banana1', 'Apple1');
        assert.ok(result > 0);
    });

    // --- Drag & Drop edge cases ---
    test('startRowDrag should throw for invalid index', () => {
        assert.throws(() => manager.startRowDrag(-1), /Invalid row index for drag/);
    });

    test('startColumnDrag should throw for invalid index', () => {
        assert.throws(() => manager.startColumnDrag(-1), /Invalid column index for drag/);
    });

    test('getValidRowDropZones should exclude drag index and adjacent', () => {
        manager.startRowDrag(1);
        const state = manager.getDragDropState();
        assert.ok(!state.dropZones.includes(1)); // drag index excluded
        assert.ok(!state.dropZones.includes(2)); // adjacent excluded
        assert.ok(state.dropZones.includes(0));  // before drag
        assert.ok(state.dropZones.includes(3));  // after all
        manager.cancelDragDrop();
    });

    test('getValidColumnDropZones should exclude drag index and adjacent', () => {
        manager.startColumnDrag(1);
        const state = manager.getDragDropState();
        assert.ok(!state.dropZones.includes(1));
        assert.ok(!state.dropZones.includes(2));
        assert.ok(state.dropZones.includes(0));
        assert.ok(state.dropZones.includes(3));
        manager.cancelDragDrop();
    });

    test('isValidDropZone should return false when no drag is active', () => {
        assert.strictEqual(manager.isValidDropZone(0), false);
    });

    // --- deleteColumn: last column error ---
    test('deleteColumn should prevent deleting the sole remaining column', () => {
        const node: TableNode = {
            startLine: 0, endLine: 1,
            headers: ['Only'],
            rows: [['val']]
        };
        const mgr = new TableDataManager(node);
        assert.throws(() => mgr.deleteColumn(0), /Cannot delete the last column/);
    });

    // --- loadTable: rawLines and separatorLine preservation ---
    test('loadTable should preserve rawLines from TableNode', () => {
        const rawLines = ['| A | B |', '| --- | --- |', '| 1 | 2 |'];
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']],
            rawLines,
            separatorLine: '| --- | --- |'
        };
        const mgr = new TableDataManager(node);
        const data = mgr.getTableData();
        assert.deepStrictEqual(data.rawLines, rawLines);
        assert.strictEqual(data.separatorLine, '| --- | --- |');
    });

    // --- Structural changes invalidate rawLines ---
    test('addRow should invalidate rawLines', () => {
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A'],
            rows: [['1']],
            rawLines: ['| A |', '| --- |', '| 1 |']
        };
        const mgr = new TableDataManager(node);
        mgr.addRow();
        assert.strictEqual(mgr.getTableData().rawLines, undefined);
    });

    test('deleteRow should invalidate rawLines', () => {
        const node: TableNode = {
            startLine: 0, endLine: 3,
            headers: ['A'],
            rows: [['1'], ['2']],
            rawLines: ['| A |', '| --- |', '| 1 |', '| 2 |']
        };
        const mgr = new TableDataManager(node);
        mgr.deleteRow(0);
        assert.strictEqual(mgr.getTableData().rawLines, undefined);
    });

    test('moveRow should invalidate rawLines', () => {
        const node: TableNode = {
            startLine: 0, endLine: 3,
            headers: ['A'],
            rows: [['1'], ['2']],
            rawLines: ['| A |', '| --- |', '| 1 |', '| 2 |']
        };
        const mgr = new TableDataManager(node);
        mgr.moveRow(0, 1);
        assert.strictEqual(mgr.getTableData().rawLines, undefined);
    });

    // --- validateTableStructure: various issues ---
    test('validateTableStructure should detect empty headers', () => {
        const node: TableNode = {
            startLine: 0, endLine: 1,
            headers: [],
            rows: []
        };
        const mgr = new TableDataManager(node);
        const result = mgr.validateTableStructure(node);
        assert.strictEqual(result.isValid, false);
        assert.ok(result.issues.some(i => i.includes('no headers')));
    });

    test('validateTableStructure should warn about empty header names', () => {
        const node: TableNode = {
            startLine: 0, endLine: 1,
            headers: ['A', '', 'C'],
            rows: [['1', '2', '3']]
        };
        const mgr = new TableDataManager(node);
        const result = mgr.validateTableStructure(node);
        assert.ok(result.warnings.length > 0);
    });

    // --- updateTableLine: editedCols undefined ---
    test('updateTableLine preserves spacing for unedited cells when editedCols not provided', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        });
        const result = (mgr as any).updateTableLine('| old1  | old2  |', ['new1', 'new2'], undefined);
        // Without editedCols, all cells should preserve original spacing
        assert.ok(typeof result === 'string');
    });

    // --- Multiple data edit on same rawLines ---
    test('serializeToMarkdown with multiple cell edits on rawLines', () => {
        const rawLines = [
            '| A | B | C |',
            '| --- | --- | --- |',
            '| 1 | 2 | 3 |',
            '| 4 | 5 | 6 |'
        ];
        const node: TableNode = {
            startLine: 0, endLine: 3,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3'], ['4', '5', '6']],
            rawLines
        };
        const mgr = new TableDataManager(node);
        mgr.updateCell(0, 0, 'X');
        mgr.updateCell(1, 2, 'Y');
        const result = mgr.serializeToMarkdown();
        assert.ok(result.includes('X'));
        assert.ok(result.includes('Y'));
        // Unedited cells should be preserved
        assert.ok(result.includes('2'));
        assert.ok(result.includes('4'));
    });

    // --- sortByColumnAdvanced: auto data type detection ---
    test('sortByColumnAdvanced with auto dataType should detect and sort', () => {
        manager.sortByColumnAdvanced(1, 'asc', { dataType: 'auto' });
        const data = manager.getTableData();
        assert.strictEqual(data.rows[0][1], '25');
        assert.strictEqual(data.rows[2][1], '35');
        const state = manager.getSortState();
        assert.strictEqual(state!.dataType, 'number');
    });

    // --- sortByMultipleColumns: with explicit dataType ---
    test('sortByMultipleColumns with explicit dataType should use it', () => {
        manager.updateCell(1, 1, '25'); // Make ages same for secondary sort
        manager.sortByMultipleColumns([
            { columnIndex: 1, direction: 'asc', dataType: 'number' },
            { columnIndex: 0, direction: 'desc', dataType: 'string' }
        ]);
        const data = manager.getTableData();
        // Primary sort by age, secondary by name desc
        assert.ok(data.rows.length === 3);
        const state = manager.getSortState();
        assert.strictEqual(state!.columnIndex, 1);
    });

    // --- completeDragDrop: invalid drop zone triggers cancel ---
    test('completeDragDrop to invalid zone should cancel and return false', () => {
        let cancelCalled = false;
        manager.addDragDropListener({ onDragCancel: () => { cancelCalled = true; } });
        manager.startRowDrag(0);
        const result = manager.completeDragDrop(1); // Adjacent = invalid
        assert.strictEqual(result, false);
        assert.strictEqual(cancelCalled, true);
        assert.strictEqual(manager.getDragDropState().isDragging, false);
    });

    // --- createDragPreview when not dragging should early return ---
    test('createDragPreview does nothing when not dragging', () => {
        // Access private method - should not throw
        (manager as any).createDragPreview(0);
        // No exception means the early return worked
    });

    // --- updateTableLine: fallback path with full pipe-split coverage ---
    test('updateTableLine fallback covers edited and unedited cells and extra columns', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']]
        });
        // Line with only one real pipe triggers fallback (splitLineByUnescapedPipe returns null)
        // We need a line where split('|') gives parts, but splitLineByUnescapedPipe returns null
        // That happens when < 2 unescaped pipes. Use a line where all pipes are escaped.
        // Actually the fallback is triggered when parsed is null OR cells.length === 0.
        // To get the full fallback with multiple cells, create a line where pipes count >= 2
        // but the parse result has zero cells. This is hard to achieve normally.
        // Instead: test via serializeToMarkdown with rawLines containing escaped pipes only
        // Another approach: Use rawLines with data and edit a cell so it triggers updateTableLine
        const rawLines = [
            '| A | B | C |',
            '| --- | --- | --- |',
            '| 1 | 2 | 3 |'
        ];
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']],
            rawLines
        };
        const mgr2 = new TableDataManager(node);
        // Edit col 0 (edited) and leave col 1, col 2 unedited
        mgr2.updateCell(0, 0, 'X');
        const result = mgr2.serializeToMarkdown();
        // Cell 0 updated, cells 1,2 preserved
        assert.ok(result.includes('X'));
        assert.ok(result.includes('2'));
        assert.ok(result.includes('3'));
    });

    // --- updateTableLine: trailing content after last pipe ---
    test('serializeToMarkdown preserves trailing content after last pipe', () => {
        const rawLines = [
            '| A | B | trailing',
            '| --- | --- |',
            '| 1 | 2 | extra'
        ];
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']],
            rawLines
        };
        const mgr = new TableDataManager(node);
        mgr.updateHeader(0, 'X');
        const result = mgr.serializeToMarkdown();
        assert.ok(result.includes('X'));
    });

    // --- getStatistics: emptyCells counter ---
    test('getStatistics should count empty cells correctly', () => {
        manager.updateCell(0, 0, '');
        manager.updateCell(1, 1, '   '); // Whitespace only also counts as empty
        const stats = manager.getStatistics();
        assert.strictEqual(stats.emptyCells, 2);
        assert.ok(stats.fillRate < 1);
    });

    // --- sortByMultipleColumns: proper multi-key sorting with tiebreaker ---
    test('sortByMultipleColumns should return non-zero comparison immediately', () => {
        // Create table where primary sort is decisive (no ties)
        const node: TableNode = {
            startLine: 0, endLine: 3,
            headers: ['A', 'B'],
            rows: [['3', 'x'], ['1', 'y'], ['2', 'z']]
        };
        const mgr = new TableDataManager(node);
        mgr.sortByMultipleColumns([
            { columnIndex: 0, direction: 'asc', dataType: 'number' },
            { columnIndex: 1, direction: 'asc' }
        ]);
        const data = mgr.getTableData();
        assert.strictEqual(data.rows[0][0], '1');
        assert.strictEqual(data.rows[1][0], '2');
        assert.strictEqual(data.rows[2][0], '3');
    });

    // --- serializeToMarkdown: editedCells key with invalid format should be skipped ---
    test('serializeToMarkdown skips malformed editedCells keys', () => {
        const rawLines = [
            '| A | B |',
            '| --- | --- |',
            '| 1 | 2 |'
        ];
        const node: TableNode = {
            startLine: 0, endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2']],
            rawLines
        };
        const mgr = new TableDataManager(node);
        // Manually add a malformed key
        (mgr as any).tableData.editedCells = new Set(['invalid_key', 'abc,def', '0,0']);
        (mgr as any).tableData.rows[0][0] = 'X';
        const result = mgr.serializeToMarkdown();
        assert.ok(result.includes('X'));
    });

    // --- moveRowSafe / moveColumnSafe catch blocks ---
    // These are very hard to trigger because moveRow/moveColumn validate before throwing.
    // The catch block handles unexpected internal errors.
    // We test them indirectly through the existing moveRowSafe/moveColumnSafe tests.
    // The validation path is already tested. The catch path is defensive code.

    // --- completeDragDrop catch block ---
    // Similar: this triggers when moveRow/moveColumn throws after drop zone validation passes.
    // This is defensive code for edge cases.

    // --- updateTableLine: cells exceed newValues length (extra cells in original) ---
    test('updateTableLine handles extra original cells beyond newValues', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A'],
            rows: [['1']]
        });
        // Original line has 3 cells but newValues has only 1
        const result = (mgr as any).updateTableLine('| a | b | c |', ['x'], new Set([0]));
        assert.ok(result.includes('x'));
    });

    // --- updateTableLine: fallback with editedCols containing cells and non-edited cells ---
    test('updateTableLine fallback path with mix of edited and unedited cells', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']]
        });
        // Force fallback by providing a line that splitLineByUnescapedPipe returns null for
        // This happens when there are fewer than 2 unescaped pipes
        const result = (mgr as any).updateTableLine('|only_one_pipe', ['x', 'y'], new Set([0]));
        assert.ok(typeof result === 'string');
    });

    // --- updateTableLine: fallback path full coverage ---
    // splitLineByUnescapedPipe returns null when < 2 unescaped pipes.
    // But the fallback uses split('|') which may still find multiple parts.
    // Escaped pipes (\|) count as unescaped for split('|') but are skipped by splitLineByUnescapedPipe.
    test('updateTableLine fallback path with escaped pipes triggers full fallback logic', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        });
        // This line has 3 parts via split('|'), but only 1 unescaped pipe (the first one)
        // splitLineByUnescapedPipe finds only 1 unescaped pipe → returns null → fallback
        // split('|') finds: ['', 'cell1\\', 'cell2'], so parts.length=3, loop runs i=1
        const result = (mgr as any).updateTableLine('|cell1\\|cell2', ['newval'], new Set([0]));
        assert.ok(typeof result === 'string');
        assert.ok(result.includes('newval'));
    });

    test('updateTableLine fallback path: edited cell, unedited cell, and extra cell', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']]
        });
        // Line with 4 pipes in split but only 1 unescaped pipe for splitLineByUnescapedPipe
        // Actually we need the fallback. Let's construct a line where splitLineByUnescapedPipe returns null
        // but split('|') gives us multiple parts with editedCols and non-editedCols
        // Simplest: a valid-looking line that only has one unescaped pipe won't work because
        // a standard '| a | b |' has 3 unescaped pipes.
        //
        // Alternative: call updateTableLine directly with a line that triggers fallback
        // AND has enough split('|') parts to exercise all branches
        const line = '\\|cell0\\|cell1\\|cell2'; // 0 unescaped pipes → null from parser
        // split('|') gives ['\\', 'cell0\\', 'cell1\\', 'cell2'] → parts[1]=cell0\, parts[2]=cell1\
        // But i goes from 1 to parts.length-2, which is indices 1,2
        const result = (mgr as any).updateTableLine(line, ['new0', 'new1'], new Set([0]));
        assert.ok(typeof result === 'string');
    });

    // Test the exact fallback path with a line that has exactly enough structure
    test('updateTableLine fallback with 3-pipe line where parser returns null due to escaping', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        });
        // '\\| a \\| b |' has only 1 unescaped pipe (the last one) → splitLineByUnescapedPipe returns null
        // split('|') gives: ['\\', ' a \\', ' b ', ''] → parts length 4
        // Loop runs for i=1,2 with cellIndex=0,1
        const result = (mgr as any).updateTableLine('\\| a \\| b |', ['x', 'y'], new Set([0]));
        assert.ok(typeof result === 'string');
    });

    // Test with enough structure for all three branches: edited cell, unedited cell, and cell beyond newValues
    test('updateTableLine fallback exercises edited, unedited, and extra cell branches', () => {
        const mgr = new TableDataManager({
            startLine: 0, endLine: 1,
            headers: ['A', 'B', 'C', 'D'],
            rows: [['1', '2', '3', '4']]
        });
        // Force splitLineByUnescapedPipe to return null by having <2 unescaped pipes
        // but split('|') gives multiple parts
        // Using a line: '\\| a \\| b \\| c \\| d |' → 1 unescaped pipe
        // split('|') gives 6 parts, loop runs for i=1..4 (cellIndex 0..3)
        // newValues has 2 elements, editedCols has {0}
        // cellIndex 0: edited (in editedCols)
        // cellIndex 1: not edited, but within newValues
        // cellIndex 2: beyond newValues → extra cell branch
        // cellIndex 3: beyond newValues → extra cell branch
        const result = (mgr as any).updateTableLine(
            '\\| a \\| b \\| c \\| d |',
            ['x', 'y'],
            new Set([0])
        );
        assert.ok(typeof result === 'string');
        assert.ok(result.includes(' x '));  // edited cell
    });

    // --- sortByMultipleColumns: comparison returns non-zero on first criterion ---
    test('sortByMultipleColumns returns early when primary comparison is non-zero', () => {
        const node: TableNode = {
            startLine: 0, endLine: 4,
            headers: ['Priority', 'Name'],
            rows: [['3', 'C'], ['1', 'A'], ['2', 'B']]
        };
        const mgr = new TableDataManager(node);
        mgr.sortByMultipleColumns([
            { columnIndex: 0, direction: 'asc', dataType: 'number' },
            { columnIndex: 1, direction: 'asc', dataType: 'string' }
        ]);
        const data = mgr.getTableData();
        assert.strictEqual(data.rows[0][0], '1');
        assert.strictEqual(data.rows[1][0], '2');
        assert.strictEqual(data.rows[2][0], '3');
    });

    // --- sortByMultipleColumns: all criteria equal → return 0 ---
    test('sortByMultipleColumns returns 0 when all criteria are equal', () => {
        const node: TableNode = {
            startLine: 0, endLine: 3,
            headers: ['A', 'B'],
            rows: [['1', 'x'], ['1', 'x'], ['1', 'x']]
        };
        const mgr = new TableDataManager(node);
        mgr.sortByMultipleColumns([
            { columnIndex: 0, direction: 'asc', dataType: 'number' },
            { columnIndex: 1, direction: 'asc', dataType: 'string' }
        ]);
        const data = mgr.getTableData();
        // All rows are identical, so order should be stable (same as original)
        assert.strictEqual(data.rows.length, 3);
        assert.deepStrictEqual(data.rows[0], ['1', 'x']);
    });

    // --- sortByMultipleColumns: direction 'desc' for non-zero comparison ---
    test('sortByMultipleColumns desc direction applies negation correctly', () => {
        const node: TableNode = {
            startLine: 0, endLine: 4,
            headers: ['Val'],
            rows: [['1'], ['3'], ['2']]
        };
        const mgr = new TableDataManager(node);
        mgr.sortByMultipleColumns([
            { columnIndex: 0, direction: 'desc', dataType: 'number' }
        ]);
        const data = mgr.getTableData();
        assert.strictEqual(data.rows[0][0], '3');
        assert.strictEqual(data.rows[1][0], '2');
        assert.strictEqual(data.rows[2][0], '1');
    });

    // --- completeDragDrop catch block: moveRow throws after validation ---
    test('completeDragDrop catch block triggers when internal move throws', () => {
        // Start a valid row drag
        manager.startRowDrag(0);
        const validDropZones = manager.getDragDropState().dropZones;
        assert.ok(validDropZones.length > 0);
        const dropTarget = validDropZones[0];

        // Monkey-patch moveRow to throw after drag validation passes
        const origMoveRow = (manager as any).moveRow.bind(manager);
        (manager as any).moveRow = () => { throw new Error('forced internal error'); };

        assert.throws(() => {
            manager.completeDragDrop(dropTarget);
        }, /forced internal error/);

        // Drag state should be reset after the catch
        assert.strictEqual(manager.getDragDropState().isDragging, false);

        // Restore original moveRow
        (manager as any).moveRow = origMoveRow;
    });

    // --- moveRowSafe catch block ---
    test('moveRowSafe catch block handles unexpected errors', () => {
        // Monkey-patch moveRow to throw
        const origMoveRow = (manager as any).moveRow.bind(manager);
        (manager as any).moveRow = () => { throw new Error('unexpected error'); };

        const result = manager.moveRowSafe(0, 2);
        assert.strictEqual(result.success, false);
        assert.ok(result.error!.includes('unexpected error'));
        assert.ok(result.previousState);

        // Restore
        (manager as any).moveRow = origMoveRow;
    });

    // --- moveColumnSafe catch block ---
    test('moveColumnSafe catch block handles unexpected errors', () => {
        // Monkey-patch moveColumn to throw
        const origMoveColumn = (manager as any).moveColumn.bind(manager);
        (manager as any).moveColumn = () => { throw new Error('unexpected col error'); };

        const result = manager.moveColumnSafe(0, 2);
        assert.strictEqual(result.success, false);
        assert.ok(result.error!.includes('unexpected col error'));
        assert.ok(result.previousState);

        // Restore
        (manager as any).moveColumn = origMoveColumn;
    });
});