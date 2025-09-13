/**
 * Clipboard Manager Module for Markdown Table Editor
 * 
 * This module handles all clipboard operations, including:
 * - Copy selected cells
 * - Paste to selected cells
 * - Cut selected cells
 * - Data format conversion
 */

const ClipboardManager = {
    // Initialization state
    isInitialized: false,
    
    /**
     * Initialize the clipboard manager module
     */
    init: function() {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('ClipboardManager: Already initialized, skipping');
            return;
        }
        
        console.log('ClipboardManager: Initializing clipboard manager module...');
        
        this.isInitialized = true;
        console.log('ClipboardManager: Module initialized');
    },
    
    /**
     * Copy selected cells to clipboard
     */
    copySelectedCells: function() {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.rows || state.selectedCells.size === 0) {
            window.TableEditor.showError('No cells selected to copy');
            return;
        }
        
        // Get selected cells data
        const selectedData = this.getSelectedCellsData();
        if (!selectedData || selectedData.length === 0) {
            window.TableEditor.showError('No data to copy');
            return;
        }
        
        // Convert to clipboard format (TSV - Tab Separated Values)
        const clipboardText = this.convertToClipboardFormat(selectedData);
        
        // Try to copy to clipboard
        this.copyToClipboard(clipboardText).then(() => {
            window.TableEditor.showSuccess(`Copied ${selectedData.length} row(s) to clipboard`);
            console.log('ClipboardManager: Copied cells to clipboard');
        }).catch(error => {
            console.error('ClipboardManager: Failed to copy to clipboard:', error);
            window.TableEditor.showError('Failed to copy to clipboard');
        });
    },
    
    /**
     * Paste from clipboard to selected cells
     */
    pasteToSelectedCells: function() {
        const state = window.TableEditor.state;
        
        if (!state.lastSelectedCell) {
            window.TableEditor.showError('No cell selected for paste');
            return;
        }
        
        // Try to read from clipboard
        this.readFromClipboard().then(clipboardText => {
            if (!clipboardText || clipboardText.trim() === '') {
                window.TableEditor.showError('Clipboard is empty');
                return;
            }
            
            this.processPasteData(clipboardText);
        }).catch(error => {
            console.error('ClipboardManager: Failed to read from clipboard:', error);
            window.TableEditor.showError('Failed to read from clipboard');
        });
    },
    
    /**
     * Cut selected cells to clipboard
     */
    cutSelectedCells: function() {
        const state = window.TableEditor.state;
        
        if (state.selectedCells.size === 0) {
            window.TableEditor.showError('No cells selected to cut');
            return;
        }
        
        // First copy the data
        this.copySelectedCells();
        
        // Then clear the selected cells
        window.TableEditor.callModule('KeyboardNavigationManager', 'clearSelectedCells');
        
        console.log('ClipboardManager: Cut selected cells');
    },
    
    /**
     * Get data from selected cells (rectangular selection)
     */
    getSelectedCellsData: function() {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.rows || state.selectedCells.size === 0) {
            return [];
        }
        
        // Convert selected cells to a 2D array
        const cellsMap = new Map();
        state.selectedCells.forEach(cellKey => {
            const [row, col] = cellKey.split('-').map(Number);
            if (!cellsMap.has(row)) {
                cellsMap.set(row, new Map());
            }
            cellsMap.get(row).set(col, data.rows[row][col] || '');
        });
        
        // Find bounds of selection
        const rows = Array.from(cellsMap.keys()).sort((a, b) => a - b);
        if (rows.length === 0) return [];
        
        const minRow = rows[0];
        const maxRow = rows[rows.length - 1];
        
        let minCol = Infinity;
        let maxCol = -Infinity;
        cellsMap.forEach(rowMap => {
            const cols = Array.from(rowMap.keys());
            if (cols.length > 0) {
                minCol = Math.min(minCol, Math.min(...cols));
                maxCol = Math.max(maxCol, Math.max(...cols));
            }
        });
        
        // Build rectangular data array
        const result = [];
        for (let row = minRow; row <= maxRow; row++) {
            const rowData = [];
            for (let col = minCol; col <= maxCol; col++) {
                const cellValue = cellsMap.has(row) && cellsMap.get(row).has(col) 
                    ? cellsMap.get(row).get(col) 
                    : '';
                rowData.push(cellValue);
            }
            result.push(rowData);
        }
        
        return result;
    },

    /**
     * Get data from actually selected cells only (in row-column order, excluding unselected gaps)
     */
    getSelectedCellsDataCompact: function() {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.rows || state.selectedCells.size === 0) {
            return [];
        }
        
        // Get selected cells in sorted order
        const selectedCells = Array.from(state.selectedCells).map(cellKey => {
            const [row, col] = cellKey.split('-').map(Number);
            return { row, col, value: data.rows[row][col] || '' };
        }).sort((a, b) => a.row - b.row || a.col - b.col);
        
        // Return as a flat array that can be reshaped for clipboard
        return selectedCells.map(cell => cell.value);
    },
    
    /**
     * Convert data to clipboard format (TSV)
     */
    convertToClipboardFormat: function(data) {
        return data.map(row => 
            row.map(cell => {
                // Convert <br> tags to newlines for clipboard using centralized converter
                const cellText = window.TableEditor.callModule('ContentConverter', 'processForClipboard', cell || '');
                
                // If cell contains tabs, newlines, or quotes, we need to quote it
                if (cellText.includes('\t') || cellText.includes('\n') || cellText.includes('"')) {
                    // Escape quotes by doubling them and wrap in quotes
                    return '"' + cellText.replace(/"/g, '""') + '"';
                }
                return cellText;
            }).join('\t')
        ).join('\n');
    },
    
    /**
     * Process paste data and update cells
     */
    processPasteData: function(clipboardText) {
        const state = window.TableEditor.state;
        const data = state.tableData;
        
        if (!data || !data.rows) {
            return;
        }
        
        // Parse clipboard data
        const pasteData = this.parseClipboardData(clipboardText);
        if (!pasteData || pasteData.length === 0) {
            window.TableEditor.showError('No valid data to paste');
            return;
        }
        
        let updatedCells = 0;
        let expandedRows = 0;
        let expandedCols = 0;
        
        // Check if we have selected cells
        if (state.selectedCells.size > 0) {
            // Case 1: Multiple cells are selected - paste to all selected cells
            // If clipboard has single cell data, paste it to all selected cells
            // If clipboard has multiple cells, paste starting from the first selected cell
            
            if (pasteData.length === 1 && pasteData[0].length === 1) {
                // Single cell data - paste to all selected cells
                const singleValue = pasteData[0][0];
                const processedValue = window.TableEditor.callModule('ContentConverter', 'processForStorage', singleValue);
                
                state.selectedCells.forEach(cellKey => {
                    const [row, col] = cellKey.split('-').map(Number);
                    if (row < data.rows.length && col < data.headers.length) {
                        data.rows[row][col] = processedValue;
                        updatedCells++;
                        
                        // Send update to VSCode
                        window.TableEditor.callModule('TableManager', 'updateCell', row, col, processedValue);
                    }
                });
                
                console.log('ClipboardManager: Pasted single value to multiple selected cells');
            } else {
                // Multiple cell data - paste to selected cells in order (skipping unselected cells)
                const selectedCells = Array.from(state.selectedCells).map(cellKey => {
                    const [row, col] = cellKey.split('-').map(Number);
                    return { row, col };
                }).sort((a, b) => a.row - b.row || a.col - b.col);
                
                if (selectedCells.length > 0) {
                    // Flatten paste data into a single array
                    const flatPasteData = [];
                    pasteData.forEach(pasteRow => {
                        pasteRow.forEach(cellValue => {
                            flatPasteData.push(cellValue);
                        });
                    });
                    
                    // Map paste data to selected cells (compacting unselected gaps)
                    for (let i = 0; i < selectedCells.length && i < flatPasteData.length; i++) {
                        const targetCell = selectedCells[i];
                        const cellValue = flatPasteData[i];
                        
                        // Check if we need to expand the table
                        if (targetCell.row >= data.rows.length) {
                            while (data.rows.length <= targetCell.row) {
                                const newRow = new Array(data.headers.length).fill('');
                                data.rows.push(newRow);
                                expandedRows++;
                            }
                        }
                        
                        if (targetCell.col >= data.headers.length) {
                            while (data.headers.length <= targetCell.col) {
                                const newColIndex = data.headers.length;
                                const columnLetter = window.TableEditor.callModule('TableRenderer', 'getColumnLetter', newColIndex);
                                data.headers.push(`Column ${columnLetter}`);
                                
                                // Add empty cells to all existing rows
                                data.rows.forEach(row => {
                                    row.push('');
                                });
                                expandedCols++;
                            }
                        }
                        
                        // Paste the data to the selected cell
                        const processedValue = window.TableEditor.callModule('ContentConverter', 'processForStorage', cellValue);
                        data.rows[targetCell.row][targetCell.col] = processedValue;
                        updatedCells++;
                        
                        // Send update to VSCode
                        window.TableEditor.callModule('TableManager', 'updateCell', targetCell.row, targetCell.col, processedValue);
                    }
                    
                    console.log(`ClipboardManager: Pasted ${Math.min(selectedCells.length, flatPasteData.length)} cells to selected positions (compacting gaps)`);
                }
            }
        } else if (state.lastSelectedCell) {
            // Case 2: No multiple selection, use last selected cell as starting point
            const startRow = state.lastSelectedCell.row;
            const startCol = state.lastSelectedCell.col;
            
            // Check if we need to expand the table
            const requiredRows = startRow + pasteData.length;
            const requiredCols = startCol + (pasteData[0] ? pasteData[0].length : 0);
            
            // Expand rows if needed
            while (data.rows.length < requiredRows) {
                const newRow = new Array(data.headers.length).fill('');
                data.rows.push(newRow);
                expandedRows++;
            }
            
            // Expand columns if needed
            while (data.headers.length < requiredCols) {
                const newColIndex = data.headers.length;
                const columnLetter = window.TableEditor.callModule('TableRenderer', 'getColumnLetter', newColIndex);
                data.headers.push(`Column ${columnLetter}`);
                
                // Add empty cells to all existing rows
                data.rows.forEach(row => {
                    row.push('');
                });
                expandedCols++;
            }
            
            // Paste the data
            pasteData.forEach((pasteRow, rowOffset) => {
                pasteRow.forEach((cellValue, colOffset) => {
                    const targetRow = startRow + rowOffset;
                    const targetCol = startCol + colOffset;
                    
                    if (targetRow < data.rows.length && targetCol < data.headers.length) {
                        // Convert newlines back to <br> tags for storage
                        const processedValue = window.TableEditor.callModule('ContentConverter', 'processForStorage', cellValue);
                        data.rows[targetRow][targetCol] = processedValue;
                        updatedCells++;
                        
                        // Send update to VSCode
                        window.TableEditor.callModule('TableManager', 'updateCell', targetRow, targetCol, processedValue);
                    }
                });
            });
            
            console.log('ClipboardManager: Pasted data starting from last selected cell');
        } else {
            window.TableEditor.showError('No cell selected for paste');
            return;
        }
        
        // Update display data and re-render without full table rebuild
        state.displayData = data;
        
        // Save current scroll position
        const tableContainer = document.querySelector('.table-container');
        const scrollTop = tableContainer ? tableContainer.scrollTop : 0;
        const scrollLeft = tableContainer ? tableContainer.scrollLeft : 0;
        
        // Re-render table content only
        window.TableEditor.callModule('UIRenderer', 'renderTableInContainer', data);
        
        // Restore scroll position
        const newTableContainer = document.querySelector('.table-container');
        if (newTableContainer) {
            newTableContainer.scrollTop = scrollTop;
            newTableContainer.scrollLeft = scrollLeft;
        }
        
        // Show success message
        let message;
        if (state.selectedCells.size > 1) {
            message = `Pasted ${updatedCells} cell(s) to selected positions`;
        } else {
            message = `Pasted ${updatedCells} cell(s)`;
        }
        
        if (expandedRows > 0 || expandedCols > 0) {
            message += ` (expanded ${expandedRows} rows, ${expandedCols} columns)`;
        }
        window.TableEditor.showSuccess(message);
        
        console.log('ClipboardManager: Pasted data', {
            updatedCells,
            expandedRows,
            expandedCols
        });
    },
    
    /**
     * Parse clipboard data (TSV format)
     */
    parseClipboardData: function(clipboardText) {
        const result = [];
        let currentRow = [];
        let currentCell = '';
        let inQuotes = false;
        let i = 0;
        
        while (i < clipboardText.length) {
            const char = clipboardText[i];
            
            if (char === '"' && !inQuotes) {
                inQuotes = true;
            } else if (char === '"' && inQuotes) {
                if (i + 1 < clipboardText.length && clipboardText[i + 1] === '"') {
                    // Escaped quote
                    currentCell += '"';
                    i++; // Skip next quote
                } else {
                    inQuotes = false;
                }
            } else if (char === '\t' && !inQuotes) {
                currentRow.push(currentCell);
                currentCell = '';
            } else if (char === '\n' && !inQuotes) {
                // End of row
                currentRow.push(currentCell);
                if (currentRow.length > 0) {
                    result.push(currentRow);
                }
                currentRow = [];
                currentCell = '';
            } else {
                currentCell += char;
            }
            i++;
        }
        
        // Add final cell and row if any content remains
        if (currentCell !== '' || currentRow.length > 0) {
            currentRow.push(currentCell);
            if (currentRow.length > 0) {
                result.push(currentRow);
            }
        }
        
        return result;
    },
    
    /**
     * Copy text to clipboard using modern API or fallback
     */
    copyToClipboard: function(text) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            return this.fallbackCopyToClipboard(text);
        }
    },
    
    /**
     * Read text from clipboard using modern API
     */
    readFromClipboard: function() {
        if (navigator.clipboard && navigator.clipboard.readText) {
            return navigator.clipboard.readText();
        } else {
            // Cannot read from clipboard in older browsers
            return Promise.reject(new Error('Clipboard read not supported'));
        }
    },
    
    /**
     * Fallback copy method for older browsers
     */
    fallbackCopyToClipboard: function(text) {
        return new Promise((resolve, reject) => {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                const successful = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                if (successful) {
                    resolve();
                } else {
                    reject(new Error('Copy command failed'));
                }
            } catch (err) {
                document.body.removeChild(textArea);
                reject(err);
            }
        });
    }
};

// Make ClipboardManager globally available
window.ClipboardManager = ClipboardManager;

console.log('ClipboardManager: Module script loaded');
