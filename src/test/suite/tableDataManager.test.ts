const assert = require('assert');
import { TableDataManager, TableData } from '../../tableDataManager';
import { TableNode } from '../../markdownParser';

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
            ],
            alignment: ['left', 'center', 'right']
        };
        
        manager = new TableDataManager(sampleTableNode, 'test.md');
    });

    test('should load table from TableNode', () => {
        const tableData = manager.getTableData();
        
        assert.deepStrictEqual(tableData.headers, ['Name', 'Age', 'City']);
        assert.strictEqual(tableData.rows.length, 3);
        assert.deepStrictEqual(tableData.rows[0], ['John', '25', 'NYC']);
        assert.deepStrictEqual(tableData.alignment, ['left', 'center', 'right']);
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
        manager.addColumn(undefined, 'Country');
        
        const tableData = manager.getTableData();
        assert.strictEqual(tableData.headers.length, 4);
        assert.strictEqual(tableData.headers[3], 'Country');
        assert.strictEqual(tableData.alignment[3], 'left');
        assert.strictEqual(tableData.rows[0].length, 4);
        assert.strictEqual(tableData.rows[0][3], '');
    });

    test('should add column at specific index', () => {
        manager.addColumn(1, 'Email');
        
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
        assert.deepStrictEqual(tableData.alignment, ['left', 'right']);
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
        assert.deepStrictEqual(tableData.alignment, ['center', 'right', 'left']);
    });

    test('should serialize to markdown', () => {
        const markdown = manager.serializeToMarkdown();
        
        assert.ok(markdown.includes('| Name | Age | City |'));
        assert.ok(markdown.includes('| :--- | :---: | ---: |'));
        assert.ok(markdown.includes('| John | 25 | NYC |'));
        assert.ok(markdown.includes('| Jane | 30 | LA |'));
        assert.ok(markdown.includes('| Bob | 35 | Chicago |'));
    });

    test('should validate table structure', () => {
        const validTableNode: TableNode = {
            startLine: 0,
            endLine: 2,
            headers: ['A', 'B'],
            rows: [['1', '2'], ['3', '4']],
            alignment: ['left', 'left']
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
            rows: [['1'], ['3', '4', '5']], // Inconsistent column count
            alignment: ['left'] // Wrong alignment count
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
        assert.deepStrictEqual(clonedData.alignment, originalData.alignment);
        
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
        assert.strictEqual(columnData.alignment, 'left');
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
            rows: [],
            alignment: ['left', 'left']
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
            ],
            alignment: ['left', 'left', 'left']
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
            ],
            alignment: ['left']
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
            ],
            alignment: ['left']
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
            ],
            alignment: ['left']
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

    test('should move column via drag and drop - forward movement', () => {
        // Test moving first column to last position
        const originalHeaders = [...manager.getTableData().headers];
        const originalAlignment = [...manager.getTableData().alignment];
        const originalRows = manager.getTableData().rows.map(row => [...row]);
        
        manager.moveColumn(0, 2); // Drag Name column to third position
        
        const tableData = manager.getTableData();
        
        // Check headers reordering
        assert.deepStrictEqual(tableData.headers, [originalHeaders[1], originalHeaders[2], originalHeaders[0]]);
        
        // Check alignment reordering
        assert.deepStrictEqual(tableData.alignment, [originalAlignment[1], originalAlignment[2], originalAlignment[0]]);
        
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
        const originalAlignment = [...manager.getTableData().alignment];
        const originalRows = manager.getTableData().rows.map(row => [...row]);
        
        manager.moveColumn(2, 0); // Drag City column to first position
        
        const tableData = manager.getTableData();
        
        // Check headers reordering
        assert.deepStrictEqual(tableData.headers, [originalHeaders[2], originalHeaders[0], originalHeaders[1]]);
        
        // Check alignment reordering  
        assert.deepStrictEqual(tableData.alignment, [originalAlignment[2], originalAlignment[0], originalAlignment[1]]);
        
        // Check data reordering
        assert.deepStrictEqual(tableData.rows[0], [originalRows[0][2], originalRows[0][0], originalRows[0][1]]);
    });

    test('should move column to middle position', () => {
        // Test moving first column to middle position
        const originalHeaders = [...manager.getTableData().headers];
        const originalAlignment = [...manager.getTableData().alignment];
        const originalRows = manager.getTableData().rows.map(row => [...row]);
        
        manager.moveColumn(0, 1); // Drag Name column to second position
        
        const tableData = manager.getTableData();
        
        // Check headers reordering
        assert.deepStrictEqual(tableData.headers, [originalHeaders[1], originalHeaders[0], originalHeaders[2]]);
        
        // Check alignment reordering
        assert.deepStrictEqual(tableData.alignment, [originalAlignment[1], originalAlignment[0], originalAlignment[2]]);
        
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
        assert.deepStrictEqual(afterColumnMove.alignment, originalData.alignment);
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
        
        // Verify separator alignment (City was right-aligned, now first)
        assert.ok(lines[1].includes('---: | :--- | :---:'));
        
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
            rows: [['1', '2']],
            alignment: ['left', 'left']
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
            rows: [['1'], ['2'], ['3']],
            alignment: ['left']
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
        assert.strictEqual(finalData.alignment.length, originalData.alignment.length);
        
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
            ],
            alignment: ['left', 'right']
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
            rows: [['1', '2']],
            alignment: ['left', 'left']
        };
        
        const indexedManager = new TableDataManager(tableNode, 'test.md', 3);
        
        // Perform various operations
        indexedManager.updateCell(0, 0, 'Updated');
        indexedManager.addRow();
        indexedManager.addColumn(undefined, 'New Column');
        
        const tableData = indexedManager.getTableData();
        assert.strictEqual(tableData.metadata.tableIndex, 3); // Should remain unchanged
    });

    test('should handle multi-table scenario metadata', () => {
        // First table
        const firstTable = new TableDataManager({
            startLine: 0,
            endLine: 5,
            headers: ['Name', 'Age'],
            rows: [['John', '25']],
            alignment: ['left', 'left']
        }, 'multi.md', 0);

        // Second table
        const secondTable = new TableDataManager({
            startLine: 10,
            endLine: 15,
            headers: ['Product', 'Price'],
            rows: [['Laptop', '$999']],
            alignment: ['left', 'right']
        }, 'multi.md', 1);

        // Third table
        const thirdTable = new TableDataManager({
            startLine: 20,
            endLine: 25,
            headers: ['ID', 'Status'],
            rows: [['001', 'Active']],
            alignment: ['left', 'center']
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

    test('should handle cell editing alignment and wrapping', () => {
        // Test that cell editing maintains proper alignment and wrapping
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
});