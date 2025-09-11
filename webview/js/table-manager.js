/**
 * Table Management Module
 * 
 * Handles table data operations, CRUD operations, and table state management
 */

const TableManager = {
    /**
     * Initialize table manager
     */
    init: function() {
        console.log('TableManager: Initializing...');
        console.log('TableManager: Initialized');
    },

    /**
     * Handle table data update from VSCode
     */
    handleUpdateTableData: function (data, fileInfo, forceUpdate) {
        console.log('TableManager: handleUpdateTableData called with data:', data, 'fileInfo:', fileInfo, 'forceUpdate:', forceUpdate);
        console.log('TableManager: Current table index before update:', TableEditor.state.currentTableIndex);

        // Check if this is a file change or force update
        const isFileChange = forceUpdate || (fileInfo && TableEditor.state.fileInfo && 
            fileInfo.uri !== TableEditor.state.fileInfo.uri);
        
        if (isFileChange) {
            console.log('TableManager: File change detected or force update requested');
            // Reset table index for new file
            TableEditor.state.currentTableIndex = 0;
        }

        // Save current scroll position before processing update
        const scrollState = TableEditor.scrollManager.saveScrollPosition();
        console.log('TableManager: Saved scroll position before VSCode update:', scrollState);

        // Support both single table and multiple tables data structure
        if (Array.isArray(data)) {
            // Multiple tables
            console.log('TableManager: Processing multiple tables, count:', data.length);

            // Store the previous table index to preserve user's current view
            const previousTableIndex = TableEditor.state.currentTableIndex;
            TableEditor.state.allTables = data;

            // Ensure currentTableIndex is valid for the new data
            if (previousTableIndex >= 0 && previousTableIndex < data.length) {
                // Keep the same table index if it's still valid
                TableEditor.state.currentTableIndex = previousTableIndex;
                console.log('TableManager: Preserving table index', previousTableIndex);
            } else if (TableEditor.state.currentTableIndex >= data.length) {
                console.log('TableManager: Current table index', TableEditor.state.currentTableIndex, 'is out of range, resetting to 0');
                TableEditor.state.currentTableIndex = 0;
            } else if (TableEditor.state.currentTableIndex < 0) {
                console.log('TableManager: Current table index is negative, resetting to 0');
                TableEditor.state.currentTableIndex = 0;
            }

            TableEditor.state.tableData = data[TableEditor.state.currentTableIndex] || null;
            console.log('TableManager: Selected table at index', TableEditor.state.currentTableIndex, ':', TableEditor.state.tableData);
        } else {
            // Single table (legacy)
            console.log('TableManager: Processing single table');
            TableEditor.state.allTables = data ? [data] : [];
            TableEditor.state.currentTableIndex = 0;
            TableEditor.state.tableData = data;
        }

        console.log('TableManager: Final currentTableIndex:', TableEditor.state.currentTableIndex);
        console.log('TableManager: Final tableData:', TableEditor.state.tableData);

        TableEditor.state.displayData = TableEditor.state.tableData;
        TableEditor.state.originalData = TableEditor.state.tableData ? JSON.parse(JSON.stringify(TableEditor.state.tableData)) : null;
        
        // Update file info
        if (fileInfo) {
            TableEditor.state.fileInfo = fileInfo;
            console.log('TableManager: Updated file info:', fileInfo);
        }

        // Debug state after update
        this.debugCurrentState();

        // Clear any existing sort state when new data arrives
        TableEditor.state.sortState = {
            column: -1,
            direction: 'none',
            isViewOnly: false,
            originalData: null
        };

        // Save current selection state before re-rendering (only if not a file change)
        let savedSelectionState = null;
        if (!isFileChange) {
            savedSelectionState = window.TableEditor.callModule('SelectionManager', 'saveSelectionState');
            console.log('TableManager: Saved selection state before re-render');
        }

        // Show auto-saved status when table data is updated from server
        TableEditor.showAutoSavedStatus();

        // Render table with tabs if multiple tables exist, preserving scroll position
        console.log('TableManager: Calling renderApplicationWithTabs...');
        TableEditor.callModule('UIRenderer', 'renderApplicationWithTabs');

        // Restore selection state after re-rendering (only if not a file change)
        if (!isFileChange && savedSelectionState) {
            setTimeout(() => {
                window.TableEditor.callModule('SelectionManager', 'restoreSelectionState', savedSelectionState);
                console.log('TableManager: Restored selection state after re-render');
            }, 100); // Allow DOM to settle before restoring selection
        }

        // Restore scroll position only if it's not a file change
        if (!isFileChange) {
            TableEditor.scrollManager.restoreScrollPosition(scrollState, 'TableManager.handleUpdateTableData');
        } else {
            console.log('TableManager: File change detected, not restoring scroll position');
        }

        // Update status bar after rendering
        setTimeout(() => {
            TableEditor.callModule('StatusBarManager', 'updateTableDimensions');
        }, 200);
    },

    /**
     * Handle setting active table from VSCode
     */
    handleSetActiveTable: function (data) {
        if (data && typeof data.index === 'number') {
            this.switchToTable(data.index);
        }
    },

    /**
     * Handle cell update error from VSCode
     */
    handleCellUpdateError: function (errorData) {
        const { row, col, error } = errorData;
        console.error('TableManager: Cell update failed for row', row, 'col', col, ':', error);

        // Clear any pending save status timeouts
        if (TableEditor.state.saveStatusTimeouts.cell) {
            clearTimeout(TableEditor.state.saveStatusTimeouts.cell);
            TableEditor.state.saveStatusTimeouts.cell = null;
        }
        if (TableEditor.state.saveStatusTimeouts.header) {
            clearTimeout(TableEditor.state.saveStatusTimeouts.header);
            TableEditor.state.saveStatusTimeouts.header = null;
        }
        if (TableEditor.state.saveStatusTimeouts.table) {
            clearTimeout(TableEditor.state.saveStatusTimeouts.table);
            TableEditor.state.saveStatusTimeouts.table = null;
        }

        // Could implement rollback logic here if needed
        // For now, just show an error message
        TableEditor.showError(`Failed to update cell at row ${row + 1}, column ${col + 1}: ${error}`);

        // Show save error status
        TableEditor.showSaveError();
    },

    /**
     * Switch to a different table
     */
    switchToTable: function (index) {
        console.log('TableManager: switchToTable called with index:', index);
        console.log('TableManager: Current state - currentTableIndex:', TableEditor.state.currentTableIndex, 'allTables.length:', TableEditor.state.allTables.length);

        if (index >= 0 && index < TableEditor.state.allTables.length) {
            console.log('TableManager: Switching from table', TableEditor.state.currentTableIndex, 'to table', index);

            // Update current table index FIRST
            TableEditor.state.currentTableIndex = index;
            TableEditor.state.tableData = TableEditor.state.allTables[index];
            TableEditor.state.displayData = TableEditor.state.tableData;
            TableEditor.state.originalData = JSON.parse(JSON.stringify(TableEditor.state.tableData));

            console.log('TableManager: Updated currentTableIndex to:', TableEditor.state.currentTableIndex);
            console.log('TableManager: New tableData:', TableEditor.state.tableData ? 'loaded' : 'null');

            // Clear sort state when switching tables
            TableEditor.state.sortState = {
                column: -1,
                direction: 'none',
                isViewOnly: false,
                originalData: null
            };

            // Clear selection state when switching tables
            TableEditor.state.selectedCells.clear();
            TableEditor.state.selectionStart = null;
            TableEditor.state.isSelecting = false;
            TableEditor.state.lastSelectedCell = null;
            TableEditor.state.rangeSelectionAnchor = null;

            // Re-render with new table
            TableEditor.callModule('UIRenderer', 'renderApplicationWithTabs');

            // Update status bar after switching tables
            setTimeout(() => {
                TableEditor.callModule('StatusBarManager', 'updateTableDimensions');
            }, 100);

            // Send table switch notification to VSCode
            TableEditor.callModule('VSCodeCommunication', 'sendMessage', {
                command: 'switchTable',
                data: { index: index }
            });

            console.log('TableManager: Successfully switched to table', index, 'currentTableIndex is now:', TableEditor.state.currentTableIndex);
        } else {
            console.error('TableManager: Invalid table index:', index, 'valid range: 0 -', TableEditor.state.allTables.length - 1);
        }
    },

    /**
     * Add a new row to the table
     */
    addRow: function (index) {
        TableEditor.scrollManager.withScrollPreservation(() => {
            const data = TableEditor.state.displayData || TableEditor.state.tableData;
            if (!data || !data.headers) {
                console.error('TableManager: No table data available');
                return;
            }

            // Create new empty row
            const newRow = new Array(data.headers.length).fill('');

            // Insert at specified index
            if (index >= 0 && index <= data.rows.length) {
                data.rows.splice(index, 0, newRow);
            } else {
                data.rows.push(newRow);
                index = data.rows.length - 1;
            }

            // Create a new data object (like sorting does) instead of modifying in place
            const newData = {
                headers: [...data.headers],
                rows: data.rows.map(row => [...row])
            };

            // Update table data
            TableEditor.state.tableData = newData;
            TableEditor.state.displayData = newData;

            // Re-render table with scroll preservation (same method as sorting)
            TableEditor.callModule('UIRenderer', 'renderTableInContainer', newData);
        }, 'TableManager.addRow');

        // Send addRow command to extension with current table index
        TableEditor.callModule('VSCodeCommunication', 'sendMessage', {
            command: 'addRow',
            data: {
                index: index,
                tableIndex: TableEditor.state.currentTableIndex
            }
        });
    },

    /**
     * Delete a row from the table
     */
    deleteRow: function (index) {
        this.deleteRows([index]);
    },

    /**
     * Delete multiple rows from the table
     */
    deleteRows: function (indices) {
        if (!Array.isArray(indices) || indices.length === 0) {
            console.error('TableManager: Invalid indices array');
            return;
        }

        TableEditor.scrollManager.withScrollPreservation(() => {
            const data = TableEditor.state.displayData || TableEditor.state.tableData;
            if (!data || !data.rows) {
                console.error('TableManager: No table data available');
                return;
            }

            // Validate all indices
            const validIndices = indices.filter(index => 
                index >= 0 && index < data.rows.length
            );

            if (validIndices.length === 0) {
                console.error('TableManager: No valid row indices');
                return;
            }

            // Check if trying to delete all rows
            if (validIndices.length >= data.rows.length) {
                TableEditor.showError('Cannot delete all rows');
                return;
            }

            // Sort indices in descending order to avoid index shifting issues
            const sortedIndices = validIndices.sort((a, b) => b - a);

            // Remove rows from highest index to lowest
            sortedIndices.forEach(index => {
                data.rows.splice(index, 1);
            });

            // Create a new data object
            const newData = {
                headers: [...data.headers],
                rows: data.rows.map(row => [...row])
            };

            // Update table data
            TableEditor.state.tableData = newData;
            TableEditor.state.displayData = newData;

            // Clear selection state after deletion
            TableEditor.state.selectedCells.clear();
            TableEditor.state.lastSelectedCell = null;
            TableEditor.state.rangeSelectionAnchor = null;

            // Re-render table with scroll preservation
            TableEditor.callModule('UIRenderer', 'renderTableInContainer', newData);
        }, 'TableManager.deleteRows');

        // Send deleteRows command to extension with current table index
        TableEditor.callModule('VSCodeCommunication', 'sendMessage', {
            command: 'deleteRows',
            data: {
                indices: indices,
                tableIndex: TableEditor.state.currentTableIndex
            }
        });

        console.log(`TableManager: Deleted ${indices.length} row(s)`);
    },

    /**
     * Add a new column to the table
     */
    addColumn: function (index, headerName) {
        TableEditor.scrollManager.withScrollPreservation(() => {
            const data = TableEditor.state.displayData || TableEditor.state.tableData;
            if (!data || !data.headers) {
                console.error('TableManager: No table data available');
                return;
            }

            headerName = headerName || `Column ${index + 1}`;

            // Insert header
            if (index >= 0 && index <= data.headers.length) {
                data.headers.splice(index, 0, headerName);
            } else {
                data.headers.push(headerName);
                index = data.headers.length - 1;
            }

            // Insert empty cells in all rows
            data.rows.forEach(row => {
                if (index >= 0 && index <= row.length) {
                    row.splice(index, 0, '');
                } else {
                    row.push('');
                }
            });

            // Create a new data object (like sorting does) instead of modifying in place
            const newData = {
                headers: [...data.headers],
                rows: data.rows.map(row => [...row])
            };

            // Update table data
            TableEditor.state.tableData = newData;
            TableEditor.state.displayData = newData;

            // Re-render table with scroll preservation (same method as sorting)
            TableEditor.callModule('UIRenderer', 'renderTableInContainer', newData);
        }, 'TableManager.addColumn');

        // Send addColumn command to extension with current table index
        TableEditor.callModule('VSCodeCommunication', 'sendMessage', {
            command: 'addColumn',
            data: {
                index: index,
                header: headerName,
                tableIndex: TableEditor.state.currentTableIndex
            }
        });
    },

    /**
     * Delete a column from the table
     */
    deleteColumn: function (index) {
        this.deleteColumns([index]);
    },

    /**
     * Delete multiple columns from the table
     */
    deleteColumns: function (indices) {
        if (!Array.isArray(indices) || indices.length === 0) {
            console.error('TableManager: Invalid indices array');
            return;
        }

        TableEditor.scrollManager.withScrollPreservation(() => {
            const data = TableEditor.state.displayData || TableEditor.state.tableData;
            if (!data || !data.headers) {
                console.error('TableManager: No table data available');
                return;
            }

            // Validate all indices
            const validIndices = indices.filter(index => 
                index >= 0 && index < data.headers.length
            );

            if (validIndices.length === 0) {
                console.error('TableManager: No valid column indices');
                return;
            }

            // Check if trying to delete all columns
            if (validIndices.length >= data.headers.length) {
                TableEditor.showError('Cannot delete all columns');
                return;
            }

            // Sort indices in descending order to avoid index shifting issues
            const sortedIndices = validIndices.sort((a, b) => b - a);

            // Remove headers from highest index to lowest
            sortedIndices.forEach(index => {
                data.headers.splice(index, 1);
            });

            // Remove cells from all rows
            data.rows.forEach(row => {
                sortedIndices.forEach(index => {
                    if (index < row.length) {
                        row.splice(index, 1);
                    }
                });
            });

            // Create a new data object
            const newData = {
                headers: [...data.headers],
                rows: data.rows.map(row => [...row])
            };

            // Update table data
            TableEditor.state.tableData = newData;
            TableEditor.state.displayData = newData;

            // Clear selection state after deletion
            TableEditor.state.selectedCells.clear();
            TableEditor.state.lastSelectedCell = null;
            TableEditor.state.rangeSelectionAnchor = null;

            // Re-render table with scroll preservation
            TableEditor.callModule('UIRenderer', 'renderTableInContainer', newData);
        }, 'TableManager.deleteColumns');

        // Send deleteColumns command to extension with current table index
        TableEditor.callModule('VSCodeCommunication', 'sendMessage', {
            command: 'deleteColumns',
            data: {
                indices: indices,
                tableIndex: TableEditor.state.currentTableIndex
            }
        });

        console.log(`TableManager: Deleted ${indices.length} column(s)`);
    },

    /**
     * Update a header column name
     */
    updateHeader: function (col, value) {
        console.log('TableManager: Updating header', col, 'with value:', value);
        console.log('TableManager: Current table index:', TableEditor.state.currentTableIndex);

        const data = TableEditor.state.displayData || TableEditor.state.tableData;
        if (!data || !data.headers || col < 0 || col >= data.headers.length) {
            console.error('TableManager: Invalid header column index');
            return;
        }

        // Update the header value
        data.headers[col] = value;

        // Update both tableData and displayData
        TableEditor.state.tableData = data;
        TableEditor.state.displayData = data;

        // Debug current state before sending update
        this.debugCurrentState();

        // Show saving status
        TableEditor.showSavingStatus();

        // Clear any existing timeout for header updates
        if (TableEditor.state.saveStatusTimeouts.header) {
            clearTimeout(TableEditor.state.saveStatusTimeouts.header);
        }

        // Send update to extension (with auto-save and current table index)
        if (TableEditor.vscode) {
            console.log('TableManager: Sending updateHeader command with tableIndex:', TableEditor.state.currentTableIndex);
            TableEditor.vscode.postMessage({
                command: 'updateHeader',
                data: {
                    col: col,
                    value: value,
                    tableIndex: TableEditor.state.currentTableIndex
                }
            });

            // Show auto-saved status after a short delay
            TableEditor.state.saveStatusTimeouts.header = setTimeout(() => {
                TableEditor.showAutoSavedStatus();
                TableEditor.state.saveStatusTimeouts.header = null;
            }, 500);
        }

        console.log('TableManager: Header updated successfully');
    },

    /**
     * Update a single cell value
     */
    updateCell: function (row, col, value) {
        console.log('TableManager: Updating cell', row, col, 'with value:', value);
        console.log('TableManager: Current table index:', TableEditor.state.currentTableIndex);

        const data = TableEditor.state.displayData || TableEditor.state.tableData;
        if (!data || !data.rows || row < 0 || row >= data.rows.length) {
            console.error('TableManager: Invalid row index');
            return;
        }

        if (col < 0 || col >= data.rows[row].length) {
            console.error('TableManager: Invalid column index');
            return;
        }

        // Update the cell value
        data.rows[row][col] = value;

        // Update both tableData and displayData
        TableEditor.state.tableData = data;
        TableEditor.state.displayData = data;

        // Debug current state before sending update
        this.debugCurrentState();

        // Show saving status
        TableEditor.showSavingStatus();

        // Clear any existing timeout for cell updates
        if (TableEditor.state.saveStatusTimeouts.cell) {
            clearTimeout(TableEditor.state.saveStatusTimeouts.cell);
        }

        // Send update to extension (with auto-save and current table index)
        if (TableEditor.vscode) {
            console.log('TableManager: Sending updateCell command with tableIndex:', TableEditor.state.currentTableIndex);
            TableEditor.vscode.postMessage({
                command: 'updateCell',
                data: {
                    row: row,
                    col: col,
                    value: value,
                    tableIndex: TableEditor.state.currentTableIndex
                }
            });

            // Show auto-saved status after a short delay
            TableEditor.state.saveStatusTimeouts.cell = setTimeout(() => {
                TableEditor.showAutoSavedStatus();
                TableEditor.state.saveStatusTimeouts.cell = null;
            }, 500);
        }

        console.log('TableManager: Cell updated successfully');
    },

    /**
     * Send table update to extension
     */
    sendTableUpdate: function () {
        if (TableEditor.vscode && TableEditor.state.tableData) {
            // Show saving status
            TableEditor.showSavingStatus();

            // Clear any existing timeout for table updates
            if (TableEditor.state.saveStatusTimeouts.table) {
                clearTimeout(TableEditor.state.saveStatusTimeouts.table);
            }

            TableEditor.vscode.postMessage({
                command: 'updateTableData',
                data: TableEditor.state.tableData
            });

            // Show auto-saved status after a short delay
            TableEditor.state.saveStatusTimeouts.table = setTimeout(() => {
                TableEditor.showAutoSavedStatus();
                TableEditor.state.saveStatusTimeouts.table = null;
            }, 500);
        }
    },

    /**
     * Debug function to check current state
     */
    debugCurrentState: function () {
        console.log('=== TableManager Debug State ===');
        console.log('currentTableIndex:', TableEditor.state.currentTableIndex);
        console.log('allTables.length:', TableEditor.state.allTables.length);
        console.log('tableData exists:', !!TableEditor.state.tableData);
        console.log('displayData exists:', !!TableEditor.state.displayData);
        if (TableEditor.state.tableData) {
            console.log('tableData.id:', TableEditor.state.tableData.id);
            console.log('tableData.metadata.tableIndex:', TableEditor.state.tableData.metadata?.tableIndex);
        }
        console.log('===============================');
    },

    /**
     * Cleanup table manager resources
     */
    cleanup: function() {
        // Clear any pending timeouts
        Object.keys(TableEditor.state.saveStatusTimeouts).forEach(key => {
            if (TableEditor.state.saveStatusTimeouts[key]) {
                clearTimeout(TableEditor.state.saveStatusTimeouts[key]);
                TableEditor.state.saveStatusTimeouts[key] = null;
            }
        });

        // Clear state
        TableEditor.state.selectedCells.clear();
        TableEditor.state.currentEditingCell = null;
        TableEditor.state.tableData = null;
        TableEditor.state.rangeSelectionAnchor = null;
        TableEditor.state.displayData = null;
        TableEditor.state.originalData = null;

        console.log('TableManager: Cleaned up');
    }
};

// Register the module
if (window.TableEditor) {
    window.TableEditor.registerModule('TableManager', TableManager);
} else {
    // If TableEditor is not available yet, store the module for later registration
    window.TableManager = TableManager;
}

console.log('TableManager: Module loaded');