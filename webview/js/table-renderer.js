/**
 * Table Renderer Module for Markdown Table Editor
 * 
 * This module handles all table rendering operations, including:
 * - HTML table generation
 * - Cell content processing
 * - Column width management
 * - HTML escaping and formatting
 */

const TableRenderer = {
    // Initialization state
    isInitialized: false,
    
    /**
     * Initialize the table renderer module
     */
    init: function() {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('TableRenderer: Already initialized, skipping');
            return;
        }
        
        console.log('TableRenderer: Initializing table renderer module...');
        
        this.isInitialized = true;
        console.log('TableRenderer: Module initialized');
    },
    
    /**
     * Render the main table with data
     */
    renderTable: function(data) {
        console.log('TableRenderer: Starting table render with data:', data);
        
        if (!data) {
            console.error('TableRenderer: No data provided');
            document.getElementById('app').innerHTML = '<div class="error">No table data available</div>';
            return;
        }
        
        if (!data.headers || !data.rows) {
            console.error('TableRenderer: Invalid data structure:', data);
            document.getElementById('app').innerHTML = '<div class="error">Invalid table data structure</div>';
            return;
        }

        console.log('TableRenderer: Rendering table with', data.headers.length, 'columns and', data.rows.length, 'rows');

        // Initialize data models on first render
        const state = window.TableEditor.state;
        if (!state.originalData) {
            state.originalData = JSON.parse(JSON.stringify(data)); // Deep clone
        }
        
        state.tableData = data;
        state.displayData = data; // Currently displayed data
        
        const app = document.getElementById('app');
        console.log('TableRenderer: Found app element:', !!app);
        
        app.innerHTML = `
            <div class="table-container">
                <table class="table-editor" id="tableEditor">
                    ${this.renderTableContent()}
                </table>
            </div>
            
            <!-- Sort Actions Panel -->
            <div class="sort-actions" id="sortActions">
                <span class="sort-status-badge">📊 Viewing sorted data</span>
                <button class="sort-action-btn secondary" onclick="TableEditor.callModule('SortingManager', 'restoreOriginalView')">📄 Restore Original</button>
                <button class="sort-action-btn" onclick="TableEditor.callModule('SortingManager', 'commitSortToFile')">💾 Save Sort to File</button>
            </div>
            
            <!-- Export Actions Panel -->
            <div class="export-actions">
                <select class="encoding-select" id="encodingSelect">
                    <option value="utf8">UTF-8</option>
                    <option value="sjis">Shift_JIS</option>
                </select>
                <button class="export-btn" onclick="TableEditor.callModule('CSVExporter', 'exportToCSV')">📄 Export CSV</button>
            </div>
            
            <!-- Status Bar -->
            <div class="status-bar" id="statusBar">
                <div class="status-left">
                    <div class="status-item" id="statusSelection"></div>
                </div>
                <div class="status-center">
                    <div class="status-message" id="statusMessage"></div>
                </div>
                <div class="status-right">
                    <div class="status-item" id="statusInfo"></div>
                </div>
            </div>
            
            <!-- Context Menus -->
            <div class="context-menu" id="rowContextMenu" style="display: none;">
                <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'addRowAbove')">
                    <span class="context-menu-icon">⬆️</span>
                    この上に行を追加
                </div>
                <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'addRowBelow')">
                    <span class="context-menu-icon">⬇️</span>
                    この下に行を追加
                </div>
                <div class="context-menu-separator"></div>
                <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'deleteRowFromContext')">
                    <span class="context-menu-icon">🗑️</span>
                    この行を削除
                </div>
            </div>
            <div class="context-menu" id="columnContextMenu" style="display: none;">
                <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'addColumnLeft')">
                    <span class="context-menu-icon">⬅️</span>
                    この左に列を追加
                </div>
                <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'addColumnRight')">
                    <span class="context-menu-icon">➡️</span>
                    この右に列を追加
                </div>
                <div class="context-menu-separator"></div>
                <div class="context-menu-item" onclick="TableEditor.callModule('ContextMenuManager', 'deleteColumnFromContext')">
                    <span class="context-menu-icon">🗑️</span>
                    この列を削除
                </div>
            </div>
        `;

        // Initialize column widths for new data
        this.initializeColumnWidths(data);
        
        // Restore any previously set column widths
        window.TableEditor.callModule('ColumnResizeManager', 'restoreColumnWidths');
        
        // Set table width to sum of column widths to prevent window resize effects
        this.setTableWidth();
        
        // Set up drag and drop after rendering (with small delay to ensure DOM is ready)
        setTimeout(() => {
            window.TableEditor.callModule('DragDropManager', 'setupDragAndDrop');
        }, 10);
        
        // Update sort actions visibility
        window.TableEditor.callModule('SortingManager', 'updateSortActionsVisibility');
        
        console.log('TableRenderer: Table rendering completed successfully');
    },
    
    /**
     * Render table content (headers and rows)
     */
    renderTableContent: function() {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.headers || !data.rows) {
            return '<tr><td>No data available</td></tr>';
        }

        // Generate header row
        let html = '<thead><tr>';
        
        // Row number header (select all corner)
        html += '<th class="header-corner" data-col="-1" onclick="TableEditor.callModule(\'SelectionManager\', \'selectAll\')" title="Select All">⚏</th>';
        
        // Column headers
        data.headers.forEach((header, index) => {
            const columnLetter = this.getColumnLetter(index);
            const sortIcon = this.getSortIcon(index);
            
            // Get stored column width or use default
            const state = window.TableEditor.state;
            const storedWidth = state.columnWidths[index] || 150;
            const widthStyle = `style="width: ${storedWidth}px; min-width: ${storedWidth}px; max-width: ${storedWidth}px;"`;
            const userResizedClass = state.columnWidths[index] && state.columnWidths[index] !== 150 ? 'user-resized' : '';
            
            html += `<th data-col="${index}" class="column-header sortable ${userResizedClass}" 
                        ${widthStyle}
                        oncontextmenu="TableEditor.callModule('ContextMenuManager', 'showColumnContextMenu', event, ${index}); return false;"
                        draggable="true"
                        onmousedown="TableEditor.callModule('SelectionManager', 'startColumnSelect', ${index})"
                        ondragstart="TableEditor.callModule('DragDropManager', 'handleDragStart', event)"
                        ondragover="TableEditor.callModule('DragDropManager', 'handleDragOver', event)"
                        ondrop="TableEditor.callModule('DragDropManager', 'handleDrop', event)">
                     <div class="column-letter">${columnLetter}</div>
                     <div class="column-title" 
                          ondblclick="TableEditor.callModule('CellEditor', 'startHeaderEdit', ${index}, event); event.stopPropagation();"
                          title="Double-click to edit header">${this.escapeHtml(header)}</div>
                     <div class="sort-indicator" 
                          onclick="TableEditor.callModule('SortingManager', 'handleColumnHeaderClick', ${index}, event); event.stopPropagation();"
                          title="Sort column">${sortIcon}</div>
                     <div class="resize-handle" 
                          onmousedown="TableEditor.callModule('ColumnResizeManager', 'startColumnResize', event, ${index}); event.stopPropagation();"
                          ondblclick="event.stopPropagation(); event.preventDefault(); TableEditor.callModule('ColumnResizeManager', 'autoFitColumn', ${index});"
                          title="Drag to resize column, double-click to auto-fit"></div>
                  </th>`;
        });
        html += '</tr></thead>';

        // Generate data rows
        html += '<tbody>';
        data.rows.forEach((row, rowIndex) => {
            html += `<tr data-row="${rowIndex}">`;
            
            // Row number cell
            html += `<td class="row-number" data-row="${rowIndex}" data-col="-1"
                        oncontextmenu="TableEditor.callModule('ContextMenuManager', 'showRowContextMenu', event, ${rowIndex}); return false;"
                        draggable="true"
                        onmousedown="TableEditor.callModule('SelectionManager', 'startRowSelect', ${rowIndex})"
                        ondragstart="TableEditor.callModule('DragDropManager', 'handleDragStart', event)"
                        ondragover="TableEditor.callModule('DragDropManager', 'handleDragOver', event)"
                        ondrop="TableEditor.callModule('DragDropManager', 'handleDrop', event)">
                     ${rowIndex + 1}
                  </td>`;
            
            // Data cells
            row.forEach((cell, colIndex) => {
                const processedContent = this.processCellContent(cell);
                const hasMultipleLines = cell && String(cell).includes('<br');
                const multilineAttr = hasMultipleLines ? 'data-multiline="true"' : '';
                
                // Get stored column width or use default
                const state = window.TableEditor.state;
                const storedWidth = state.columnWidths[colIndex] || 150;
                const widthStyle = `style="width: ${storedWidth}px; min-width: ${storedWidth}px; max-width: ${storedWidth}px;"`;
                const userResizedClass = state.columnWidths[colIndex] && state.columnWidths[colIndex] !== 150 ? 'user-resized' : '';
                
                html += `<td data-row="${rowIndex}" data-col="${colIndex}" class="editable-cell ${userResizedClass}" ${multilineAttr}
                            ${widthStyle}
                            onclick="TableEditor.callModule('SelectionManager', 'selectCell', ${rowIndex}, ${colIndex}, event)"
                            ondblclick="TableEditor.callModule('CellEditor', 'startCellEdit', ${rowIndex}, ${colIndex})"
                            ondragover="TableEditor.callModule('DragDropManager', 'handleDragOver', event)"
                            ondragenter="TableEditor.callModule('DragDropManager', 'handleDragEnter', event)"
                            ondragleave="TableEditor.callModule('DragDropManager', 'handleDragLeave', event)"
                            ondrop="TableEditor.callModule('DragDropManager', 'handleDrop', event)"
                            >
                         <div class="cell-content">${processedContent}</div>
                      </td>`;
            });
            html += '</tr>';
        });
        html += '</tbody>';

        return html;
    },
    
    /**
     * Get Excel-style column letter (A, B, C, ..., Z, AA, AB, ...)
     */
    getColumnLetter: function(index) {
        let result = '';
        let num = index;
        while (num >= 0) {
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26) - 1;
        }
        return result;
    },
    
    /**
     * Get sort icon for column header
     */
    getSortIcon: function(columnIndex) {
        const sortState = window.TableEditor.state.sortState;
        if (sortState.column === columnIndex) {
            if (sortState.direction === 'asc') {
                return '▲';
            } else if (sortState.direction === 'desc') {
                return '▼';
            }
        }
        return '↕';
    },
    
    /**
     * Initialize default column widths
     */
    initializeColumnWidths: function(data) {
        const state = window.TableEditor.state;
        if (!data || !data.headers) return;
        
        // Set default width for new columns
        data.headers.forEach((header, index) => {
            if (!(index in state.columnWidths)) {
                state.columnWidths[index] = 150; // Default width
            }
        });
    },
    
    /**
     * Process cell content for display (handle HTML tags, links, etc.)
     */
    processCellContent: function(content) {
        if (!content || content.trim() === '') {
            return '<span class="empty-cell-placeholder">&nbsp;</span>'; // 空のセルには非表示スペースを挿入
        }
        
        // Convert string to string if it's not already
        let text = String(content);
        
        // Handle <br/> tags for line breaks
        text = text.replace(/<br\s*\/?>/gi, '<br>');
        
        // Escape other HTML tags but preserve <br> tags
        text = this.escapeHtmlExceptBreaks(text);
        
        return text;
    },
    
    /**
     * Process cell content specifically for editing mode
     */
    processCellContentForEditing: function(content) {
        if (!content) return '';
        
        // Convert <br> tags back to newlines for editing
        return String(content).replace(/<br\s*\/?>/gi, '\n');
    },
    
    /**
     * Process cell content for storage (convert newlines to <br> tags)
     */
    processCellContentForStorage: function(content) {
        if (!content) return '';
        
        // Convert newlines to <br> tags for storage
        return String(content).replace(/\n/g, '<br/>');
    },
    
    /**
     * Escape HTML except for <br> tags
     */
    escapeHtmlExceptBreaks: function(text) {
        // First, protect <br> tags
        const brPlaceholder = '___BR_PLACEHOLDER___';
        text = text.replace(/<br\s*\/?>/gi, brPlaceholder);
        
        // Escape all HTML
        text = this.escapeHtml(text);
        
        // Restore <br> tags
        text = text.replace(new RegExp(brPlaceholder, 'g'), '<br>');
        
        return text;
    },
    
    /**
     * Escape HTML characters
     */
    escapeHtml: function(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    },
    
    /**
     * Render table while preserving scroll position
     */
    renderTableWithScrollPreservation: function(data) {
        // Save current scroll position
        const tableContainer = document.querySelector('.table-container');
        const scrollTop = tableContainer ? tableContainer.scrollTop : 0;
        const scrollLeft = tableContainer ? tableContainer.scrollLeft : 0;
        
        // Render table
        this.renderTable(data);
        
        // Restore scroll position
        const newTableContainer = document.querySelector('.table-container');
        if (newTableContainer) {
            newTableContainer.scrollTop = scrollTop;
            newTableContainer.scrollLeft = scrollLeft;
        }
    },
    
    /**
     * Update only table content without changing structure
     */
    updateTableContentOnly: function(data) {
        const tableElement = document.getElementById('tableEditor');
        if (!tableElement) {
            this.renderTable(data);
            return;
        }
        
        // Update just the table content
        tableElement.innerHTML = this.renderTableContent();
        
        // Drag and drop will be re-setup by the DragDropManager when needed
    },
    
    /**
     * Set table width to sum of column widths to prevent window resize effects
     */
    setTableWidth: function() {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        const table = document.getElementById('tableEditor');
        
        if (!table || !data || !data.headers) return;
        
        // Calculate total width based on column widths
        let totalWidth = 80; // Row header width (updated to 80px)
        
        data.headers.forEach((_, index) => {
            const columnWidth = state.columnWidths[index] || 150; // Default width
            totalWidth += columnWidth;
        });
        
        // Set table width explicitly
        table.style.width = totalWidth + 'px';
        
        console.log('TableRenderer: Set table width to', totalWidth + 'px');
    }
};

// Make TableRenderer globally available
window.TableRenderer = TableRenderer;

console.log('TableRenderer: Module script loaded');