import { TableNode } from './markdownParser';

/**
 * Enhanced table data interface with metadata
 */
export interface TableData {
    id: string;
    headers: string[];
    rows: string[][];
    alignment: ('left' | 'center' | 'right')[];
    metadata: TableMetadata;
}

/**
 * Table metadata interface
 */
export interface TableMetadata {
    sourceUri: string;
    startLine: number;
    endLine: number;
    lastModified: Date;
    columnCount: number;
    rowCount: number;
    isValid: boolean;
    validationIssues: string[];
}

/**
 * Table data validation result
 */
export interface ValidationResult {
    isValid: boolean;
    issues: string[];
    warnings: string[];
}

/**
 * Table data manager class for handling table operations
 */
export class TableDataManager {
    private tableData: TableData;
    private changeListeners: Array<(data: TableData) => void> = [];

    constructor(tableNode: TableNode, sourceUri: string = '') {
        this.tableData = this.loadTable(tableNode, sourceUri);
    }

    /**
     * Load table from TableNode
     */
    loadTable(tableNode: TableNode, sourceUri: string = ''): TableData {
        const id = this.generateTableId();
        const validation = this.validateTableStructure(tableNode);
        
        const tableData: TableData = {
            id,
            headers: [...tableNode.headers],
            rows: tableNode.rows.map(row => [...row]),
            alignment: [...tableNode.alignment],
            metadata: {
                sourceUri,
                startLine: tableNode.startLine,
                endLine: tableNode.endLine,
                lastModified: new Date(),
                columnCount: tableNode.headers.length,
                rowCount: tableNode.rows.length,
                isValid: validation.isValid,
                validationIssues: validation.issues
            }
        };

        return tableData;
    }

    /**
     * Get current table data
     */
    getTableData(): TableData {
        return { ...this.tableData };
    }

