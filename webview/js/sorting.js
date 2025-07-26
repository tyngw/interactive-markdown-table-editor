/**
 * Sorting Manager Module for Markdown Table Editor
 * 
 * This module handles all table sorting operations, including:
 * - Column header click handling
 * - View-only sorting
 * - Sort state management
 * - Sort actions panel control
 */

const SortingManager = {
    // Initialization state
    isInitialized: false,
    
    /**
     * Initialize the sorting manager module
     */
    init: function() {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('SortingManager: Already initialized, skipping');
            return;
        }
        
        console.log('SortingManager: Initializing sorting manager module...');
        
        this.isInitialized = true;
        console.log('SortingManager: Module initialized');
    },
    
    /**
     * Handle column header click (selection vs sorting)
     */
    handleColumnHeaderClick: function(columnIndex, event) {
        const state = window.TableEditor.state;
        
        // Check if this is a selection click (with modifier keys)
        if (event.ctrlKey || event.metaKey || event.shiftKey) {
            // Delegate to selection manager
            window.TableEditor.callModule('SelectionManager', 'selectColumn', columnIndex, event);
            return;
        }
        
        // Apply sort to the view
        this.applySortView(columnIndex);
    },
    
    /**
     * Apply view-only sort (does not modify file)
     */
    applySortView: function(columnIndex) {
        const state = window.TableEditor.state;
        const data = state.tableData;
        
        if (!data || !data.rows || !data.headers || columnIndex < 0 || columnIndex >= data.headers.length) {
            console.warn('SortingManager: Invalid sort parameters');
            return;
        }
        
        // Store original data if this is the first sort
        if (!state.sortState.isViewOnly) {
            state.sortState.originalData = JSON.parse(JSON.stringify(data));
        }
        
        // Determine sort direction
        let direction = 'asc';
        if (state.sortState.column === columnIndex) {
            if (state.sortState.direction === 'asc') {
                direction = 'desc';
            } else if (state.sortState.direction === 'desc') {
                direction = 'none'; // Reset to original
            }
        }
        
        // Update sort state
        state.sortState = {
            column: columnIndex,
            direction: direction,
            isViewOnly: true,
            originalData: state.sortState.originalData || JSON.parse(JSON.stringify(data))
        };
        
        if (direction === 'none') {
            // Restore original view
            this.restoreOriginalView();
        } else {
            // Apply sort
            const sortedData = this.sortTableData(data, columnIndex, direction);
            state.displayData = sortedData;
            
            // Re-render table with sorted data
            const renderer = window.TableEditor.getModule('TableRenderer');
            if (renderer) {
                renderer.renderTableWithScrollPreservation(sortedData);
            }
        }
        
        // Update sort actions visibility
        this.updateSortActionsVisibility();
        
        // Update sort status
        this.updateSortStatusInfo();
        
        console.log('SortingManager: Applied sort view', columnIndex, direction);
    },
    
    /**
     * Restore original view (before any sorting)
     */
    restoreOriginalView: function() {
        const state = window.TableEditor.state;
        
        if (!state.sortState.originalData) {
            console.warn('SortingManager: No original data to restore');
            return;
        }
        
        // Restore original data
        state.displayData = state.sortState.originalData;
        
        // Clear sort state
        state.sortState = {
            column: -1,
            direction: 'none',
            isViewOnly: false,
            originalData: null
        };
        
        // Re-render table
        const renderer = window.TableEditor.getModule('TableRenderer');
        if (renderer) {
            renderer.renderTableWithScrollPreservation(state.displayData);
        }
        
        // Update sort actions visibility
        this.updateSortActionsVisibility();
        
        console.log('SortingManager: Restored original view');
    },
    
    /**
     * Commit current sort to file
     */
    commitSortToFile: function() {
        const state = window.TableEditor.state;
        
        if (!state.sortState.isViewOnly || !state.displayData) {
            console.warn('SortingManager: No view-only sort to commit');
            return;
        }
        
        // Send sort command to VSCode
        window.TableEditor.sendMessage({
            command: 'sort',
            data: {
                column: state.sortState.column,
                direction: state.sortState.direction
            }
        });
        
        // Update table data to reflect the new sorted state
        state.tableData = JSON.parse(JSON.stringify(state.displayData));
        
        // Clear sort state since data is now saved
        state.sortState = {
            column: -1,
            direction: 'none',
            isViewOnly: false,
            originalData: null
        };
        
        // Update sort actions visibility
        this.updateSortActionsVisibility();
        
        console.log('SortingManager: Committed sort to file');
    },
    
    /**
     * Update sort actions panel visibility
     */
    updateSortActionsVisibility: function() {
        const state = window.TableEditor.state;
        const sortActions = document.getElementById('sortActions');
        
        if (sortActions) {
            if (state.sortState.isViewOnly) {
                sortActions.style.display = 'flex';
            } else {
                sortActions.style.display = 'none';
            }
        }
    },
    
    /**
     * Update sort status information
     */
    updateSortStatusInfo: function() {
        const state = window.TableEditor.state;
        const statusBadge = document.querySelector('.sort-status-badge');
        
        if (statusBadge && state.sortState.isViewOnly) {
            const columnLetter = window.TableEditor.callModule('TableRenderer', 'getColumnLetter', state.sortState.column);
            const direction = state.sortState.direction === 'asc' ? '↑' : '↓';
            statusBadge.textContent = `📊 Sorted by ${columnLetter} ${direction}`;
        }
    },
    
    /**
     * Sort table data utility function
     */
    sortTableData: function(data, columnIndex, direction) {
        if (!data || !data.rows || !data.headers) {
            return data;
        }
        
        // Create a copy of the data
        const sortedData = {
            headers: [...data.headers],
            rows: [...data.rows.map(row => [...row])]
        };
        
        // Sort the rows
        sortedData.rows.sort((a, b) => {
            const aValue = a[columnIndex] || '';
            const bValue = b[columnIndex] || '';
            
            // Convert to strings for comparison
            const aStr = String(aValue).toLowerCase();
            const bStr = String(bValue).toLowerCase();
            
            // Try to parse as numbers for numeric sorting
            const aNum = parseFloat(aStr);
            const bNum = parseFloat(bStr);
            
            let result = 0;
            
            // Use numeric comparison if both values are numbers
            if (!isNaN(aNum) && !isNaN(bNum)) {
                result = aNum - bNum;
            } else {
                // Use string comparison
                result = aStr.localeCompare(bStr);
            }
            
            // Apply direction
            return direction === 'asc' ? result : -result;
        });
        
        return sortedData;
    },
    
    /**
     * Legacy sort function (kept for compatibility)
     */
    sortByColumn: function(columnIndex) {
        this.applySortView(columnIndex);
    },
    
    /**
     * Restore original view (remove sorting)
     */
    restoreOriginalView: function() {
        const state = window.TableEditor.state;
        
        console.log('SortingManager: Restoring original view');
        
        // Reset to original data
        if (state.originalData) {
            state.displayData = JSON.parse(JSON.stringify(state.originalData));
            state.tableData = state.displayData;
        }
        
        // Reset sort state
        state.sortState = {
            column: -1,
            direction: 'none',
            isViewOnly: false,
            originalData: null
        };
        
        // Re-render table
        window.TableEditor.callModule('TableRenderer', 'renderTable', state.displayData);
        
        // Update UI
        this.updateSortActionsVisibility();
        this.updateSortStatusInfo();
        
        console.log('SortingManager: Original view restored');
    },
    
    /**
     * Commit current sort to file
     */
    commitSortToFile: function() {
        const state = window.TableEditor.state;
        
        if (!state.sortState.isViewOnly || !state.displayData) {
            console.warn('SortingManager: No sort to commit or already committed');
            return;
        }
        
        console.log('SortingManager: Committing sort to file');
        
        // Update the base table data
        state.tableData = JSON.parse(JSON.stringify(state.displayData));
        state.originalData = JSON.parse(JSON.stringify(state.displayData));
        
        // Mark as committed (no longer view-only)
        state.sortState.isViewOnly = false;
        
        // Send update to VSCode extension
        if (window.TableEditor.vscode) {
            // Send the entire sorted data to update the file
            const updates = [];
            state.tableData.rows.forEach((row, rowIndex) => {
                row.forEach((cell, colIndex) => {
                    updates.push({
                        row: rowIndex,
                        col: colIndex,
                        value: cell || ''
                    });
                });
            });
            
            // Send bulk update
            window.TableEditor.vscode.postMessage({
                command: 'bulkUpdate',
                data: {
                    updates: updates,
                    tableData: state.tableData
                }
            });
        }
        
        // Update UI
        this.updateSortActionsVisibility();
        this.updateSortStatusInfo();
        
        console.log('SortingManager: Sort committed to file');
    },
    
    /**
     * Update sort actions panel visibility
     */
    updateSortActionsVisibility: function() {
        const state = window.TableEditor.state;
        const sortActions = document.getElementById('sortActions');
        
        if (sortActions) {
            if (state.sortState.isViewOnly && state.sortState.column !== -1) {
                sortActions.style.display = 'flex';
            } else {
                sortActions.style.display = 'none';
            }
        }
    },
    
    /**
     * Update sort status information in status bar
     */
    updateSortStatusInfo: function() {
        const state = window.TableEditor.state;
        const sortStatusInfo = document.getElementById('sortStatusInfo');
        
        if (sortStatusInfo) {
            if (state.sortState.column !== -1) {
                const columnLetter = this.getColumnLetter(state.sortState.column);
                const direction = state.sortState.direction === 'asc' ? '↑' : '↓';
                const mode = state.sortState.isViewOnly ? '(View Only)' : '(Committed)';
                sortStatusInfo.textContent = `Sorted: ${columnLetter} ${direction} ${mode}`;
                sortStatusInfo.style.display = 'inline';
            } else {
                sortStatusInfo.style.display = 'none';
            }
        }
    },
    
    /**
     * Get Excel-style column letter (A, B, C, ..., Z, AA, AB, ...)
     */
    getColumnLetter: function(index) {
        let result = '';
        while (index >= 0) {
            result = String.fromCharCode(65 + (index % 26)) + result;
            index = Math.floor(index / 26) - 1;
        }
        return result;
    }
};

// Make SortingManager globally available
window.SortingManager = SortingManager;

console.log('SortingManager: Module script loaded');
