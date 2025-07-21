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
});