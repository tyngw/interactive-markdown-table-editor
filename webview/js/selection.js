/**
 * Selection Manager Module for Markdown Table Editor
 * 
 * This module handles all cell selection operations, including:
 * - Single cell selection
 * - Range selection
 * - Row/column selection
 * - Selection visualization
 */

const SelectionManager = {
    // Initialization state
    isInitialized: false,
    
    /**
     * Initialize the selection manager module
     */
    init: function() {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('SelectionManager: Already initialized, skipping');
            return;
        }
        
        console.log('SelectionManager: Initializing selection manager module...');
        
        // Set up global keyboard listeners for selection
        this.setupGlobalKeyboardListeners();
        
        this.isInitialized = true;
        console.log('SelectionManager: Module initialized');
    },
    
    /**
     * Set up global keyboard listeners
     */
    setupGlobalKeyboardListeners: function() {
        document.addEventListener('keydown', (event) => {
            // Delegate keyboard handling to the keyboard navigation module
            window.TableEditor.callModule('KeyboardNavigationManager', 'handleKeyDown', event);
        });
    },
    
    /**
     * Select a single cell
     */
    selectCell: function(row, col, event = null) {
        const state = window.TableEditor.state;
        
        // Handle multi-selection with Ctrl/Cmd key
        if (event && (event.ctrlKey || event.metaKey)) {
            const cellKey = `${row}-${col}`;
            if (state.selectedCells.has(cellKey)) {
                state.selectedCells.delete(cellKey);
            } else {
                state.selectedCells.add(cellKey);
            }
        }
        // Handle range selection with Shift key
        else if (event && event.shiftKey && state.lastSelectedCell) {
            this.selectRange(
                state.lastSelectedCell.row, 
                state.lastSelectedCell.col, 
                row, 
                col
            );
        }
        // Regular single selection
        else {
            state.selectedCells.clear();
            state.selectedCells.add(`${row}-${col}`);
        }
        
        // Update last selected cell
        state.lastSelectedCell = { row, col };
        
        // Update visual selection
        this.updateCellSelection();
        
        // Update toolbar buttons based on selection
        this.updateToolbarButtons();
    },
    
    /**
     * Select a range of cells
     */
    selectRange: function(startRow, startCol, endRow, endCol) {
        const state = window.TableEditor.state;
        
        // Clear current selection
        state.selectedCells.clear();
        
        // Ensure correct order
        const minRow = Math.min(startRow, endRow);
        const maxRow = Math.max(startRow, endRow);
        const minCol = Math.min(startCol, endCol);
        const maxCol = Math.max(startCol, endCol);
        
        // Select all cells in range
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                state.selectedCells.add(`${row}-${col}`);
            }
        }
        
        // Update visual selection
        this.updateCellSelection();
        
        // Update toolbar buttons
        this.updateToolbarButtons();
        // Shift+カーソル連打時も常に現在位置をlastSelectedCellに
        state.lastSelectedCell = { row: endRow, col: endCol };
    },
    
    /**
     * Select an entire row
     */
    selectRow: function(rowIndex, event = null) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.rows || !data.rows[rowIndex]) return;
        
        // Handle multi-selection with Ctrl/Cmd key
        if (event && (event.ctrlKey || event.metaKey)) {
            // Toggle row selection
            const isRowSelected = this.isRowFullySelected(rowIndex);
            if (isRowSelected) {
                // Remove row from selection
                for (let col = 0; col < data.headers.length; col++) {
                    state.selectedCells.delete(`${rowIndex}-${col}`);
                }
            } else {
                // Add row to selection
                for (let col = 0; col < data.headers.length; col++) {
                    state.selectedCells.add(`${rowIndex}-${col}`);
                }
            }
        }
        // Handle range selection with Shift key
        else if (event && event.shiftKey && state.lastSelectedCell) {
            const startRow = Math.min(state.lastSelectedCell.row, rowIndex);
            const endRow = Math.max(state.lastSelectedCell.row, rowIndex);
            
            state.selectedCells.clear();
            for (let row = startRow; row <= endRow; row++) {
                for (let col = 0; col < data.headers.length; col++) {
                    state.selectedCells.add(`${row}-${col}`);
                }
            }
        }
        // Regular single row selection
        else {
            state.selectedCells.clear();
            for (let col = 0; col < data.headers.length; col++) {
                state.selectedCells.add(`${rowIndex}-${col}`);
            }
        }
        
        // Update last selected cell
        state.lastSelectedCell = { row: rowIndex, col: 0 };
        
        // Update visual selection
        this.updateCellSelection();
        
        // Update toolbar buttons
        this.updateToolbarButtons();
    },
    
    /**
     * Select an entire column
     */
    selectColumn: function(colIndex, event = null) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.rows) return;
        
        // Handle multi-selection with Ctrl/Cmd key
        if (event && (event.ctrlKey || event.metaKey)) {
            // Toggle column selection
            const isColumnSelected = this.isColumnFullySelected(colIndex);
            if (isColumnSelected) {
                // Remove column from selection
                for (let row = 0; row < data.rows.length; row++) {
                    state.selectedCells.delete(`${row}-${colIndex}`);
                }
            } else {
                // Add column to selection
                for (let row = 0; row < data.rows.length; row++) {
                    state.selectedCells.add(`${row}-${colIndex}`);
                }
            }
        }
        // Handle range selection with Shift key
        else if (event && event.shiftKey && state.lastSelectedCell) {
            const startCol = Math.min(state.lastSelectedCell.col, colIndex);
            const endCol = Math.max(state.lastSelectedCell.col, colIndex);
            
            state.selectedCells.clear();
            for (let row = 0; row < data.rows.length; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    state.selectedCells.add(`${row}-${col}`);
                }
            }
        }
        // Regular single column selection
        else {
            state.selectedCells.clear();
            for (let row = 0; row < data.rows.length; row++) {
                state.selectedCells.add(`${row}-${colIndex}`);
            }
        }
        
        // Update last selected cell
        state.lastSelectedCell = { row: 0, col: colIndex };
        
        // Update visual selection
        this.updateCellSelection();
        
        // Update toolbar buttons
        this.updateToolbarButtons();
    },
    
    /**
     * Check if an entire row is fully selected
     */
    isRowFullySelected: function(rowIndex) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.headers) return false;
        
        for (let col = 0; col < data.headers.length; col++) {
            if (!state.selectedCells.has(`${rowIndex}-${col}`)) {
                return false;
            }
        }
        return true;
    },
    
    /**
     * Check if an entire column is fully selected
     */
    isColumnFullySelected: function(colIndex) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.rows) return false;
        
        for (let row = 0; row < data.rows.length; row++) {
            if (!state.selectedCells.has(`${row}-${colIndex}`)) {
                return false;
            }
        }
        return true;
    },
    
    /**
     * Select all cells in the table
     */
    selectAll: function() {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.rows || !data.headers) return;
        
        state.selectedCells.clear();
        
        // Select all data cells
        for (let row = 0; row < data.rows.length; row++) {
            for (let col = 0; col < data.headers.length; col++) {
                state.selectedCells.add(`${row}-${col}`);
            }
        }
        
        // Update visual selection
        this.updateCellSelection();
        
        // Update toolbar buttons
        this.updateToolbarButtons();
    },
    
    /**
     * Clear all selections
     */
    clearSelection: function() {
        const state = window.TableEditor.state;
        
        state.selectedCells.clear();
        state.lastSelectedCell = null;
        
        // Update visual selection
        this.updateCellSelection();
        
        // Update toolbar buttons
        this.updateToolbarButtons();
    },
    
    /**
     * Update visual selection in the DOM
     */
    updateCellSelection: function() {
        const state = window.TableEditor.state;
        
        // Remove existing selection styling
        document.querySelectorAll('.selected, .row-selected, .col-selected').forEach(cell => {
            cell.classList.remove('selected', 'row-selected', 'col-selected');
        });
        
        // Apply selection styling to selected cells
        state.selectedCells.forEach(cellKey => {
            const [row, col] = cellKey.split('-').map(Number);
            const cell = document.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
            if (cell) {
                cell.classList.add('selected');
            }
        });
        
        // Highlight row numbers and column headers ONLY if all cells are selected (本当の全選択時のみ)
        const data = state.displayData || state.tableData;
        let allSelected = false;
        if (data && data.rows && data.headers) {
            allSelected = (state.selectedCells.size === data.rows.length * data.headers.length);
        }
        // 行番号
        if (data && data.rows) {
            for (let row = 0; row < data.rows.length; row++) {
                const rowNumber = document.querySelector(`td[data-row="${row}"][data-col="-1"]`);
                if (rowNumber) {
                    if (allSelected) {
                        rowNumber.classList.add('row-selected');
                    } else {
                        rowNumber.classList.remove('row-selected');
                    }
                }
            }
        }
        // 列ヘッダー
        if (data && data.headers) {
            for (let col = 0; col < data.headers.length; col++) {
                const columnHeader = document.querySelector(`th[data-col="${col}"]`);
                if (columnHeader) {
                    if (allSelected) {
                        columnHeader.classList.add('col-selected');
                    } else {
                        columnHeader.classList.remove('col-selected');
                    }
                }
            }
        }
    },
    
    /**
     * Update toolbar buttons based on current selection
     */
    updateToolbarButtons: function() {
        // This method can be used to enable/disable toolbar buttons
        // based on the current selection state
        const state = window.TableEditor.state;
        const hasSelection = state.selectedCells.size > 0;
        
        // Example: Enable/disable export button based on selection
        const exportBtn = document.querySelector('.export-btn');
        if (exportBtn) {
            exportBtn.disabled = !hasSelection;
        }
    },
    
    /**
     * Get currently selected cells as an array of {row, col} objects
     */
    getSelectedCells: function() {
        const state = window.TableEditor.state;
        const result = [];
        
        state.selectedCells.forEach(cellKey => {
            const [row, col] = cellKey.split('-').map(Number);
            result.push({ row, col });
        });
        
        return result;
    },
    
    /**
     * Get selected cell values as a 2D array
     */
    getSelectedCellValues: function() {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.rows) return [];
        
        const selectedCells = this.getSelectedCells();
        const values = [];
        
        selectedCells.forEach(({ row, col }) => {
            if (data.rows[row] && data.rows[row][col] !== undefined) {
                values.push({
                    row: row,
                    col: col,
                    value: data.rows[row][col]
                });
            }
        });
        
        return values;
    },
    
    /**
     * Start cell selection (for mouse drag selection)
     */
    startCellSelect: function(row, col) {
        const state = window.TableEditor.state;
        
        state.isSelecting = true;
        state.selectionStart = { row, col };
        
        // Clear current selection
        state.selectedCells.clear();
        state.selectedCells.add(`${row}-${col}`);
        
        this.updateCellSelection();
    },
    
    /**
     * Start row selection
     */
    startRowSelect: function(rowIndex) {
        const state = window.TableEditor.state;
        
        // Set row selection state
        state.isSelecting = false; // Not drag selecting
        
        // Select the row
        this.selectRow(rowIndex);
    },
    
    /**
     * Start column selection
     */
    startColumnSelect: function(colIndex) {
        const state = window.TableEditor.state;
        
        // Set column selection state
        state.isSelecting = false; // Not drag selecting
        
        // Select the column
        this.selectColumn(colIndex);
    },
    
    /**
     * Cleanup resources when module is being disposed
     */
    cleanup: function() {
        console.log('SelectionManager: Starting cleanup...');
        
        // Clear selection state
        const state = window.TableEditor.state;
        if (state) {
            state.selectedCells.clear();
            state.lastSelectedCell = null;
            state.isSelecting = false;
            state.selectionStart = null;
        }
        
        // Remove selection styling
        document.querySelectorAll('.selected, .row-selected, .col-selected').forEach(cell => {
            cell.classList.remove('selected', 'row-selected', 'col-selected');
        });
        
        console.log('SelectionManager: Cleanup completed');
    }
};

// Make SelectionManager globally available
window.SelectionManager = SelectionManager;

console.log('SelectionManager: Module script loaded');
