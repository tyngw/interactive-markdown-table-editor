/**
 * Keyboard Navigation Manager Module for Markdown Table Editor
 * 
 * This module handles all keyboard navigation operations, including:
 * - Arrow key navigation
 * - Tab navigation
 * - Smart navigation (Ctrl+Arrow)
 * - Keyboard shortcuts
 */

const KeyboardNavigationManager = {
    // Initialization state
    isInitialized: false,
    _shiftKeyListenerAdded: false,

    /**
     * Initialize the keyboard navigation manager module
     */
    init: function () {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('KeyboardNavigationManager: Already initialized, skipping');
            return;
        }

        console.log('KeyboardNavigationManager: Initializing keyboard navigation module...');

        this.isInitialized = true;
        console.log('KeyboardNavigationManager: Module initialized');

        // ShiftキーupでselectionStartを必ず解除（グローバル）
        if (!this._shiftKeyListenerAdded) {
            document.addEventListener('keyup', function (e) {
                if (e.key === 'Shift') {
                    const state = window.TableEditor.state;
                    state.selectionStart = null;
                }
            });
            this._shiftKeyListenerAdded = true;
        }
    },

    /**
     * Handle keyboard events
     */
    handleKeyDown: function (event) {
        // Shiftキーが押された瞬間にselectionStartをセット（Excel風）
        const state = window.TableEditor.state;
        if (event.key === 'Shift' && !state.selectionStart && state.lastSelectedCell) {
            state.selectionStart = { ...state.lastSelectedCell };
            // 範囲選択のアンカーセルも同時に設定
            if (!state.rangeSelectionAnchor) {
                state.rangeSelectionAnchor = { ...state.lastSelectedCell };
            }
        }

        // Don't handle keys while editing unless it's navigation or special shortcuts
        if (state.currentEditingCell && !state.isComposing) {
            // Allow certain shortcuts even while editing
            if (event.ctrlKey || event.metaKey) {
                if (['c', 'v', 'x', 'a', 'z', 'y'].includes(event.key.toLowerCase())) {
                    // Ctrl+C/V/X/A/Z/Y - allow browser default behavior
                    return;
                }
            }

            // Let cell editor handle Enter, Tab, Escape
            if (['Enter', 'Tab', 'Escape'].includes(event.key)) {
                return; // Cell editor will handle these
            }

            // Block other keys during editing
            return;
        }

        // Only handle navigation if we have a selection
        if (!state.lastSelectedCell || state.selectedCells.size === 0) {
            return;
        }

        const currentRow = state.lastSelectedCell.row;
        const currentCol = state.lastSelectedCell.col;
        const data = state.displayData || state.tableData;

        if (!data || !data.rows || !data.headers) {
            return;
        }

        // Arrow key navigation
        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowLeft':
            case 'ArrowRight': {
                event.preventDefault();
                let nextRow = currentRow;
                let nextCol = currentCol;
                let direction = null;

                // 範囲選択状態で矢印キー（Shiftなし）が押された場合、
                // アンカーセルを基準にナビゲーション
                if (!event.shiftKey && state.selectedCells.size > 1 && state.rangeSelectionAnchor) {
                    console.log('KeyboardNavigationManager: Range selection detected, using anchor cell:', state.rangeSelectionAnchor);
                    console.log('KeyboardNavigationManager: Current lastSelectedCell:', state.lastSelectedCell);
                    
                    // アンカーセルを基準に移動方向を計算（初期値をアンカーセルに設定）
                    const anchorRow = state.rangeSelectionAnchor.row;
                    const anchorCol = state.rangeSelectionAnchor.col;
                    nextRow = anchorRow;  // アンカーセルの行を基準にする
                    nextCol = anchorCol;  // アンカーセルの列を基準にする

                    if (event.key === 'ArrowUp') {
                        nextRow = anchorRow - 1;
                    } else if (event.key === 'ArrowDown') {
                        nextRow = anchorRow + 1;
                    } else if (event.key === 'ArrowLeft') {
                        nextCol = anchorCol - 1;
                    } else if (event.key === 'ArrowRight') {
                        nextCol = anchorCol + 1;
                    }

                    console.log('KeyboardNavigationManager: Navigating from anchor to:', nextRow, nextCol);
                    
                    // 範囲選択を解除して単一セル選択に移行
                    this.navigateCell(nextRow, nextCol);
                    return;
                }

                // 通常の移動方向計算
                if (event.key === 'ArrowUp') {
                    direction = 'up';
                    nextRow = currentRow - 1;
                } else if (event.key === 'ArrowDown') {
                    direction = 'down';
                    nextRow = currentRow + 1;
                } else if (event.key === 'ArrowLeft') {
                    direction = 'left';
                    nextCol = currentCol - 1;
                } else if (event.key === 'ArrowRight') {
                    direction = 'right';
                    nextCol = currentCol + 1;
                }

                // Excel風: Ctrl+矢印はスマートナビゲーション
                if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
                    this.navigateCellSmart(currentRow, currentCol, direction);
                } else if (event.shiftKey) {
                    // Shift+矢印: 範囲選択（始点はShift押下時のselectionStart）
                    nextRow = Math.max(0, Math.min(data.rows.length - 1, nextRow));
                    nextCol = Math.max(0, Math.min(data.headers.length - 1, nextCol));
                    let start = state.selectionStart ? state.selectionStart : { row: currentRow, col: currentCol };
                    
                    // 範囲選択のアンカーセルを設定（まだ設定されていない場合）
                    if (!state.rangeSelectionAnchor) {
                        state.rangeSelectionAnchor = { ...start };
                        console.log('KeyboardNavigationManager: Set range selection anchor:', state.rangeSelectionAnchor);
                    }
                    
                    window.TableEditor.callModule('SelectionManager', 'selectRange', start.row, start.col, nextRow, nextCol);
                    // スクロールも追従
                    this.scrollToCell(nextRow, nextCol);
                } else {
                    // 通常: 1セル移動＆単一選択
                    this.navigateCell(nextRow, nextCol);
                }
                break;
            }

            case 'Home':
                event.preventDefault();
                if (event.ctrlKey || event.metaKey) {
                    this.navigateCell(0, 0); // Top-left corner
                } else {
                    this.navigateCell(currentRow, 0); // Start of row
                }
                break;

            case 'End':
                event.preventDefault();
                if (event.ctrlKey || event.metaKey) {
                    this.navigateCell(data.rows.length - 1, data.headers.length - 1); // Bottom-right corner
                } else {
                    this.navigateCell(currentRow, data.headers.length - 1); // End of row
                }
                break;

            case 'PageUp':
                event.preventDefault();
                this.navigateCell(Math.max(0, currentRow - 10), currentCol);
                break;

            case 'PageDown':
                event.preventDefault();
                this.navigateCell(Math.min(data.rows.length - 1, currentRow + 10), currentCol);
                break;

            case 'Enter':
                if (!state.currentEditingCell) {
                    event.preventDefault();
                    window.TableEditor.callModule('CellEditor', 'startCellEdit', currentRow, currentCol);
                }
                break;

            case 'Tab':
                if (!state.currentEditingCell) {
                    event.preventDefault();
                    // Tab navigation in non-edit mode: next cell (Tab) or previous cell (Shift+Tab)
                    this.navigateToNextCell(currentRow, currentCol, !event.shiftKey);
                }
                break;

            case 'F2':
                event.preventDefault();
                window.TableEditor.callModule('CellEditor', 'startCellEdit', currentRow, currentCol);
                break;

            case 'Delete':
            case 'Backspace':
                if (!state.currentEditingCell) {
                    event.preventDefault();
                    this.clearSelectedCells();
                }
                break;

            case 'a':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    window.TableEditor.callModule('SelectionManager', 'selectAll');
                }
                break;

            case 'c':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    window.TableEditor.callModule('ClipboardManager', 'copySelectedCells');
                }
                break;

            case 'v':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    window.TableEditor.callModule('ClipboardManager', 'pasteToSelectedCells');
                }
                break;

            case 'x':
                if (event.ctrlKey || event.metaKey) {
                    event.preventDefault();
                    window.TableEditor.callModule('ClipboardManager', 'cutSelectedCells');
                }
                break;
        }
    },

    /**
     * Navigate to a specific cell with bounds checking
     */
    navigateCell: function (row, col) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        if (!data || !data.rows || !data.headers) {
            return;
        }

        // Bounds checking
        row = Math.max(0, Math.min(data.rows.length - 1, row));
        col = Math.max(0, Math.min(data.headers.length - 1, col));

        // 単一セル選択時は範囲選択のアンカーをクリア
        state.rangeSelectionAnchor = null;

        // Select the cell
        window.TableEditor.callModule('SelectionManager', 'selectCell', row, col);

        // Scroll to make sure it's visible
        this.scrollToCell(row, col);
    },

    /**
     * Smart navigation (Excel-like Ctrl+Arrow behavior)
     */
    navigateCellSmart: function (currentRow, currentCol, direction) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        if (!data || !data.rows || !data.headers) {
            return;
        }

        const totalRows = data.rows.length;
        const totalCols = data.headers.length;

        // Helper function to check if a cell has content
        function hasContent(row, col) {
            if (row < 0 || row >= totalRows || col < 0 || col >= totalCols) {
                return false;
            }
            const cellValue = data.rows[row][col];
            return cellValue && String(cellValue).trim() !== '';
        }

        let targetRow = currentRow;
        let targetCol = currentCol;

        switch (direction) {
            case 'up':
                if (hasContent(currentRow, currentCol)) {
                    // Move up until we find an empty cell or reach the top
                    while (targetRow > 0 && hasContent(targetRow - 1, currentCol)) {
                        targetRow--;
                    }
                } else {
                    // Move up until we find a cell with content or reach the top
                    while (targetRow > 0 && !hasContent(targetRow - 1, currentCol)) {
                        targetRow--;
                    }
                    if (targetRow > 0) {
                        // Move to the last cell with content in this group
                        while (targetRow > 0 && hasContent(targetRow - 1, currentCol)) {
                            targetRow--;
                        }
                    }
                }
                break;

            case 'down':
                if (hasContent(currentRow, currentCol)) {
                    // Move down until we find an empty cell or reach the bottom
                    while (targetRow < totalRows - 1 && hasContent(targetRow + 1, currentCol)) {
                        targetRow++;
                    }
                } else {
                    // Move down until we find a cell with content or reach the bottom
                    while (targetRow < totalRows - 1 && !hasContent(targetRow + 1, currentCol)) {
                        targetRow++;
                    }
                    if (targetRow < totalRows - 1) {
                        // Move to the last cell with content in this group
                        while (targetRow < totalRows - 1 && hasContent(targetRow + 1, currentCol)) {
                            targetRow++;
                        }
                    }
                }
                break;

            case 'left':
                if (hasContent(currentRow, currentCol)) {
                    // Move left until we find an empty cell or reach the leftmost
                    while (targetCol > 0 && hasContent(currentRow, targetCol - 1)) {
                        targetCol--;
                    }
                } else {
                    // Move left until we find a cell with content or reach the leftmost
                    while (targetCol > 0 && !hasContent(currentRow, targetCol - 1)) {
                        targetCol--;
                    }
                    if (targetCol > 0) {
                        // Move to the last cell with content in this group
                        while (targetCol > 0 && hasContent(currentRow, targetCol - 1)) {
                            targetCol--;
                        }
                    }
                }
                break;

            case 'right':
                if (hasContent(currentRow, currentCol)) {
                    // Move right until we find an empty cell or reach the rightmost
                    while (targetCol < totalCols - 1 && hasContent(currentRow, targetCol + 1)) {
                        targetCol++;
                    }
                } else {
                    // Move right until we find a cell with content or reach the rightmost
                    while (targetCol < totalCols - 1 && !hasContent(currentRow, targetCol + 1)) {
                        targetCol++;
                    }
                    if (targetCol < totalCols - 1) {
                        // Move to the last cell with content in this group
                        while (targetCol < totalCols - 1 && hasContent(currentRow, targetCol + 1)) {
                            targetCol++;
                        }
                    }
                }
                break;
        }

        this.navigateCell(targetRow, targetCol);
    },

    /**
     * Navigate to next/previous cell (for Tab navigation)
     */
    navigateToNextCell: function (row, col, forward) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        if (!data || !data.rows || !data.headers) {
            return;
        }

        const totalRows = data.rows.length;
        const totalCols = data.headers.length;

        let newRow = row;
        let newCol = col;

        if (forward) {
            // Move forward (Tab)
            newCol++;
            if (newCol >= totalCols) {
                newCol = 0;
                newRow++;
                if (newRow >= totalRows) {
                    newRow = 0; // Wrap to beginning
                }
            }
        } else {
            // Move backward (Shift+Tab)
            newCol--;
            if (newCol < 0) {
                newCol = totalCols - 1;
                newRow--;
                if (newRow < 0) {
                    newRow = totalRows - 1; // Wrap to end
                }
            }
        }

        this.navigateCell(newRow, newCol);
    },

    /**
     * Scroll to ensure cell is visible
     */
    scrollToCell: function (row, col) {
        const cell = document.querySelector(`td[data-row="${row}"][data-col="${col}"]`);
        if (!cell) {
            return;
        }

        const container = document.querySelector('.table-container');
        if (!container) {
            return;
        }

        const cellRect = cell.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Calculate if scrolling is needed
        const scrollTop = container.scrollTop;
        const scrollLeft = container.scrollLeft;

        let newScrollTop = scrollTop;
        let newScrollLeft = scrollLeft;

        // Vertical scrolling
        if (cellRect.top < containerRect.top) {
            newScrollTop = scrollTop - (containerRect.top - cellRect.top) - 10;
        } else if (cellRect.bottom > containerRect.bottom) {
            newScrollTop = scrollTop + (cellRect.bottom - containerRect.bottom) + 10;
        }

        // Horizontal scrolling
        if (cellRect.left < containerRect.left) {
            newScrollLeft = scrollLeft - (containerRect.left - cellRect.left) - 10;
        } else if (cellRect.right > containerRect.right) {
            newScrollLeft = scrollLeft + (cellRect.right - containerRect.right) + 10;
        }

        // Apply smooth scrolling
        container.scrollTo({
            top: Math.max(0, newScrollTop),
            left: Math.max(0, newScrollLeft),
            behavior: 'smooth'
        });
    },

    /**
     * Clear content of selected cells
     */
    clearSelectedCells: function () {
        const state = window.TableEditor.state;
        const data = state.tableData;

        if (!data || !data.rows || state.selectedCells.size === 0) {
            return;
        }

        let hasChanges = false;

        // Clear each selected cell
        state.selectedCells.forEach(cellKey => {
            const [row, col] = cellKey.split('-').map(Number);
            if (data.rows[row] && data.rows[row][col] !== undefined) {
                if (data.rows[row][col] !== '') {
                    data.rows[row][col] = '';
                    hasChanges = true;

                    // Send update to VSCode
                    window.TableEditor.updateCell(row, col, '');
                }
            }
        });

        if (hasChanges) {
            // Re-render table
            const renderer = window.TableEditor.getModule('TableRenderer');
            if (renderer) {
                renderer.updateTableContentOnly(data);
            }

            console.log('KeyboardNavigationManager: Cleared selected cells');
        }
    }
};

// Make KeyboardNavigationManager globally available
window.KeyboardNavigationManager = KeyboardNavigationManager;

console.log('KeyboardNavigationManager: Module script loaded');
