/**
 * ⚠️ DEPRECATED: このLegacy WebviewのJSモジュールは廃止されました ⚠️
 * 
 * このファイルは後方互換性のためにのみ保持されています。
 * 新しい開発やメンテナンスは webview-react/src/components/ContextMenu.tsx で行われています。
 * React版への移行が完了次第、このファイルは削除予定です。
 * 
 * Context Menu Manager Module for Markdown Table Editor
 * 
 * This module handles all context menu operations, including:
 * - Right-click context menu display
 * - Menu item actions (insert/delete rows/columns, etc.)
 * - Context-sensitive menu options
 * - Menu positioning and styling
 */

const ContextMenuManager = {
    // Initialization state
    isInitialized: false,

    // Context menu state
    contextMenuState: {
        currentRow: -1,
        currentColumn: -1
    },

    /**
     * Initialize the context menu manager module
     */
    init: function () {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('ContextMenuManager: Already initialized, skipping');
            return;
        }

        console.log('ContextMenuManager: Initializing context menu manager module...');

        this.setupContextMenuListeners();

        this.isInitialized = true;
        console.log('ContextMenuManager: Module initialized');
    },

    /**
     * Set up event listeners for context menu
     */
    setupContextMenuListeners: function () {
        // Hide context menus when clicking elsewhere
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.context-menu')) {
                this.hideContextMenus();
            }

            // Hide column width dialog when clicking outside
            if (!event.target.closest('.dialog') && !event.target.closest('.context-menu-item')) {
                this.hideColumnWidthDialog();
            }
        });

        // Hide context menus on scroll
        document.addEventListener('scroll', this.hideContextMenus.bind(this));

        // Handle keyboard events for column width dialog
        document.addEventListener('keydown', (event) => {
            const overlay = document.getElementById('columnWidthDialogOverlay');
            if (overlay && overlay.style.display !== 'none') {
                if (event.key === 'Escape') {
                    event.preventDefault();
                    this.hideColumnWidthDialog();
                } else if (event.key === 'Enter') {
                    event.preventDefault();
                    this.applyColumnWidth();
                }
            }
        });
    },

    /**
     * Show context menu at specified position
     */
    showContextMenu: function (event) {
        event.preventDefault();
        event.stopPropagation();

        const target = event.target.closest('td, th, tr');
        if (!target) return;

        const state = window.TableEditor.state;

        // Get cell position
        let rowIndex = -1;
        let colIndex = -1;

        if (target.tagName === 'TD' || target.tagName === 'TH') {
            rowIndex = parseInt(target.getAttribute('data-row') || '-1');
            colIndex = parseInt(target.getAttribute('data-col') || '-1');
        } else if (target.tagName === 'TR') {
            rowIndex = parseInt(target.getAttribute('data-row') || '-1');
        }

        // Create context menu
        const menu = this.createContextMenu(rowIndex, colIndex);

        // Position menu
        this.positionMenu(menu, event.clientX, event.clientY);

        // Store context
        state.contextMenu = {
            rowIndex: rowIndex,
            colIndex: colIndex,
            element: menu
        };

        console.log('ContextMenuManager: Context menu shown for row', rowIndex, 'col', colIndex);
    },

    /**
     * Create context menu element
     */
    createContextMenu: function (rowIndex, colIndex) {
        // Remove existing menu
        this.hideContextMenu();

        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.id = 'table-context-menu';

        const items = this.getMenuItems(rowIndex, colIndex);

        items.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item' + (item.disabled ? ' disabled' : '');
                menuItem.innerHTML = `
                    <span class="context-menu-icon">${item.icon || ''}</span>
                    <span class="context-menu-label">${item.label}</span>
                    <span class="context-menu-shortcut">${item.shortcut || ''}</span>
                `;

                if (!item.disabled) {
                    menuItem.onclick = (e) => {
                        e.stopPropagation();
                        item.action();
                        this.hideContextMenu();
                    };
                }

                menu.appendChild(menuItem);
            }
        });

        document.body.appendChild(menu);
        return menu;
    },

    /**
     * Get the number of selected rows
     */
    getSelectedRowCount: function () {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!state.selectedCells || state.selectedCells.size === 0 || !data || !data.headers) {
            return 0;
        }

        const selectedRows = new Set();
        state.selectedCells.forEach(cellKey => {
            const [row] = cellKey.split('-').map(Number);
            selectedRows.add(row);
        });

        return selectedRows.size;
    },

    /**
     * Get the number of selected columns
     */
    getSelectedColumnCount: function () {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!state.selectedCells || state.selectedCells.size === 0 || !data || !data.rows) {
            return 0;
        }

        const selectedColumns = new Set();
        state.selectedCells.forEach(cellKey => {
            const [, col] = cellKey.split('-').map(Number);
            selectedColumns.add(col);
        });

        return selectedColumns.size;
    },

    /**
     * Check if an entire row is fully selected
     */
    isRowFullySelected: function (rowIndex) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        if (!data || !data.headers || !state.selectedCells) {
            return false;
        }

        for (let col = 0; col < data.headers.length; col++) {
            if (!state.selectedCells.has(`${rowIndex}-${col}`)) {
                return false;
            }
        }
        return true;
    },

    /**
     * Get context menu items based on context
     */
    getMenuItems: function (rowIndex, colIndex) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        const items = [];

        // Cell-specific actions
        if (rowIndex >= 0 && colIndex >= 0) {
            items.push({
                label: 'セルを編集',
                icon: '✏️',
                shortcut: 'F2',
                action: () => {
                    if (window.TableEditor.modules.CellEditor) {
                        window.TableEditor.modules.CellEditor.startCellEdit(rowIndex, colIndex);
                    }
                }
            });

            items.push({
                label: 'セルをクリア',
                icon: '🗑️',
                shortcut: 'Del',
                action: () => {
                    this.clearCell(rowIndex, colIndex);
                }
            });
        }

        // Selection-based actions
        if (state.selectedCells && state.selectedCells.length > 0) {
            items.push({ separator: true });

            items.push({
                label: 'コピー',
                icon: '📋',
                shortcut: 'Ctrl+C',
                action: () => {
                    if (window.TableEditor.modules.ClipboardManager) {
                        window.TableEditor.modules.ClipboardManager.copy();
                    }
                }
            });

            items.push({
                label: '切り取り',
                icon: '✂️',
                shortcut: 'Ctrl+X',
                action: () => {
                    if (window.TableEditor.modules.ClipboardManager) {
                        window.TableEditor.modules.ClipboardManager.cut();
                    }
                }
            });

            items.push({
                label: '貼り付け',
                icon: '📌',
                shortcut: 'Ctrl+V',
                action: () => {
                    if (window.TableEditor.modules.ClipboardManager) {
                        window.TableEditor.modules.ClipboardManager.paste();
                    }
                }
            });
        }

        // Row actions
        if (rowIndex >= 0) {
            items.push({ separator: true });

            items.push({
                label: '上に行を挿入',
                icon: '⬆️',
                action: () => {
                    this.insertRowAbove(rowIndex);
                }
            });

            items.push({
                label: '下に行を挿入',
                icon: '⬇️',
                action: () => {
                    this.insertRowBelow(rowIndex);
                }
            });

            if (data && data.rows && data.rows.length > 1) {
                // Determine the number of selected rows for the delete message
                const selectedRowCount = this.getSelectedRowCount();
                let deleteLabel;
                
                if (selectedRowCount > 1) {
                    deleteLabel = `選択した${selectedRowCount}行を削除`;
                } else {
                    deleteLabel = '行を削除';
                }
                
                items.push({
                    label: deleteLabel,
                    icon: '❌',
                    action: () => {
                        this.deleteSelectedRows();
                    }
                });
            }
        }

        // Column actions
        if (colIndex >= 0) {
            items.push({ separator: true });

            items.push({
                label: '左に列を挿入',
                icon: '⬅️',
                action: () => {
                    this.insertColumnLeft(colIndex);
                }
            });

            items.push({
                label: '右に列を挿入',
                icon: '➡️',
                action: () => {
                    this.insertColumnRight(colIndex);
                }
            });

            if (data && data.headers && data.headers.length > 1) {
                // Determine the number of selected columns for the delete message
                const selectedColumnCount = this.getSelectedColumnCount();
                let deleteLabel;
                
                if (selectedColumnCount > 1) {
                    deleteLabel = `選択した${selectedColumnCount}列を削除`;
                } else {
                    deleteLabel = '列を削除';
                }
                
                items.push({
                    label: deleteLabel,
                    icon: '❌',
                    action: () => {
                        this.deleteSelectedColumns();
                    }
                });
            }

            items.push({ separator: true });

            items.push({
                label: '列幅を自動調整',
                icon: '📏',
                action: () => {
                    if (window.TableEditor.modules.ColumnResizeManager) {
                        window.TableEditor.modules.ColumnResizeManager.autoFitColumn(colIndex);
                    }
                }
            });
        }

        // Table-wide actions
        items.push({ separator: true });

        if (window.TableEditor.modules.SortManager) {
            items.push({
                label: 'ソート',
                icon: '🔄',
                action: () => {
                    // Show sort dialog or apply default sort
                    if (colIndex >= 0) {
                        window.TableEditor.modules.SortManager.sort(colIndex, 'asc');
                    }
                }
            });
        }

        items.push({
            label: '全て選択',
            icon: '🔲',
            shortcut: 'Ctrl+A',
            action: () => {
                if (window.TableEditor.modules.SelectionManager) {
                    window.TableEditor.modules.SelectionManager.selectAll();
                }
            }
        });

        return items;
    },

    /**
     * Position menu at coordinates
     */
    positionMenu: function (menu, x, y) {
        const menuRect = menu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust position to keep menu in viewport
        let menuX = x;
        let menuY = y;

        if (x + menuRect.width > viewportWidth) {
            menuX = viewportWidth - menuRect.width - 10;
        }

        if (y + menuRect.height > viewportHeight) {
            menuY = viewportHeight - menuRect.height - 10;
        }

        menu.style.left = menuX + 'px';
        menu.style.top = menuY + 'px';
        menu.style.display = 'block';
    },

    /**
     * Hide context menu
     */
    hideContextMenu: function () {
        const existingMenu = document.getElementById('table-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        const state = window.TableEditor.state;
        if (state.contextMenu) {
            state.contextMenu = null;
        }
    },

    /**
     * Clear cell content
     */
    clearCell: function (rowIndex, colIndex) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        if (!data || !data.rows || !data.rows[rowIndex]) return;

        // Clear the cell
        data.rows[rowIndex][colIndex] = '';

        // Send update to VSCode
        window.TableEditor.callModule('TableManager', 'updateCell', rowIndex, colIndex, '');

        // Update the cell display
        const cell = document.querySelector(`td[data-row="${rowIndex}"][data-col="${colIndex}"]`);
        if (cell) {
            cell.innerHTML = '';
            cell.classList.add('empty-cell');
        }

        console.log('ContextMenuManager: Cleared cell', rowIndex, colIndex);
    },

    /**
     * Insert row above
     */
    insertRowAbove: function (rowIndex) {
        window.TableEditor.callModule('TableManager', 'addRow', rowIndex);
    },

    /**
     * Insert row below
     */
    insertRowBelow: function (rowIndex) {
        window.TableEditor.callModule('TableManager', 'addRow', rowIndex + 1);
    },

    /**
     * Delete row
     */
    deleteRow: function (rowIndex) {
        window.TableEditor.callModule('TableManager', 'deleteRow', rowIndex);
    },

    /**
     * Delete all selected rows
     */
    deleteSelectedRows: function () {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        if (!state.selectedCells || state.selectedCells.size === 0 || !data || !data.rows) {
            console.warn('ContextMenuManager: No rows selected for deletion');
            return;
        }

        // Get unique selected row indices
        const selectedRows = new Set();
        state.selectedCells.forEach(cellKey => {
            const [row] = cellKey.split('-').map(Number);
            selectedRows.add(row);
        });

        const selectedRowArray = Array.from(selectedRows).sort((a, b) => b - a); // Sort in descending order for safe deletion
        const rowCount = selectedRowArray.length;

        // Check if trying to delete all rows
        if (selectedRowArray.length >= data.rows.length) {
            console.log('ContextMenuManager: Cannot delete all rows');
            if (window.TableEditor.callModule) {
                window.TableEditor.callModule('StatusBarManager', 'showError', '全ての行を削除することはできません');
            } else {
                console.error('ContextMenuManager: Cannot delete all rows');
            }
            return;
        }

        // Confirm deletion for multiple rows
        if (rowCount > 1) {
            this.showConfirmDialog(
                `選択した${rowCount}行を削除しますか？`,
                'この操作は元に戻せません。',
                () => {
                    // Confirmed - proceed with deletion
                    window.TableEditor.callModule('TableManager', 'deleteRows', selectedRowArray);
                    console.log(`ContextMenuManager: Deleted ${rowCount} rows`);
                },
                () => {
                    // Cancelled - do nothing
                    console.log('ContextMenuManager: Row deletion cancelled');
                }
            );
            return;
        }

        // Single row deletion - no confirmation needed
        window.TableEditor.callModule('TableManager', 'deleteRows', selectedRowArray);
        console.log(`ContextMenuManager: Deleted ${rowCount} rows`);
    },

    /**
     * Delete all selected columns
     */
    deleteSelectedColumns: function () {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;

        if (!state.selectedCells || state.selectedCells.size === 0 || !data || !data.headers) {
            console.warn('ContextMenuManager: No columns selected for deletion');
            return;
        }

        // Get unique selected column indices
        const selectedColumns = new Set();
        state.selectedCells.forEach(cellKey => {
            const [, col] = cellKey.split('-').map(Number);
            selectedColumns.add(col);
        });

        const selectedColumnArray = Array.from(selectedColumns).sort((a, b) => b - a); // Sort in descending order for safe deletion
        const columnCount = selectedColumnArray.length;

        // Check if trying to delete all columns
        if (selectedColumnArray.length >= data.headers.length) {
            console.log('ContextMenuManager: Cannot delete all columns');
            if (window.TableEditor.callModule) {
                window.TableEditor.callModule('StatusBarManager', 'showError', '全ての列を削除することはできません');
            } else {
                console.error('ContextMenuManager: Cannot delete all columns');
            }
            return;
        }

        // Confirm deletion for multiple columns
        if (columnCount > 1) {
            this.showConfirmDialog(
                `選択した${columnCount}列を削除しますか？`,
                'この操作は元に戻せません。',
                () => {
                    // Confirmed - proceed with deletion
                    window.TableEditor.callModule('TableManager', 'deleteColumns', selectedColumnArray);
                    console.log(`ContextMenuManager: Deleted ${columnCount} columns`);
                },
                () => {
                    // Cancelled - do nothing
                    console.log('ContextMenuManager: Column deletion cancelled');
                }
            );
            return;
        }

        // Single column deletion - no confirmation needed
        window.TableEditor.callModule('TableManager', 'deleteColumns', selectedColumnArray);
        console.log(`ContextMenuManager: Deleted ${columnCount} columns`);
    },

    /**
     * Insert column to the left
     */
    insertColumnLeft: function (colIndex) {
        window.TableEditor.callModule('TableManager', 'addColumn', colIndex, `Column ${colIndex + 1}`);
    },

    /**
     * Insert column to the right
     */
    insertColumnRight: function (colIndex) {
        window.TableEditor.callModule('TableManager', 'addColumn', colIndex + 1, `Column ${colIndex + 2}`);
    },

    /**
     * Delete column
     */
    deleteColumn: function (colIndex) {
        window.TableEditor.callModule('TableManager', 'deleteColumn', colIndex);
    },

    /**
     * Show row context menu
     */
    showRowContextMenu: function (event, rowIndex) {
        event.preventDefault();
        event.stopPropagation();

        console.log('ContextMenuManager: showRowContextMenu called with rowIndex:', rowIndex);

        this.contextMenuState.currentRow = rowIndex;

        // Also set the global state for consistency
        const state = window.TableEditor.state;
        if (state.contextMenuState) {
            state.contextMenuState.index = rowIndex;
            state.contextMenuState.type = 'row';
            state.contextMenuState.visible = true;
        }

        // Use the dynamic context menu system instead of static HTML menu
        const menu = this.createContextMenu(rowIndex, -1);

        // Position menu
        this.positionMenu(menu, event.clientX, event.clientY);

        // Store context
        state.contextMenu = {
            rowIndex: rowIndex,
            colIndex: -1,
            element: menu
        };

        console.log('ContextMenuManager: Row context menu shown for row', rowIndex);
    },

    /**
     * Show column context menu
     */
    showColumnContextMenu: function (event, columnIndex) {
        event.preventDefault();
        event.stopPropagation();

        console.log('ContextMenuManager: showColumnContextMenu called with columnIndex:', columnIndex);

        this.contextMenuState.currentColumn = columnIndex;

        // Also set the global state for consistency
        const state = window.TableEditor.state;
        if (state.contextMenuState) {
            state.contextMenuState.index = columnIndex;
            state.contextMenuState.type = 'column';
            state.contextMenuState.visible = true;
        }

        // Use the dynamic context menu system instead of static HTML menu
        const menu = this.createContextMenu(-1, columnIndex);

        // Position menu
        this.positionMenu(menu, event.clientX, event.clientY);

        // Store context
        state.contextMenu = {
            rowIndex: -1,
            colIndex: columnIndex,
            element: menu
        };

        console.log('ContextMenuManager: Column context menu shown for column', columnIndex);
    },

    /**
     * Hide context menus
     */
    hideContextMenus: function () {
        // Hide static menus (legacy)
        const rowMenu = document.getElementById('rowContextMenu');
        const columnMenu = document.getElementById('columnContextMenu');

        if (rowMenu) {
            rowMenu.style.display = 'none';
        }
        if (columnMenu) {
            columnMenu.style.display = 'none';
        }

        // Hide dynamic context menu (new system)
        this.hideContextMenu();

        // Clear context menu state
        const state = window.TableEditor.state;
        if (state.contextMenuState) {
            state.contextMenuState.visible = false;
            state.contextMenuState.type = null;
            state.contextMenuState.index = -1;
        }

        // Also clear local state
        this.contextMenuState.currentRow = -1;
        this.contextMenuState.currentColumn = -1;
    },

    /**
     * Add row above current row
     */
    addRowAbove: function () {
        console.log('ContextMenuManager: addRowAbove called');
        const state = window.TableEditor.state;
        const rowIndex = state.contextMenuState?.index !== undefined ? state.contextMenuState.index : this.contextMenuState.currentRow;
        this.hideContextMenus();

        console.log('ContextMenuManager: Adding row above at index:', rowIndex);
        if (rowIndex >= 0) {
            window.TableEditor.callModule('TableManager', 'addRow', rowIndex);
        } else {
            window.TableEditor.callModule('TableManager', 'addRow', 0); // Add at beginning if no specific row
        }
    },

    /**
     * Add row below current row
     */
    addRowBelow: function () {
        console.log('ContextMenuManager: addRowBelow called');
        const state = window.TableEditor.state;
        const rowIndex = state.contextMenuState?.index !== undefined ? state.contextMenuState.index : this.contextMenuState.currentRow;
        this.hideContextMenus();

        console.log('ContextMenuManager: Adding row below at index:', rowIndex);
        if (rowIndex >= 0) {
            window.TableEditor.callModule('TableManager', 'addRow', rowIndex + 1);
        } else {
            const data = state.displayData || state.tableData;
            const totalRows = data?.rows?.length || 0;
            window.TableEditor.callModule('TableManager', 'addRow', totalRows); // Add at end
        }
    },

    /**
     * Delete row from context (row header right-click menu)
     */
    deleteRowFromContext: function () {
        console.log('ContextMenuManager: deleteRowFromContext called');
        const state = window.TableEditor.state;
        const rowIndex = state.contextMenuState?.index !== undefined ? state.contextMenuState.index : this.contextMenuState.currentRow;
        this.hideContextMenus();

        console.log('ContextMenuManager: Attempting to delete row at index:', rowIndex);

        const data = state.displayData || state.tableData;
        if (data && data.rows && data.rows.length <= 1) {
            console.log('ContextMenuManager: Cannot delete last row');
            if (window.TableEditor.callModule) {
                window.TableEditor.callModule('StatusBarManager', 'showError', 'Cannot delete the last row');
            } else {
                console.error('ContextMenuManager: Cannot delete the last row');
            }
            return;
        }

        if (rowIndex >= 0) {
            // Check if there are multiple rows selected (including the clicked row)
            const selectedRowCount = this.getSelectedRowCount();
            const isRowFullySelected = this.isRowFullySelected(rowIndex);
            
            if (selectedRowCount > 1 && isRowFullySelected) {
                // Multiple rows are selected, delete all selected rows
                this.deleteSelectedRows();
            } else {
                // Single row deletion
                console.log('ContextMenuManager: Calling TableEditor.deleteRow with index:', rowIndex);
                window.TableEditor.callModule('TableManager', 'deleteRow', rowIndex);
            }
        } else {
            console.error('ContextMenuManager: Invalid row index for deletion:', rowIndex);
        }
    },

    /**
     * Add column to the left
     */
    addColumnLeft: function () {
        console.log('ContextMenuManager: addColumnLeft called');
        const index = this.contextMenuState.currentColumn;
        this.hideContextMenus();

        window.TableEditor.callModule('TableManager', 'addColumn', index, `Column ${index + 1}`);
    },

    /**
     * Add column to the right
     */
    addColumnRight: function () {
        console.log('ContextMenuManager: addColumnRight called');
        const index = this.contextMenuState.currentColumn + 1;
        this.hideContextMenus();

        window.TableEditor.callModule('TableManager', 'addColumn', index, `Column ${index + 1}`);
    },

    /**
     * Delete column from context
     */
    deleteColumnFromContext: function () {
        console.log('ContextMenuManager: deleteColumnFromContext called');
        const index = this.contextMenuState.currentColumn;
        this.hideContextMenus();

        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        if (data && data.headers && data.headers.length <= 1) {
            if (window.TableEditor.callModule) {
                window.TableEditor.callModule('StatusBarManager', 'showError', 'Cannot delete the last column');
            } else {
                console.error('ContextMenuManager: Cannot delete the last column');
            }
            return;
        }

        window.TableEditor.callModule('TableManager', 'deleteColumn', index);
    },

    /**
     * Show column width dialog
     */
    showColumnWidthDialog: function (columnIndex) {
        // Use the provided columnIndex or fall back to the stored one
        const colIndex = columnIndex !== undefined ? columnIndex : this.contextMenuState.currentColumn;

        if (colIndex < 0) {
            console.error('ContextMenuManager: Invalid column index for width dialog');
            return;
        }

        const state = window.TableEditor.state;
        const config = window.TableEditor.config;
        const currentWidth = state.columnWidths[colIndex] || (config ? config.columnWidth.default : 150);

        // Show dialog overlay
        const overlay = document.getElementById('columnWidthDialogOverlay');
        const input = document.getElementById('columnWidthInput');

        if (!overlay || !input) {
            console.error('ContextMenuManager: Column width dialog elements not found');
            return;
        }

        // Set current width as default value
        input.value = currentWidth;
        if (config) {
            input.min = config.columnWidth.min;
            input.max = config.columnWidth.max;
            input.step = config.columnWidth.step;
        } else {
            input.min = 50;
            input.max = 800;
            input.step = 10;
        }

        // Store the column index for later use
        overlay.dataset.columnIndex = colIndex;

        // Show dialog
        overlay.style.display = 'flex';

        // Focus on input and select all text
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
    },

    /**
     * Show column width dialog from context menu
     */
    showColumnWidthDialogFromContext: function () {
        const columnIndex = this.contextMenuState.currentColumn;
        this.hideContextMenus();

        if (columnIndex < 0) {
            console.error('ContextMenuManager: Invalid column index for width dialog from context');
            return;
        }

        this.showColumnWidthDialog(columnIndex);
    },

    /**
     * Hide column width dialog
     */
    hideColumnWidthDialog: function () {
        console.log('ContextMenuManager: hideColumnWidthDialog called');
        const overlay = document.getElementById('columnWidthDialogOverlay');
        if (overlay) {
            overlay.style.display = 'none';
            overlay.dataset.columnIndex = '';
        }
    },

    /**
     * Adjust column width input value
     */
    adjustColumnWidthInput: function (delta) {
        const input = document.getElementById('columnWidthInput');
        if (!input) return;

        const config = window.TableEditor.config;
        const defaultWidth = config ? config.columnWidth.default : 150;
        const minWidth = config ? config.columnWidth.min : 50;
        const maxWidth = config ? config.columnWidth.max : 800;

        const currentValue = parseInt(input.value) || defaultWidth;
        const newValue = Math.max(minWidth, Math.min(maxWidth, currentValue + delta));

        input.value = newValue;
    },

    /**
     * Apply column width from dialog
     */
    applyColumnWidth: function () {
        const overlay = document.getElementById('columnWidthDialogOverlay');
        const input = document.getElementById('columnWidthInput');

        if (!overlay || !input) {
            console.error('ContextMenuManager: Column width dialog elements not found');
            return;
        }

        const columnIndex = parseInt(overlay.dataset.columnIndex);
        const newWidth = parseInt(input.value);
        const config = window.TableEditor.config;
        const minWidth = config ? config.columnWidth.min : 50;
        const maxWidth = config ? config.columnWidth.max : 800;

        if (isNaN(columnIndex) || columnIndex < 0) {
            console.error('ContextMenuManager: Invalid column index for width application');
            return;
        }

        if (isNaN(newWidth) || newWidth < minWidth || newWidth > maxWidth) {
            console.error('ContextMenuManager: Invalid width value:', newWidth);
            if (window.TableEditor.callModule) {
                window.TableEditor.callModule('StatusBarManager', 'showError',
                    `列幅は${minWidth}px〜${maxWidth}pxの範囲で設定してください`);
            }
            return;
        }

        // Apply the new width
        const state = window.TableEditor.state;
        state.columnWidths[columnIndex] = newWidth;

        // Apply width to column using ColumnResizeManager without resize indicator
        if (window.TableEditor.modules.ColumnResizeManager) {
            window.TableEditor.modules.ColumnResizeManager.applyColumnWidth(columnIndex, newWidth, false);
        }

        // Hide dialog
        this.hideColumnWidthDialog();

        // Show success message
        if (window.TableEditor.callModule) {
            window.TableEditor.callModule('StatusBarManager', 'showSuccess',
                `列${columnIndex + 1}の幅を${newWidth}pxに変更しました`);
        }
    },

    /**
     * Cleanup resources when module is being disposed
     */
    cleanup: function () {
        console.log('ContextMenuManager: Starting cleanup...');

        // Hide all context menus
        this.hideContextMenus();

        // Clear context menu state
        const state = window.TableEditor.state;
        if (state && state.contextMenuState) {
            state.contextMenuState.visible = false;
            state.contextMenuState.type = null;
            state.contextMenuState.index = -1;
        }

        console.log('ContextMenuManager: Cleanup completed');
    },

    /**
     * Show custom confirmation dialog
     */
    showConfirmDialog: function (title, message, onConfirm, onCancel) {
        // Remove existing dialog if any
        this.hideConfirmDialog();

        // Create dialog overlay
        const overlay = document.createElement('div');
        overlay.id = 'confirmDialogOverlay';
        overlay.className = 'dialog-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        // Create dialog container
        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';
        dialog.style.cssText = `
            background: var(--vscode-editor-background, #ffffff);
            border: 1px solid var(--vscode-widget-border, #cccccc);
            border-radius: 6px;
            padding: 20px;
            min-width: 300px;
            max-width: 500px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            color: var(--vscode-editor-foreground, #000000);
            font-family: var(--vscode-font-family, system-ui);
            font-size: var(--vscode-font-size, 13px);
        `;

        // Create dialog content
        const titleElement = document.createElement('h3');
        titleElement.textContent = title;
        titleElement.style.cssText = `
            margin: 0 0 10px 0;
            color: var(--vscode-editor-foreground, #000000);
            font-size: 16px;
            font-weight: 600;
        `;

        const messageElement = document.createElement('p');
        messageElement.textContent = message;
        messageElement.style.cssText = `
            margin: 0 0 20px 0;
            color: var(--vscode-descriptionForeground, #666666);
            line-height: 1.4;
        `;

        // Create button container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        `;

        // Create Cancel button
        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'キャンセル';
        cancelButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid var(--vscode-button-border, #cccccc);
            background: var(--vscode-button-secondaryBackground, #f3f3f3);
            color: var(--vscode-button-secondaryForeground, #000000);
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
        `;

        // Create Confirm button
        const confirmButton = document.createElement('button');
        confirmButton.textContent = '削除';
        confirmButton.style.cssText = `
            padding: 8px 16px;
            border: 1px solid var(--vscode-button-border, #007acc);
            background: var(--vscode-button-background, #007acc);
            color: var(--vscode-button-foreground, #ffffff);
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
        `;

        // Add hover effects
        cancelButton.addEventListener('mouseenter', () => {
            cancelButton.style.backgroundColor = 'var(--vscode-button-secondaryHoverBackground, #e0e0e0)';
        });
        cancelButton.addEventListener('mouseleave', () => {
            cancelButton.style.backgroundColor = 'var(--vscode-button-secondaryBackground, #f3f3f3)';
        });

        confirmButton.addEventListener('mouseenter', () => {
            confirmButton.style.backgroundColor = 'var(--vscode-button-hoverBackground, #005a9e)';
        });
        confirmButton.addEventListener('mouseleave', () => {
            confirmButton.style.backgroundColor = 'var(--vscode-button-background, #007acc)';
        });

        // Add event listeners
        cancelButton.addEventListener('click', () => {
            this.hideConfirmDialog();
            if (onCancel) onCancel();
        });

        confirmButton.addEventListener('click', () => {
            this.hideConfirmDialog();
            if (onConfirm) onConfirm();
        });

        // Handle Escape key
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                this.hideConfirmDialog();
                if (onCancel) onCancel();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        // Assemble dialog
        buttonContainer.appendChild(cancelButton);
        buttonContainer.appendChild(confirmButton);
        dialog.appendChild(titleElement);
        dialog.appendChild(messageElement);
        dialog.appendChild(buttonContainer);
        overlay.appendChild(dialog);

        // Add to DOM
        document.body.appendChild(overlay);

        // Focus on cancel button by default
        setTimeout(() => cancelButton.focus(), 100);
    },

    /**
     * Hide confirmation dialog
     */
    hideConfirmDialog: function () {
        const overlay = document.getElementById('confirmDialogOverlay');
        if (overlay) {
            overlay.remove();
        }
    }
};

// Make ContextMenuManager globally available
window.ContextMenuManager = ContextMenuManager;

console.log('ContextMenuManager: Module script loaded');
