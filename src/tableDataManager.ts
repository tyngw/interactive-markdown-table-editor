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
    tableIndex: number;  // Index of this table in the document (0-based)
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

    constructor(tableNode: TableNode, sourceUri: string = '', tableIndex: number = 0) {
        this.tableData = this.loadTable(tableNode, sourceUri, tableIndex);
    }

    /**
     * Load table from TableNode
     */
    loadTable(tableNode: TableNode, sourceUri: string = '', tableIndex: number = 0): TableData {
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
                tableIndex,
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
     * Update header value
     */
    updateHeader(col: number, value: string): void {
        if (col < 0 || col >= this.tableData.headers.length) {
            throw new Error(`Invalid header column: ${col}`);
        }

        this.tableData.headers[col] = value;
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

    // Drag & Drop Enhanced Functionality

    /**
     * Drag & Drop state interface
     */
    private dragDropState: {
        isDragging: boolean;
        dragType: 'row' | 'column' | null;
        dragIndex: number;
        dropZones: number[];
        previewData?: TableData;
    } = {
            isDragging: false,
            dragType: null,
            dragIndex: -1,
            dropZones: []
        };

    /**
     * Start drag operation for row
     * Requirements: 4.1 - ユーザーが行ヘッダーをドラッグする
     */
    startRowDrag(rowIndex: number): void {
        if (!this.isValidRowIndex(rowIndex)) {
            throw new Error(`Invalid row index for drag: ${rowIndex}`);
        }

        this.dragDropState = {
            isDragging: true,
            dragType: 'row',
            dragIndex: rowIndex,
            dropZones: this.getValidRowDropZones(rowIndex),
            previewData: this.getTableData()
        };

        this.notifyDragStart('row', rowIndex);
    }

    /**
     * Start drag operation for column
     * Requirements: 4.2 - ユーザーが列ヘッダーをドラッグする
     */
    startColumnDrag(columnIndex: number): void {
        if (!this.isValidColumnIndex(columnIndex)) {
            throw new Error(`Invalid column index for drag: ${columnIndex}`);
        }

        this.dragDropState = {
            isDragging: true,
            dragType: 'column',
            dragIndex: columnIndex,
            dropZones: this.getValidColumnDropZones(columnIndex),
            previewData: this.getTableData()
        };

        this.notifyDragStart('column', columnIndex);
    }

    /**
     * Update drag position and provide visual feedback
     * Requirements: 4.3 - ドラッグ中である THEN システムは ドロップ可能な位置を視覚的に示す
     */
    updateDragPosition(targetIndex: number): boolean {
        if (!this.dragDropState.isDragging) {
            return false;
        }

        const isValidDropZone = this.dragDropState.dropZones.includes(targetIndex);

        if (isValidDropZone) {
            // Create preview of the drop result
            this.createDragPreview(targetIndex);
            this.notifyDragOver(targetIndex, true);
        } else {
            this.notifyDragOver(targetIndex, false);
        }

        return isValidDropZone;
    }

    /**
     * Complete drag & drop operation
     * Requirements: 4.4 - ドラッグ&ドロップが完了する THEN システムは 新しい順序をMarkdownファイルに反映する
     */
    completeDragDrop(dropIndex: number): boolean {
        if (!this.dragDropState.isDragging) {
            return false;
        }

        const { dragType, dragIndex } = this.dragDropState;

        if (!this.dragDropState.dropZones.includes(dropIndex)) {
            this.cancelDragDrop();
            return false;
        }

        try {
            if (dragType === 'row') {
                this.moveRow(dragIndex, dropIndex);
            } else if (dragType === 'column') {
                this.moveColumn(dragIndex, dropIndex);
            }

            this.notifyDragComplete(dragType!, dragIndex, dropIndex);
            this.resetDragDropState();

            // Ensure Markdown is updated (already handled by moveRow/moveColumn through notifyChange)
            return true;
        } catch (error) {
            this.cancelDragDrop();
            throw error;
        }
    }

    /**
     * Cancel drag & drop operation
     */
    cancelDragDrop(): void {
        if (this.dragDropState.isDragging) {
            this.notifyDragCancel();
            this.resetDragDropState();
        }
    }

    /**
     * Get current drag & drop state
     */
    getDragDropState(): {
        isDragging: boolean;
        dragType: 'row' | 'column' | null;
        dragIndex: number;
        dropZones: number[];
        previewData?: TableData;
    } {
        return { ...this.dragDropState };
    }

    /**
     * Check if position is valid drop zone
     */
    isValidDropZone(index: number): boolean {
        return this.dragDropState.dropZones.includes(index);
    }

    /**
     * Get valid drop zones for row drag
     */
    private getValidRowDropZones(dragIndex: number): number[] {
        const zones: number[] = [];
        for (let i = 0; i <= this.tableData.rows.length; i++) {
            if (i !== dragIndex && i !== dragIndex + 1) {
                zones.push(i);
            }
        }
        return zones;
    }

    /**
     * Get valid drop zones for column drag
     */
    private getValidColumnDropZones(dragIndex: number): number[] {
        const zones: number[] = [];
        for (let i = 0; i <= this.tableData.headers.length; i++) {
            if (i !== dragIndex && i !== dragIndex + 1) {
                zones.push(i);
            }
        }
        return zones;
    }

    /**
     * Create preview of drag & drop result
     */
    private createDragPreview(dropIndex: number): void {
        if (!this.dragDropState.isDragging || !this.dragDropState.previewData) {
            return;
        }

        const previewManager = new TableDataManager({
            startLine: this.tableData.metadata.startLine,
            endLine: this.tableData.metadata.endLine,
            headers: [...this.dragDropState.previewData.headers],
            rows: this.dragDropState.previewData.rows.map(row => [...row]),
            alignment: [...this.dragDropState.previewData.alignment]
        }, this.tableData.metadata.sourceUri);

        try {
            if (this.dragDropState.dragType === 'row') {
                previewManager.moveRow(this.dragDropState.dragIndex, dropIndex);
            } else if (this.dragDropState.dragType === 'column') {
                previewManager.moveColumn(this.dragDropState.dragIndex, dropIndex);
            }

            this.dragDropState.previewData = previewManager.getTableData();
            this.notifyDragPreview(this.dragDropState.previewData);
        } catch (error) {
            // Preview failed, keep original data
        }
    }

    /**
     * Reset drag & drop state
     */
    private resetDragDropState(): void {
        this.dragDropState = {
            isDragging: false,
            dragType: null,
            dragIndex: -1,
            dropZones: []
        };
    }

    // Drag & Drop Event Notifications

    private dragDropListeners: Array<{
        onDragStart?: (type: 'row' | 'column', index: number) => void;
        onDragOver?: (index: number, isValid: boolean) => void;
        onDragPreview?: (previewData: TableData) => void;
        onDragComplete?: (type: 'row' | 'column', fromIndex: number, toIndex: number) => void;
        onDragCancel?: () => void;
    }> = [];

    /**
     * Add drag & drop event listener
     */
    addDragDropListener(listener: {
        onDragStart?: (type: 'row' | 'column', index: number) => void;
        onDragOver?: (index: number, isValid: boolean) => void;
        onDragPreview?: (previewData: TableData) => void;
        onDragComplete?: (type: 'row' | 'column', fromIndex: number, toIndex: number) => void;
        onDragCancel?: () => void;
    }): void {
        this.dragDropListeners.push(listener);
    }

    /**
     * Remove drag & drop event listener
     */
    removeDragDropListener(listener: any): void {
        const index = this.dragDropListeners.indexOf(listener);
        if (index > -1) {
            this.dragDropListeners.splice(index, 1);
        }
    }

    private notifyDragStart(type: 'row' | 'column', index: number): void {
        for (const listener of this.dragDropListeners) {
            listener.onDragStart?.(type, index);
        }
    }

    private notifyDragOver(index: number, isValid: boolean): void {
        for (const listener of this.dragDropListeners) {
            listener.onDragOver?.(index, isValid);
        }
    }

    private notifyDragPreview(previewData: TableData): void {
        for (const listener of this.dragDropListeners) {
            listener.onDragPreview?.(previewData);
        }
    }

    private notifyDragComplete(type: 'row' | 'column', fromIndex: number, toIndex: number): void {
        for (const listener of this.dragDropListeners) {
            listener.onDragComplete?.(type, fromIndex, toIndex);
        }
    }

    private notifyDragCancel(): void {
        for (const listener of this.dragDropListeners) {
            listener.onDragCancel?.();
        }
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

        // Remove trailing newline to prevent empty lines when splitting
        return markdown.trimEnd();
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

    // Advanced CRUD Operations

    /**
     * Batch update multiple cells
     */
    batchUpdateCells(updates: Array<{ row: number; col: number; value: string }>): void {
        for (const update of updates) {
            if (!this.isValidPosition(update.row, update.col)) {
                throw new Error(`Invalid cell position in batch update: row ${update.row}, col ${update.col}`);
            }
        }

        // Apply all updates
        for (const update of updates) {
            this.tableData.rows[update.row][update.col] = update.value;
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Insert multiple rows at once
     */
    insertRows(startIndex: number, count: number): void {
        if (startIndex < 0 || startIndex > this.tableData.rows.length) {
            throw new Error(`Invalid start index: ${startIndex}`);
        }

        if (count <= 0) {
            throw new Error(`Invalid row count: ${count}`);
        }

        const newRows = Array(count).fill(null).map(() =>
            new Array(this.tableData.headers.length).fill('')
        );

        this.tableData.rows.splice(startIndex, 0, ...newRows);
        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Delete multiple rows
     */
    deleteRows(indices: number[]): void {
        // Sort indices in descending order to avoid index shifting issues
        const sortedIndices = [...indices].sort((a, b) => b - a);

        for (const index of sortedIndices) {
            if (index < 0 || index >= this.tableData.rows.length) {
                throw new Error(`Invalid row index: ${index}`);
            }
        }

        for (const index of sortedIndices) {
            this.tableData.rows.splice(index, 1);
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Insert multiple columns at once
     */
    insertColumns(startIndex: number, count: number, headers?: string[]): void {
        if (startIndex < 0 || startIndex > this.tableData.headers.length) {
            throw new Error(`Invalid start index: ${startIndex}`);
        }

        if (count <= 0) {
            throw new Error(`Invalid column count: ${count}`);
        }

        // Generate headers if not provided
        const columnHeaders = headers || Array(count).fill(null).map((_, i) =>
            `Column ${startIndex + i + 1}`
        );

        if (columnHeaders.length !== count) {
            throw new Error(`Header count (${columnHeaders.length}) doesn't match column count (${count})`);
        }

        // Insert headers
        this.tableData.headers.splice(startIndex, 0, ...columnHeaders);

        // Insert alignments
        const newAlignments = Array(count).fill('left');
        this.tableData.alignment.splice(startIndex, 0, ...newAlignments);

        // Insert cells in all rows
        for (const row of this.tableData.rows) {
            const newCells = Array(count).fill('');
            row.splice(startIndex, 0, ...newCells);
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Delete multiple columns
     */
    deleteColumns(indices: number[]): void {
        if (indices.length >= this.tableData.headers.length) {
            throw new Error('Cannot delete all columns');
        }

        // Sort indices in descending order to avoid index shifting issues
        const sortedIndices = [...indices].sort((a, b) => b - a);

        for (const index of sortedIndices) {
            if (index < 0 || index >= this.tableData.headers.length) {
                throw new Error(`Invalid column index: ${index}`);
            }
        }

        for (const index of sortedIndices) {
            // Remove header
            this.tableData.headers.splice(index, 1);

            // Remove alignment
            this.tableData.alignment.splice(index, 1);

            // Remove cells from all rows
            for (const row of this.tableData.rows) {
                row.splice(index, 1);
            }
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Update entire row
     */
    updateRow(rowIndex: number, newValues: string[]): void {
        if (!this.isValidRowIndex(rowIndex)) {
            throw new Error(`Invalid row index: ${rowIndex}`);
        }

        if (newValues.length !== this.tableData.headers.length) {
            throw new Error(`Row length (${newValues.length}) doesn't match column count (${this.tableData.headers.length})`);
        }

        this.tableData.rows[rowIndex] = [...newValues];
        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Update entire column
     */
    updateColumn(colIndex: number, newValues: string[], newHeader?: string): void {
        if (!this.isValidColumnIndex(colIndex)) {
            throw new Error(`Invalid column index: ${colIndex}`);
        }

        if (newValues.length !== this.tableData.rows.length) {
            throw new Error(`Column length (${newValues.length}) doesn't match row count (${this.tableData.rows.length})`);
        }

        // Update header if provided
        if (newHeader !== undefined) {
            this.tableData.headers[colIndex] = newHeader;
        }

        // Update all cells in the column
        for (let i = 0; i < this.tableData.rows.length; i++) {
            this.tableData.rows[i][colIndex] = newValues[i];
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Clear all cell values (keep structure)
     */
    clearAllCells(): void {
        for (const row of this.tableData.rows) {
            for (let i = 0; i < row.length; i++) {
                row[i] = '';
            }
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Clear specific row
     */
    clearRow(rowIndex: number): void {
        if (!this.isValidRowIndex(rowIndex)) {
            throw new Error(`Invalid row index: ${rowIndex}`);
        }

        for (let i = 0; i < this.tableData.rows[rowIndex].length; i++) {
            this.tableData.rows[rowIndex][i] = '';
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Clear specific column
     */
    clearColumn(colIndex: number): void {
        if (!this.isValidColumnIndex(colIndex)) {
            throw new Error(`Invalid column index: ${colIndex}`);
        }

        for (const row of this.tableData.rows) {
            row[colIndex] = '';
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Duplicate row
     */
    duplicateRow(rowIndex: number, insertIndex?: number): void {
        if (!this.isValidRowIndex(rowIndex)) {
            throw new Error(`Invalid row index: ${rowIndex}`);
        }

        const targetIndex = insertIndex !== undefined ? insertIndex : rowIndex + 1;
        const duplicatedRow = [...this.tableData.rows[rowIndex]];

        this.tableData.rows.splice(targetIndex, 0, duplicatedRow);
        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Duplicate column
     */
    duplicateColumn(colIndex: number, insertIndex?: number): void {
        if (!this.isValidColumnIndex(colIndex)) {
            throw new Error(`Invalid column index: ${colIndex}`);
        }

        const targetIndex = insertIndex !== undefined ? insertIndex : colIndex + 1;

        // Duplicate header
        const duplicatedHeader = this.tableData.headers[colIndex] + ' Copy';
        this.tableData.headers.splice(targetIndex, 0, duplicatedHeader);

        // Duplicate alignment
        const duplicatedAlignment = this.tableData.alignment[colIndex];
        this.tableData.alignment.splice(targetIndex, 0, duplicatedAlignment);

        // Duplicate cells in all rows
        for (const row of this.tableData.rows) {
            const duplicatedCell = row[colIndex];
            row.splice(targetIndex, 0, duplicatedCell);
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Find and replace in table
     */
    findAndReplace(searchValue: string, replaceValue: string, options?: {
        caseSensitive?: boolean;
        wholeWord?: boolean;
        useRegex?: boolean;
        includeHeaders?: boolean;
    }): number {
        const opts = {
            caseSensitive: false,
            wholeWord: false,
            useRegex: false,
            includeHeaders: false,
            ...options
        };

        let replacementCount = 0;
        let searchPattern: RegExp;

        if (opts.useRegex) {
            const flags = opts.caseSensitive ? 'g' : 'gi';
            searchPattern = new RegExp(searchValue, flags);
        } else {
            let escapedSearch = searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            if (opts.wholeWord) {
                escapedSearch = `\\b${escapedSearch}\\b`;
            }
            const flags = opts.caseSensitive ? 'g' : 'gi';
            searchPattern = new RegExp(escapedSearch, flags);
        }

        // Replace in headers if requested
        if (opts.includeHeaders) {
            for (let i = 0; i < this.tableData.headers.length; i++) {
                const originalHeader = this.tableData.headers[i];
                const newHeader = originalHeader.replace(searchPattern, replaceValue);
                if (newHeader !== originalHeader) {
                    this.tableData.headers[i] = newHeader;
                    replacementCount += (originalHeader.match(searchPattern) || []).length;
                }
            }
        }

        // Replace in cells
        for (const row of this.tableData.rows) {
            for (let i = 0; i < row.length; i++) {
                const originalValue = row[i];
                const newValue = originalValue.replace(searchPattern, replaceValue);
                if (newValue !== originalValue) {
                    row[i] = newValue;
                    replacementCount += (originalValue.match(searchPattern) || []).length;
                }
            }
        }

        if (replacementCount > 0) {
            this.updateMetadata();
            this.notifyChange();
        }

        return replacementCount;
    }

    /**
     * Get row data
     */
    getRow(rowIndex: number): string[] {
        if (!this.isValidRowIndex(rowIndex)) {
            throw new Error(`Invalid row index: ${rowIndex}`);
        }

        return [...this.tableData.rows[rowIndex]];
    }

    /**
     * Get column data
     */
    getColumn(colIndex: number): { header: string; values: string[]; alignment: string } {
        if (!this.isValidColumnIndex(colIndex)) {
            throw new Error(`Invalid column index: ${colIndex}`);
        }

        return {
            header: this.tableData.headers[colIndex],
            values: this.tableData.rows.map(row => row[colIndex]),
            alignment: this.tableData.alignment[colIndex]
        };
    }

    /**
     * Get cell value
     */
    getCell(row: number, col: number): string {
        if (!this.isValidPosition(row, col)) {
            throw new Error(`Invalid cell position: row ${row}, col ${col}`);
        }

        return this.tableData.rows[row][col];
    }

    /**
     * Check if table is empty (no data rows)
     */
    isEmpty(): boolean {
        return this.tableData.rows.length === 0;
    }

    /**
     * Check if table has any empty cells
     */
    hasEmptyCells(): boolean {
        for (const row of this.tableData.rows) {
            for (const cell of row) {
                if (!cell.trim()) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Get empty cell positions
     */
    getEmptyCells(): Array<{ row: number; col: number }> {
        const emptyCells: Array<{ row: number; col: number }> = [];

        for (let rowIndex = 0; rowIndex < this.tableData.rows.length; rowIndex++) {
            for (let colIndex = 0; colIndex < this.tableData.rows[rowIndex].length; colIndex++) {
                if (!this.tableData.rows[rowIndex][colIndex].trim()) {
                    emptyCells.push({ row: rowIndex, col: colIndex });
                }
            }
        }

        return emptyCells;
    }

    // Advanced Sorting Operations

    /**
     * Sort state interface
     */
    private sortState: {
        columnIndex: number;
        direction: 'asc' | 'desc';
        dataType: 'string' | 'number' | 'date' | 'auto';
    } | null = null;

    /**
     * Advanced sort with custom comparator
     */
    sortByColumnAdvanced(
        columnIndex: number,
        direction: 'asc' | 'desc',
        options?: {
            dataType?: 'string' | 'number' | 'date' | 'auto';
            caseSensitive?: boolean;
            locale?: string;
            customComparator?: (a: string, b: string) => number;
        }
    ): void {
        if (columnIndex < 0 || columnIndex >= this.tableData.headers.length) {
            throw new Error(`Invalid column index: ${columnIndex}`);
        }

        const opts = {
            dataType: 'auto' as const,
            caseSensitive: true,
            locale: 'en-US',
            ...options
        };

        // Determine data type if auto
        let actualDataType = opts.dataType;
        if (actualDataType === 'auto') {
            actualDataType = this.detectColumnDataType(columnIndex);
        }

        // Store sort state
        this.sortState = {
            columnIndex,
            direction,
            dataType: actualDataType
        };

        this.tableData.rows.sort((a, b) => {
            const valueA = a[columnIndex] || '';
            const valueB = b[columnIndex] || '';

            let comparison = 0;

            if (opts.customComparator) {
                comparison = opts.customComparator(valueA, valueB);
            } else {
                comparison = this.compareValues(valueA, valueB, actualDataType as 'string' | 'number' | 'date', opts);
            }

            return direction === 'asc' ? comparison : -comparison;
        });

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Multi-column sort
     */
    sortByMultipleColumns(
        sortCriteria: Array<{
            columnIndex: number;
            direction: 'asc' | 'desc';
            dataType?: 'string' | 'number' | 'date' | 'auto';
        }>
    ): void {
        if (sortCriteria.length === 0) {
            return;
        }

        // Validate all column indices
        for (const criteria of sortCriteria) {
            if (criteria.columnIndex < 0 || criteria.columnIndex >= this.tableData.headers.length) {
                throw new Error(`Invalid column index: ${criteria.columnIndex}`);
            }
        }

        // Determine data types for auto detection
        const processedCriteria = sortCriteria.map(criteria => ({
            ...criteria,
            dataType: criteria.dataType === 'auto' || !criteria.dataType
                ? this.detectColumnDataType(criteria.columnIndex)
                : criteria.dataType
        }));

        this.tableData.rows.sort((a, b) => {
            for (const criteria of processedCriteria) {
                const valueA = a[criteria.columnIndex] || '';
                const valueB = b[criteria.columnIndex] || '';

                const comparison = this.compareValues(valueA, valueB, criteria.dataType, {
                    caseSensitive: true,
                    locale: 'en-US'
                });

                if (comparison !== 0) {
                    return criteria.direction === 'asc' ? comparison : -comparison;
                }
            }
            return 0;
        });

        // Store primary sort state
        this.sortState = {
            columnIndex: processedCriteria[0].columnIndex,
            direction: processedCriteria[0].direction,
            dataType: processedCriteria[0].dataType
        };

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Sort by custom function
     */
    sortByCustomFunction(compareFn: (rowA: string[], rowB: string[]) => number): void {
        this.tableData.rows.sort(compareFn);

        // Clear sort state since it's custom
        this.sortState = null;

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Shuffle rows randomly
     */
    shuffleRows(): void {
        for (let i = this.tableData.rows.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tableData.rows[i], this.tableData.rows[j]] = [this.tableData.rows[j], this.tableData.rows[i]];
        }

        this.sortState = null;
        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Reverse current row order
     */
    reverseRows(): void {
        this.tableData.rows.reverse();

        // Update sort state to indicate reversed order
        if (this.sortState) {
            this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
        }

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Get current sort state
     */
    getSortState(): {
        columnIndex: number;
        direction: 'asc' | 'desc';
        dataType: 'string' | 'number' | 'date' | 'auto';
    } | null {
        return this.sortState ? { ...this.sortState } : null;
    }

    /**
     * Clear sort state
     */
    clearSortState(): void {
        this.sortState = null;
    }

    /**
     * Check if table is currently sorted
     */
    isSorted(): boolean {
        return this.sortState !== null;
    }

    /**
     * Detect column data type
     */
    private detectColumnDataType(columnIndex: number): 'string' | 'number' | 'date' {
        if (columnIndex < 0 || columnIndex >= this.tableData.headers.length) {
            return 'string';
        }

        const values = this.tableData.rows.map(row => row[columnIndex]).filter(val => val.trim());

        if (values.length === 0) {
            return 'string';
        }

        // Check if all values are numbers
        const numberCount = values.filter(val => !isNaN(parseFloat(val)) && isFinite(parseFloat(val))).length;
        if (numberCount === values.length) {
            return 'number';
        }

        // Check if all values are dates
        const dateCount = values.filter(val => !isNaN(Date.parse(val))).length;
        if (dateCount === values.length) {
            return 'date';
        }

        return 'string';
    }

    /**
     * Compare values based on data type
     */
    private compareValues(
        valueA: string,
        valueB: string,
        dataType: 'string' | 'number' | 'date',
        options: { caseSensitive?: boolean; locale?: string }
    ): number {
        if (dataType === 'number') {
            const numA = parseFloat(valueA) || 0;
            const numB = parseFloat(valueB) || 0;
            return numA - numB;
        }

        if (dataType === 'date') {
            const dateA = new Date(valueA);
            const dateB = new Date(valueB);
            return dateA.getTime() - dateB.getTime();
        }

        // String comparison
        if (options.caseSensitive) {
            return valueA.localeCompare(valueB, options.locale);
        } else {
            return valueA.toLowerCase().localeCompare(valueB.toLowerCase(), options.locale);
        }
    }

    /**
     * Natural sort (handles alphanumeric strings properly)
     */
    sortNatural(columnIndex: number, direction: 'asc' | 'desc'): void {
        if (columnIndex < 0 || columnIndex >= this.tableData.headers.length) {
            throw new Error(`Invalid column index: ${columnIndex}`);
        }

        this.tableData.rows.sort((a, b) => {
            const valueA = a[columnIndex] || '';
            const valueB = b[columnIndex] || '';

            const comparison = this.naturalCompare(valueA, valueB);
            return direction === 'asc' ? comparison : -comparison;
        });

        this.sortState = {
            columnIndex,
            direction,
            dataType: 'string'
        };

        this.updateMetadata();
        this.notifyChange();
    }

    /**
     * Natural comparison for alphanumeric strings
     */
    private naturalCompare(a: string, b: string): number {
        const reA = /[^a-zA-Z]/g;
        const reN = /[^0-9]/g;

        const aA = a.replace(reA, '');
        const bA = b.replace(reA, '');

        if (aA === bA) {
            const aN = parseInt(a.replace(reN, ''), 10);
            const bN = parseInt(b.replace(reN, ''), 10);
            return aN === bN ? 0 : aN > bN ? 1 : -1;
        } else {
            return aA > bA ? 1 : -1;
        }
    }

    /**
     * Get sort indicators for UI
     */
    getSortIndicators(): Array<{
        columnIndex: number;
        direction: 'asc' | 'desc' | null;
        isPrimary: boolean;
    }> {
        const indicators = this.tableData.headers.map((_, index) => ({
            columnIndex: index,
            direction: null as 'asc' | 'desc' | null,
            isPrimary: false
        }));

        if (this.sortState) {
            indicators[this.sortState.columnIndex].direction = this.sortState.direction;
            indicators[this.sortState.columnIndex].isPrimary = true;
        }

        return indicators;
    }

    /**
     * Get column statistics for sorting
     */
    getSortedColumnStats(columnIndex: number): {
        dataType: 'string' | 'number' | 'date';
        uniqueValues: number;
        nullValues: number;
        minValue: string;
        maxValue: string;
        sampleValues: string[];
    } {
        if (columnIndex < 0 || columnIndex >= this.tableData.headers.length) {
            throw new Error(`Invalid column index: ${columnIndex}`);
        }

        const values = this.tableData.rows.map(row => row[columnIndex]);
        const nonEmptyValues = values.filter(val => val.trim());
        const uniqueValues = new Set(nonEmptyValues);

        const dataType = this.detectColumnDataType(columnIndex);

        let minValue = '';
        let maxValue = '';

        if (nonEmptyValues.length > 0) {
            if (dataType === 'number') {
                const numbers = nonEmptyValues.map(val => parseFloat(val)).filter(num => !isNaN(num));
                minValue = Math.min(...numbers).toString();
                maxValue = Math.max(...numbers).toString();
            } else if (dataType === 'date') {
                const dates = nonEmptyValues.map(val => new Date(val)).filter(date => !isNaN(date.getTime()));
                minValue = new Date(Math.min(...dates.map(d => d.getTime()))).toISOString();
                maxValue = new Date(Math.max(...dates.map(d => d.getTime()))).toISOString();
            } else {
                const sortedValues = [...nonEmptyValues].sort();
                minValue = sortedValues[0];
                maxValue = sortedValues[sortedValues.length - 1];
            }
        }

        return {
            dataType,
            uniqueValues: uniqueValues.size,
            nullValues: values.length - nonEmptyValues.length,
            minValue,
            maxValue,
            sampleValues: Array.from(uniqueValues).slice(0, 5)
        };
    }

    // Drag & Drop specific methods

    /**
     * Validate drag & drop operation for rows
     */
    validateRowMove(fromIndex: number, toIndex: number): {
        isValid: boolean;
        error?: string;
    } {
        if (!this.isValidRowIndex(fromIndex)) {
            return { isValid: false, error: `Invalid source row index: ${fromIndex}` };
        }

        if (toIndex < 0 || toIndex >= this.tableData.rows.length) {
            return { isValid: false, error: `Invalid target row index: ${toIndex}` };
        }

        if (fromIndex === toIndex) {
            return { isValid: false, error: 'Source and target indices are the same' };
        }

        return { isValid: true };
    }

    /**
     * Validate drag & drop operation for columns
     */
    validateColumnMove(fromIndex: number, toIndex: number): {
        isValid: boolean;
        error?: string;
    } {
        if (!this.isValidColumnIndex(fromIndex)) {
            return { isValid: false, error: `Invalid source column index: ${fromIndex}` };
        }

        if (toIndex < 0 || toIndex >= this.tableData.headers.length) {
            return { isValid: false, error: `Invalid target column index: ${toIndex}` };
        }

        if (fromIndex === toIndex) {
            return { isValid: false, error: 'Source and target indices are the same' };
        }

        return { isValid: true };
    }

    /**
     * Move row with validation and enhanced feedback
     */
    moveRowSafe(fromIndex: number, toIndex: number): {
        success: boolean;
        error?: string;
        previousState?: TableData;
    } {
        const validation = this.validateRowMove(fromIndex, toIndex);
        if (!validation.isValid) {
            return { success: false, error: validation.error };
        }

        const previousState = this.getTableData();

        try {
            this.moveRow(fromIndex, toIndex);
            return { success: true, previousState };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                previousState
            };
        }
    }

    /**
     * Move column with validation and enhanced feedback
     */
    moveColumnSafe(fromIndex: number, toIndex: number): {
        success: boolean;
        error?: string;
        previousState?: TableData;
    } {
        const validation = this.validateColumnMove(fromIndex, toIndex);
        if (!validation.isValid) {
            return { success: false, error: validation.error };
        }

        const previousState = this.getTableData();

        try {
            this.moveColumn(fromIndex, toIndex);
            return { success: true, previousState };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error occurred',
                previousState
            };
        }
    }

}