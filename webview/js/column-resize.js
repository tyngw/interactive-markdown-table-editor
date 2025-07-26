/**
 * Column Resize Manager Module for Markdown Table Editor
 * 
 * This module handles all column resizing operations, including:
 * - Manual column resizing via mouse drag
 * - Auto-fit functionality triggered by double-clicking resize handles
 * - Column width persistence across table updates
 * - Visual feedback during resize operations
 * 
 * Auto-fit Feature:
 * - Double-click on any column's resize handle to auto-fit that column
 * - Calculates optimal width based on content in all cells of the column
 * - Handles multi-line content by measuring the longest line
 * - Enforces minimum width (80px) and maximum width (400px) constraints
 * - Provides visual feedback with user-resized styling
 */

const ColumnResizeManager = {
    // Initialization state
    isInitialized: false,
    
    /**
     * Initialize the column resize manager module
     */
    init: function() {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('ColumnResizeManager: Already initialized, skipping');
            return;
        }
        
        console.log('ColumnResizeManager: Initializing column resize manager module...');
        
        // Set up window resize handler to maintain column widths
        this.setupWindowResizeHandler();
        
        this.isInitialized = true;
        console.log('ColumnResizeManager: Module initialized');
    },
    
    /**
     * Set up window resize handler to maintain column widths
     */
    setupWindowResizeHandler: function() {
        // ウィンドウリサイズ時は何もしない - デフォルト幅を維持し、ユーザーの変更のみ保持
        // CSSのデフォルト幅とuser-resizedクラスによるカスタム幅で自動的に処理される
        console.log('ColumnResizeManager: Window resize handler disabled - using CSS defaults');
    },
    
    /**
     * Start column resize operation
     */
    startColumnResize: function(event, colIndex) {
        event.stopPropagation();
        event.preventDefault();
        
        const state = window.TableEditor.state;
        
        state.isResizing = true;
        state.resizeColumn = colIndex;
        state.startX = event.clientX;
        
        const header = document.querySelector(`th[data-col="${colIndex}"]`);
        if (header) {
            state.startWidth = header.offsetWidth;
        } else {
            console.warn('ColumnResizeManager: Header not found for column', colIndex);
            return;
        }
        
        // Add global event listeners
        document.addEventListener('mousemove', this.handleColumnResize.bind(this));
        document.addEventListener('mouseup', this.stopColumnResize.bind(this));
        
        // Prevent text selection during resize
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        
        console.log('ColumnResizeManager: Started resizing column', colIndex);
    },
    
    /**
     * Handle column resize mouse movement
     */
    handleColumnResize: function(event) {
        const state = window.TableEditor.state;
        
        if (!state.isResizing) return;
        
        const deltaX = event.clientX - state.startX;
        const newWidth = Math.max(10, state.startWidth + deltaX); // Minimum width of 10px
        
        // Store the new width in global state
        state.columnWidths[state.resizeColumn] = newWidth;
        
        // Apply new width to all cells in the column
        this.applyColumnWidth(state.resizeColumn, newWidth);
    },
    
    /**
     * Stop column resize operation
     */
    stopColumnResize: function() {
        const state = window.TableEditor.state;
        
        // Remove global event listeners
        document.removeEventListener('mousemove', this.handleColumnResize.bind(this));
        document.removeEventListener('mouseup', this.stopColumnResize.bind(this));
        
        // Restore normal cursor and text selection
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // Small delay to prevent immediate click events
        setTimeout(() => {
            state.isResizing = false;
            state.resizeColumn = -1;
        }, 10);
        
        console.log('ColumnResizeManager: Stopped resizing column');
    },
    
    /**
     * Auto-fit column width to content
     */
    autoFitColumn: function(colIndex) {
        console.log('ColumnResizeManager: Auto-fitting column', colIndex);
        
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.headers || colIndex < 0 || colIndex >= data.headers.length) {
            console.warn('ColumnResizeManager: Invalid column index for auto-fit', colIndex);
            return;
        }
        
        // Cancel any ongoing resize operation
        if (state.isResizing) {
            this.stopColumnResize();
        }
        
        // Get all cells in the column (header + data cells)
        const colCells = document.querySelectorAll(`th[data-col="${colIndex}"], td[data-col="${colIndex}"]`);
        let maxWidth = 10; // Minimum width
        
        // Create a temporary element to measure text width
        const measureElement = this.createMeasureElement();
        
        colCells.forEach(cell => {
            // Get cell content
            let cellText = '';
            if (cell.tagName === 'TH') {
                // For header cells, get the header text
                const headerText = cell.querySelector('.column-title, .header-text');
                cellText = headerText ? headerText.textContent : '';
            } else {
                // For data cells, get the processed content
                cellText = cell.textContent || '';
            }
            
            // Handle multi-line content by measuring the longest line only
            let maxLineWidth = 0;
            
            // Check for multi-line content: either newlines in textContent or <br> tags in innerHTML
            const cellHTML = cell.innerHTML || '';
            const hasNewlines = cellText.includes('\n');
            const hasBrTags = cellHTML.includes('<br') || cellHTML.includes('<BR');
            
            console.log(`ColumnResizeManager: Cell content analysis - textContent: "${cellText}", innerHTML: "${cellHTML}"`);
            console.log(`ColumnResizeManager: hasNewlines: ${hasNewlines}, hasBrTags: ${hasBrTags}`);
            
            if (hasNewlines || hasBrTags) {
                let lines;
                
                if (hasBrTags) {
                    // For <br> tags, convert to newlines first, then strip any remaining tags
                    console.log(`ColumnResizeManager: Processing <br> tags in: "${cellHTML}"`);
                    const htmlWithNewlines = cellHTML.replace(/<br\s*\/?>/gi, '\n');
                    console.log(`ColumnResizeManager: After <br> to newline conversion: "${htmlWithNewlines}"`);
                    const textFromHTML = htmlWithNewlines.replace(/<[^>]*>/g, '');
                    console.log(`ColumnResizeManager: After tag removal: "${textFromHTML}"`);
                    lines = textFromHTML.split(/\n/g);
                } else {
                    // For plain newlines in textContent
                    lines = cellText.split(/\n/g);
                }
                
                console.log(`ColumnResizeManager: Multi-line content found, ${lines.length} lines:`, lines.map(l => `"${l.trim()}"`));
                lines.forEach((line, index) => {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                        measureElement.textContent = trimmedLine;
                        const lineWidth = measureElement.offsetWidth;
                        console.log(`ColumnResizeManager: Line ${index + 1}: "${trimmedLine}" -> ${lineWidth}px`);
                        maxLineWidth = Math.max(maxLineWidth, lineWidth);
                    }
                });
                console.log(`ColumnResizeManager: Maximum line width: ${maxLineWidth}px (not sum of all lines)`);
            } else {
                // Single line content
                measureElement.textContent = cellText;
                maxLineWidth = measureElement.offsetWidth;
                console.log(`ColumnResizeManager: Single line: "${cellText}" -> ${maxLineWidth}px`);
            }
            
            // Add padding and margin
            const cellWidth = maxLineWidth + 24; // 12px padding on each side
            maxWidth = Math.max(maxWidth, cellWidth);
        });
        
        // Clean up the temporary element
        document.body.removeChild(measureElement);
        
        // Cap the maximum width to prevent extremely wide columns
        const finalWidth = Math.min(maxWidth, 400);
        
        console.log('ColumnResizeManager: Auto-fit calculated width', finalWidth, 'for column', colIndex);
        
        // Store the new width
        state.columnWidths[colIndex] = finalWidth;
        
        // Apply the new width
        this.applyColumnWidth(colIndex, finalWidth);
    },
    
    /**
     * Apply width to all cells in a column
     */
    applyColumnWidth: function(colIndex, width) {
        const colCells = document.querySelectorAll(`th[data-col="${colIndex}"], td[data-col="${colIndex}"]`);
        
        colCells.forEach(cell => {
            cell.style.width = width + 'px';
            cell.style.minWidth = width + 'px';
            cell.style.maxWidth = width + 'px';
            
            // Add visual indicator that this column has been user-resized
            // Only add if width is different from default
            if (width !== 150) {
                if (!cell.classList.contains('user-resized')) {
                    cell.classList.add('user-resized');
                }
            } else {
                // Remove user-resized class if width is back to default
                cell.classList.remove('user-resized');
            }
        });
        
        // Update table total width to prevent window resize effects
        this.updateTableTotalWidth();
        
        console.log('ColumnResizeManager: Applied width', width, 'to column', colIndex);
    },
    
    /**
     * Create temporary element for text measurement
     */
    createMeasureElement: function() {
        const measureElement = document.createElement('div');
        measureElement.style.position = 'absolute';
        measureElement.style.visibility = 'hidden';
        measureElement.style.whiteSpace = 'nowrap';
        measureElement.style.fontSize = 'var(--vscode-editor-font-size, 14px)';
        measureElement.style.fontFamily = 'var(--vscode-editor-font-family, "Consolas", "Monaco", "Courier New", monospace)';
        measureElement.style.padding = '8px 12px'; // Same as cell padding
        measureElement.style.border = 'none';
        measureElement.style.margin = '0';
        document.body.appendChild(measureElement);
        
        return measureElement;
    },
    
    /**
     * Reset column width to default
     */
    resetColumnWidth: function(colIndex) {
        const state = window.TableEditor.state;
        
        // Reset to default width
        const defaultWidth = 150;
        state.columnWidths[colIndex] = defaultWidth;
        
        // Apply the default width
        this.applyColumnWidth(colIndex, defaultWidth);
        
        console.log('ColumnResizeManager: Reset column width', colIndex, 'to default');
    },
    
    /**
     * Reset all column widths to default
     */
    resetAllColumnWidths: function() {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.headers) return;
        
        // Reset all column widths
        data.headers.forEach((_, index) => {
            this.resetColumnWidth(index);
        });
        
        console.log('ColumnResizeManager: Reset all column widths to default');
    },
    
    /**
     * Auto-fit all columns
     */
    autoFitAllColumns: function() {
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (!data || !data.headers) return;
        
        // Auto-fit each column
        data.headers.forEach((_, index) => {
            this.autoFitColumn(index);
        });
        
        console.log('ColumnResizeManager: Auto-fitted all columns');
    },
    
    /**
     * Get current column width
     */
    getColumnWidth: function(colIndex) {
        const state = window.TableEditor.state;
        return state.columnWidths[colIndex] || 150; // Default width
    },
    
    /**
     * Set column width programmatically
     */
    setColumnWidth: function(colIndex, width) {
        const state = window.TableEditor.state;
        
        // Validate width
        width = Math.max(10, Math.min(800, width)); // Between 10px and 800px
        
        // Store and apply the width
        state.columnWidths[colIndex] = width;
        this.applyColumnWidth(colIndex, width);
        
        console.log('ColumnResizeManager: Set column', colIndex, 'width to', width);
    },
    
    /**
     * Restore all column widths after table re-render
     */
    restoreColumnWidths: function() {
        const state = window.TableEditor.state;
        
        if (!state.columnWidths) return;
        
        // Apply stored widths to all columns
        Object.keys(state.columnWidths).forEach(colIndex => {
            const width = state.columnWidths[colIndex];
            if (width && width !== 150) { // Only apply if not default width
                this.applyColumnWidth(parseInt(colIndex), width);
            }
        });
        
        console.log('ColumnResizeManager: Restored column widths after re-render');
    },
    
    /**
     * Update table total width to prevent window resize effects
     */
    updateTableTotalWidth: function() {
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
        
        console.log('ColumnResizeManager: Updated table total width to', totalWidth + 'px');
    }
};

// Make ColumnResizeManager globally available
window.ColumnResizeManager = ColumnResizeManager;

console.log('ColumnResizeManager: Module script loaded');