    /**
     * Update cell value
     */
    updateCell(row: number, col: number, value: string): void {
        if (!this.isValidPosition(row, col)) {
            throw new Error(`Invalid cell position: row ${row}, col ${col}`);
        }

        this.tableData.rows[row][col] = value;
        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Add new row
     */
    addRow(index?: number): void {
        const insertIndex = index !== undefined ? index : this.tableData.rows.length;
        
        if (insertIndex < 0 || insertIndex > this.tableData.rows.length) {
            throw new Error(`Invalid row index: ${insertIndex}`);
        }

        const newRow = new Array(this.tableData.headers.length).fill('');
        this.tableData.rows.splice(insertIndex, 0, newRow);
        
        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Delete row
     */
    deleteRow(index: number): void {
        if (index < 0 || index >= this.tableData.rows.length) {
            throw new Error(`Invalid row index: ${index}`);
        }

        this.tableData.rows.splice(index, 1);
        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Add new column
     */
    addColumn(index?: number, header?: string): void {
        const insertIndex = index !== undefined ? index : this.tableData.headers.length;
        
        if (insertIndex < 0 || insertIndex > this.tableData.headers.length) {
            throw new Error(`Invalid column index: ${insertIndex}`);
        }

        const columnHeader = header || `Column ${insertIndex + 1}`;
        
        // Add header
        this.tableData.headers.splice(insertIndex, 0, columnHeader);
        
        // Add alignment
        this.tableData.alignment.splice(insertIndex, 0, 'left');
        
        // Add cells to all rows
        for (const row of this.tableData.rows) {
            row.splice(insertIndex, 0, '');
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Delete column
     */
    deleteColumn(index: number): void {
        if (index < 0 || index >= this.tableData.headers.length) {
            throw new Error(`Invalid column index: ${index}`);
        }

        if (this.tableData.headers.length <= 1) {
            throw new Error('Cannot delete the last column');
        }

        // Remove header
        this.tableData.headers.splice(index, 1);
        
        // Remove alignment
        this.tableData.alignment.splice(index, 1);
        
        // Remove cells from all rows
        for (const row of this.tableData.rows) {
            row.splice(index, 1);
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Sort table by column
     */
    sortByColumn(columnIndex: number, direction: 'asc' | 'desc'): void {
        if (columnIndex < 0 || columnIndex >= this.tableData.headers.length) {
            throw new Error(`Invalid column index: ${columnIndex}`);
        }

        this.tableData.rows.sort((a, b) => {
            const valueA = a[columnIndex] || '';
            const valueB = b[columnIndex] || '';
            
            // Try to parse as numbers first
            const numA = parseFloat(valueA);
            const numB = parseFloat(valueB);
            
            if (!isNaN(numA) && !isNaN(numB)) {
                return direction === 'asc' ? numA - numB : numB - numA;
            }
            
            // Fall back to string comparison
            const comparison = valueA.localeCompare(valueB);
            return direction === 'asc' ? comparison : -comparison;
        });

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Move row to different position
     */
    moveRow(fromIndex: number, toIndex: number): void {
        if (!this.isValidRowIndex(fromIndex) || !this.isValidRowIndex(toIndex)) {
            throw new Error(`Invalid row indices: from ${fromIndex}, to ${toIndex}`);
        }

        const row = this.tableData.rows.splice(fromIndex, 1)[0];
        this.tableData.rows.splice(toIndex, 0, row);

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Move column to different position
     */
    moveColumn(fromIndex: number, toIndex: number): void {
        if (!this.isValidColumnIndex(fromIndex) || !this.isValidColumnIndex(toIndex)) {
            throw new Error(`Invalid column indices: from ${fromIndex}, to ${toIndex}`);
        }

        // Move header
        const header = this.tableData.headers.splice(fromIndex, 1)[0];
        this.tableData.headers.splice(toIndex, 0, header);

        // Move alignment
        const alignment = this.tableData.alignment.splice(fromIndex, 1)[0];
        this.tableData.alignment.splice(toIndex, 0, alignment);

        // Move cells in all rows
        for (const row of this.tableData.rows) {
            const cell = row.splice(fromIndex, 1)[0];
            row.splice(toIndex, 0, cell);
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Serialize table to Markdown format
     */
    serializeToMarkdown(): string {
        let markdown = '';
        
        // Header row
        markdown += '| ' + this.tableData.headers.join(' | ') + ' |\n';
        
        // Separator row
        markdown += '|';
        for (const alignment of this.tableData.alignment) {
            let separator = '';
            switch (alignment) {
                case 'left':
                    separator = ' :--- ';
                    break;
                case 'center':
                    separator = ' :---: ';
                    break;
                case 'right':
                    separator = ' ---: ';
                    break;
            }
            markdown += separator + '|';
        }
        markdown += '\n';
        
        // Data rows
        for (const row of this.tableData.rows) {
            markdown += '| ' + row.join(' | ') + ' |\n';
        }
        
        return markdown;
    }

    /**
     * Validate table structure
     */
    validateTableStructure(tableNode: TableNode): ValidationResult {
        const issues: string[] = [];
        const warnings: string[] = [];

        // Check headers
        if (!tableNode.headers || tableNode.headers.length === 0) {
            issues.push('Table has no headers');
        }

        // Check for empty headers
        tableNode.headers.forEach((header, index) => {
            if (!header.trim()) {
                warnings.push(`Header ${index + 1} is empty`);
            }
        });

        // Check row consistency
        const expectedColumns = tableNode.headers.length;
        tableNode.rows.forEach((row, rowIndex) => {
            if (row.length !== expectedColumns) {
                issues.push(`Row ${rowIndex + 1} has ${row.length} columns, expected ${expectedColumns}`);
            }
        });

        // Check alignment array
        if (tableNode.alignment.length !== expectedColumns) {
            issues.push(`Alignment array length (${tableNode.alignment.length}) doesn't match column count (${expectedColumns})`);
        }

        return {
            isValid: issues.length === 0,
            issues,
            warnings
        };
    }

    /**
     * Add change listener
     */
    addChangeListener(listener: (data: TableData) => void): void {
        this.changeListeners.push(listener);
    }

    /**
     * Remove change listener
     */
    removeChangeListener(listener: (data: TableData) => void): void {
        const index = this.changeListeners.indexOf(listener);
        if (index > -1) {
            this.changeListeners.splice(index, 1);
        }
    }

    /**
     * Get table statistics
     */
    getStatistics(): {
        totalCells: number;
        emptyCells: number;
        fillRate: number;
        columnWidths: number[];
        averageRowLength: number;
    } {
        const totalCells = this.tableData.headers.length * this.tableData.rows.length;
        let emptyCells = 0;
        
        const columnWidths = this.tableData.headers.map((header, colIndex) => {
            let maxWidth = header.length;
            
            for (const row of this.tableData.rows) {
                const cellValue = row[colIndex] || '';
                if (!cellValue.trim()) {
                    emptyCells++;
                }
                maxWidth = Math.max(maxWidth, cellValue.length);
            }
            
            return maxWidth;
        });

        const averageRowLength = this.tableData.rows.reduce((sum, row) => {
            return sum + row.reduce((rowSum, cell) => rowSum + cell.length, 0);
        }, 0) / Math.max(this.tableData.rows.length, 1);

        return {
            totalCells,
            emptyCells,
            fillRate: totalCells > 0 ? (totalCells - emptyCells) / totalCells : 0,
            columnWidths,
            averageRowLength
        };
    }

    /**
     * Clone table data
     */
    clone(): TableDataManager {
        const clonedTableNode: TableNode = {
            startLine: this.tableData.metadata.startLine,
            endLine: this.tableData.metadata.endLine,
            headers: [...this.tableData.headers],
            rows: this.tableData.rows.map(row => [...row]),
            alignment: [...this.tableData.alignment]
        };

        return new TableDataManager(clonedTableNode, this.tableData.metadata.sourceUri);
    }

    // Private helper methods

    private generateTableId(): string {
        return `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private isValidPosition(row: number, col: number): boolean {
        return this.isValidRowIndex(row) && this.isValidColumnIndex(col);
    }

    private isValidRowIndex(index: number): boolean {
        return index >= 0 && index < this.tableData.rows.length;
    }

    private isValidColumnIndex(index: number): boolean {
        return index >= 0 && index < this.tableData.headers.length;
    }

    private updateMetadata(): void {
        this.tableData.metadata.lastModified = new Date();
        this.tableData.metadata.columnCount = this.tableData.headers.length;
        this.tableData.metadata.rowCount = this.tableData.rows.length;
        
        // Re-validate
        const tableNode: TableNode = {
            startLine: this.tableData.metadata.startLine,
            endLine: this.tableData.metadata.endLine,
            headers: this.tableData.headers,
            rows: this.tableData.rows,
            alignment: this.tableData.alignment
        };
        
        const validation = this.validateTableStructure(tableNode);
        this.tableData.metadata.isValid = validation.isValid;
        this.tableData.metadata.validationIssues = validation.issues;
    }

    private notifyChange(): void {
        for (const listener of this.changeListeners) {
            listener(this.getTableData());
        }
    }
}