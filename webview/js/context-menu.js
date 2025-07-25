/**
 * Context Menu Manager Module for Markdown Table Editor
 * 
 * This module handles all context menu operations, including:
 * - Right-click context menu display
 * - Menu item actions (insert/delete rows/columns, etc.)
 * - Context-sensitive menu options
 * - Menu positioning and styling
 */

const ContextMenuManager = {
    // Context menu state
    contextMenuState: {
        currentRow: -1,
        currentColumn: -1
    },

    /**
     * Initialize the context menu manager module
     */
    init: function() {
        console.log('ContextMenuManager: Initializing context menu manager module...');
        
        this.setupContextMenuListeners();
        
        console.log('ContextMenuManager: Module initialized');
    },
    
    /**
     * Set up event listeners for context menu
     */
    setupContextMenuListeners: function() {
        // Hide context menus when clicking elsewhere
        document.addEventListener('click', (event) => {
            if (!event.target.closest('.context-menu')) {
                this.hideContextMenus();
            }
        });
        
        // Hide context menus on scroll
        document.addEventListener('scroll', this.hideContextMenus.bind(this));
    },
    
    /**
     * Show context menu at specified position
     */
    showContextMenu: function(event) {
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
    createContextMenu: function(rowIndex, colIndex) {
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
     * Get context menu items based on context
     */
    getMenuItems: function(rowIndex, colIndex) {
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
                items.push({
                    label: '行を削除',
                    icon: '❌',
                    action: () => {
                        this.deleteRow(rowIndex);
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
                items.push({
                    label: '列を削除',
                    icon: '❌',
                    action: () => {
                        this.deleteColumn(colIndex);
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
    positionMenu: function(menu, x, y) {
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
    hideContextMenu: function() {
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
    clearCell: function(rowIndex, colIndex) {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.rows || !data.rows[rowIndex]) return;
        
        // Clear the cell
        data.rows[rowIndex][colIndex] = '';
        
        // Send update to VSCode
        window.TableEditor.updateCell(rowIndex, colIndex, '');
        
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
    insertRowAbove: function(rowIndex) {
        window.TableEditor.addRow(rowIndex);
    },
    
    /**
     * Insert row below
     */
    insertRowBelow: function(rowIndex) {
        window.TableEditor.addRow(rowIndex + 1);
    },
    
    /**
     * Delete row
     */
    deleteRow: function(rowIndex) {
        window.TableEditor.deleteRow(rowIndex);
    },
    
    /**
     * Insert column to the left
     */
    insertColumnLeft: function(colIndex) {
        window.TableEditor.addColumn(colIndex, `Column ${colIndex + 1}`);
    },
    
    /**
     * Insert column to the right
     */
    insertColumnRight: function(colIndex) {
        window.TableEditor.addColumn(colIndex + 1, `Column ${colIndex + 2}`);
    },
    
    /**
     * Delete column
     */
    deleteColumn: function(colIndex) {
        window.TableEditor.deleteColumn(colIndex);
    },

    /**
     * Show row context menu
     */
    showRowContextMenu: function(event, rowIndex) {
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
        
        const menu = document.getElementById('rowContextMenu');
        
        if (!menu) {
            console.warn('ContextMenuManager: Row context menu element not found');
            return;
        }
        
        // Position menu
        menu.style.display = 'block';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        
        // Hide column menu if visible
        const columnMenu = document.getElementById('columnContextMenu');
        if (columnMenu) {
            columnMenu.style.display = 'none';
        }
        
        // Disable delete if only one row
        const data = state.displayData || state.tableData;
        const deleteBtn = menu.querySelector('[onclick*="deleteRowFromContext"]');
        if (deleteBtn && data && data.rows && data.rows.length <= 1) {
            deleteBtn.disabled = true;
            deleteBtn.classList.add('disabled');
        } else if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.classList.remove('disabled');
        }
        
        console.log('ContextMenuManager: Row context menu shown for row', rowIndex);
    },

    /**
     * Show column context menu
     */
    showColumnContextMenu: function(event, columnIndex) {
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
        
        const menu = document.getElementById('columnContextMenu');
        
        if (!menu) {
            console.warn('ContextMenuManager: Column context menu element not found');
            return;
        }
        
        // Position menu
        menu.style.display = 'block';
        menu.style.left = event.pageX + 'px';
        menu.style.top = event.pageY + 'px';
        
        // Hide row menu if visible
        const rowMenu = document.getElementById('rowContextMenu');
        if (rowMenu) {
            rowMenu.style.display = 'none';
        }
        
        // Disable delete if only one column
        const data = state.displayData || state.tableData;
        const deleteBtn = menu.querySelector('[onclick*="deleteColumnFromContext"]');
        if (deleteBtn && data && data.headers && data.headers.length <= 1) {
            deleteBtn.disabled = true;
            deleteBtn.classList.add('disabled');
        } else if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.classList.remove('disabled');
        }
        
        console.log('ContextMenuManager: Column context menu shown for column', columnIndex);
    },

    /**
     * Hide context menus
     */
    hideContextMenus: function() {
        const rowMenu = document.getElementById('rowContextMenu');
        const columnMenu = document.getElementById('columnContextMenu');
        
        if (rowMenu) {
            rowMenu.style.display = 'none';
        }
        if (columnMenu) {
            columnMenu.style.display = 'none';
        }
        
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
    addRowAbove: function() {
        console.log('ContextMenuManager: addRowAbove called');
        const state = window.TableEditor.state;
        const rowIndex = state.contextMenuState?.index !== undefined ? state.contextMenuState.index : this.contextMenuState.currentRow;
        this.hideContextMenus();
        
        console.log('ContextMenuManager: Adding row above at index:', rowIndex);
        if (rowIndex >= 0) {
            window.TableEditor.addRow(rowIndex);
        } else {
            window.TableEditor.addRow(0); // Add at beginning if no specific row
        }
    },
    
    /**
     * Add row below current row
     */
    addRowBelow: function() {
        console.log('ContextMenuManager: addRowBelow called');
        const state = window.TableEditor.state;
        const rowIndex = state.contextMenuState?.index !== undefined ? state.contextMenuState.index : this.contextMenuState.currentRow;
        this.hideContextMenus();
        
        console.log('ContextMenuManager: Adding row below at index:', rowIndex);
        if (rowIndex >= 0) {
            window.TableEditor.addRow(rowIndex + 1);
        } else {
            const data = state.displayData || state.tableData;
            const totalRows = data?.rows?.length || 0;
            window.TableEditor.addRow(totalRows); // Add at end
        }
    },
    
    /**
     * Delete row from context
     */
    deleteRowFromContext: function() {
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
                alert('Cannot delete the last row');
            }
            return;
        }
        
        if (rowIndex >= 0) {
            console.log('ContextMenuManager: Calling TableEditor.deleteRow with index:', rowIndex);
            window.TableEditor.deleteRow(rowIndex);
        } else {
            console.error('ContextMenuManager: Invalid row index for deletion:', rowIndex);
        }
    },

    /**
     * Add column to the left
     */
    addColumnLeft: function() {
        console.log('ContextMenuManager: addColumnLeft called');
        const index = this.contextMenuState.currentColumn;
        this.hideContextMenus();
        
        window.TableEditor.addColumn(index, `Column ${index + 1}`);
    },

    /**
     * Add column to the right
     */
    addColumnRight: function() {
        console.log('ContextMenuManager: addColumnRight called');
        const index = this.contextMenuState.currentColumn + 1;
        this.hideContextMenus();
        
        window.TableEditor.addColumn(index, `Column ${index + 1}`);
    },

    /**
     * Delete column from context
     */
    deleteColumnFromContext: function() {
        console.log('ContextMenuManager: deleteColumnFromContext called');
        const index = this.contextMenuState.currentColumn;
        this.hideContextMenus();
        
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        if (data && data.headers && data.headers.length <= 1) {
            if (window.TableEditor.callModule) {
                window.TableEditor.callModule('StatusBarManager', 'showError', 'Cannot delete the last column');
            } else {
                alert('Cannot delete the last column');
            }
            return;
        }
        
        window.TableEditor.deleteColumn(index);
    }
};

// Make ContextMenuManager globally available
window.ContextMenuManager = ContextMenuManager;

console.log('ContextMenuManager: Module script loaded');
