/**
 * Drag & Drop Manager Module for Markdown Table Editor
 * 
 * This module handles all drag and drop operations, including:
 * - Row and column reordering
 * - Visual feedback during drag operations
 * - Drop zone highlighting
 * - Cell range drag selection
 */

const DragDropManager = {
    // Initialization state
    isInitialized: false,
    
    // Drag state management
    dragState: {
        isDragging: false,
        dragType: null,
        dragIndex: -1,
        startX: 0,
        startY: 0
    },
    
    /**
     * Initialize the drag and drop manager module
     */
    init: function() {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('DragDropManager: Already initialized, skipping');
            return;
        }
        
        console.log('DragDropManager: Initializing drag and drop manager module...');
        
        this.setupDragAndDrop();
        this.setupDragDropListeners();
        
        this.isInitialized = true;
        console.log('DragDropManager: Module initialized');
    },
    
    /**
     * Setup drag and drop functionality for table elements
     */
    setupDragAndDrop: function() {
        console.log('DragDropManager: Setting up drag and drop...');
        
        // Only setup for elements that don't already have drag attributes
        const rowNumbers = document.querySelectorAll('.row-number:not([draggable])');
        rowNumbers.forEach(rowNumber => {
            rowNumber.setAttribute('draggable', 'true');
        });
        
        const columnHeaders = document.querySelectorAll('.table-editor th:not(.header-corner):not([draggable])');
        columnHeaders.forEach(header => {
            header.setAttribute('draggable', 'true');
        });
        
        console.log('DragDropManager: Drag and drop setup complete');
    },
    
    /**
     * Set up drag and drop event listeners
     */
    setupDragDropListeners: function() {
        const tableContainer = document.getElementById('table-container');
        if (!tableContainer) return;
        
        // Set up event listeners for table container
        tableContainer.addEventListener('dragstart', this.handleDragStart.bind(this));
        tableContainer.addEventListener('dragover', this.handleDragOver.bind(this));
        tableContainer.addEventListener('dragenter', this.handleDragEnter.bind(this));
        tableContainer.addEventListener('dragleave', this.handleDragLeave.bind(this));
        tableContainer.addEventListener('drop', this.handleDrop.bind(this));
        tableContainer.addEventListener('dragend', this.handleDragEnd.bind(this));
        
        // Mouse events for drag selection
        tableContainer.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    },
    
    /**
     * Handle drag start event
     */
    handleDragStart: function(event) {
        const target = event.target.closest('th, td, tr');
        if (!target) return;
        
        const state = window.TableEditor.state;
        
        // Determine what's being dragged from the target
        let dragType = '';
        let dragIndex = -1;
        
        if (target.tagName === 'TH' && target.hasAttribute('data-col')) {
            // Dragging column header
            dragType = 'column';
            dragIndex = parseInt(target.getAttribute('data-col'));
        } else if (target.classList.contains('row-number')) {
            // Dragging row number
            dragType = 'row';
            dragIndex = parseInt(target.getAttribute('data-row'));
        }
        
        // Skip header corner and invalid indices
        if (dragIndex < 0) return;
        
        console.log('DragDropManager: Starting drag', dragType, dragIndex);
        
        // Set drag data
        event.dataTransfer.setData('text/plain', JSON.stringify({
            type: dragType,
            index: dragIndex
        }));
        
        event.dataTransfer.effectAllowed = 'move';
        
        // Store drag state
        state.dragOperation = {
            type: dragType,
            sourceIndex: dragIndex,
            element: target
        };
        
        // Update our internal drag state
        this.dragState = {
            isDragging: true,
            dragType: dragType,
            dragIndex: dragIndex,
            startX: event.clientX || 0,
            startY: event.clientY || 0
        };
        
        // Add visual feedback
        target.classList.add('dragging');
        
        console.log('DragDropManager: Drag started successfully');
    },
    
    /**
     * Handle drag over event
     */
    handleDragOver: function(event) {
        event.preventDefault();
        
        const state = window.TableEditor.state;
        if (!state.dragOperation) return;
        
        // Allow drop
        event.dataTransfer.dropEffect = 'move';
        
        // Find drop target
        const target = event.target.closest('th, td, tr');
        if (!target) return;
        
        const dropIndex = this.getDropIndex(target, state.dragOperation.type);
        if (dropIndex >= 0 && dropIndex !== state.dragOperation.sourceIndex) {
            this.highlightDropZone(target, state.dragOperation.type);
        }
    },
    
    /**
     * Handle drag enter event
     */
    handleDragEnter: function(event) {
        event.preventDefault();
        
        const target = event.target.closest('th, td, tr');
        if (target) {
            target.classList.add('drag-over');
        }
    },
    
    /**
     * Handle drag leave event
     */
    handleDragLeave: function(event) {
        const target = event.target.closest('th, td, tr');
        if (target) {
            target.classList.remove('drag-over');
        }
    },
    
    /**
     * Handle drop event
     */
    handleDrop: function(event) {
        event.preventDefault();
        
        const state = window.TableEditor.state;
        
        // Check if we have a drag operation in progress
        if (!state.dragOperation && !this.dragState.isDragging) return;
        
        let dragData = null;
        
        // Try to get drag data from event first
        try {
            const dataTransferData = event.dataTransfer.getData('text/plain');
            if (dataTransferData) {
                dragData = JSON.parse(dataTransferData);
            }
        } catch (error) {
            // Fallback to our drag state
            if (this.dragState.isDragging) {
                dragData = {
                    type: this.dragState.dragType,
                    index: this.dragState.dragIndex
                };
            }
        }
        
        if (!dragData) {
            console.warn('DragDropManager: No drag data available');
            this.clearDragVisuals();
            return;
        }
        
        // Find drop target
        const target = event.target.closest('th, td, tr');
        if (!target) {
            this.clearDragVisuals();
            return;
        }
        
        const dropIndex = this.getDropIndex(target, dragData.type);
        
        if (dropIndex >= 0 && dropIndex !== dragData.index) {
            // Perform the reorder operation
            if (dragData.type === 'column') {
                this.reorderColumn(dragData.index, dropIndex);
            } else if (dragData.type === 'row') {
                this.reorderRow(dragData.index, dropIndex);
            }
        }
        
        // Clean up
        this.clearDragVisuals();
        this.dragState.isDragging = false;
    },
    
    /**
     * Handle drag end event
     */
    handleDragEnd: function(event) {
        this.clearDragVisuals();
        
        const state = window.TableEditor.state;
        state.dragOperation = null;
        
        console.log('DragDropManager: Drag operation ended');
    },
    
    /**
     * Handle mouse down for drag selection
     */
    handleMouseDown: function(event) {
        const target = event.target.closest('td, th');
        if (!target || event.button !== 0) return; // Only left mouse button
        
        const state = window.TableEditor.state;
        
        // Skip if already dragging or resizing
        if (state.dragOperation || state.isResizing) return;
        
        const rowIndex = parseInt(target.getAttribute('data-row') || '-1');
        const colIndex = parseInt(target.getAttribute('data-col') || '-1');
        
        if (rowIndex >= 0 && colIndex >= 0) {
            state.dragSelection = {
                startRow: rowIndex,
                startCol: colIndex,
                endRow: rowIndex,
                endCol: colIndex,
                isSelecting: true
            };
            
            // Prevent default text selection
            event.preventDefault();
        }
    },
    
    /**
     * Handle mouse move for drag selection
     */
    handleMouseMove: function(event) {
        const state = window.TableEditor.state;
        if (!state.dragSelection || !state.dragSelection.isSelecting) return;
        
        const target = event.target.closest('td, th');
        if (!target) return;
        
        const rowIndex = parseInt(target.getAttribute('data-row') || '-1');
        const colIndex = parseInt(target.getAttribute('data-col') || '-1');
        
        if (rowIndex >= 0 && colIndex >= 0) {
            state.dragSelection.endRow = rowIndex;
            state.dragSelection.endCol = colIndex;
            
            // Update selection
            this.updateDragSelection();
        }
    },
    
    /**
     * Handle mouse up for drag selection
     */
    handleMouseUp: function(event) {
        const state = window.TableEditor.state;
        if (!state.dragSelection) return;
        
        // Finalize selection
        if (state.dragSelection.isSelecting) {
            this.finalizeDragSelection();
        }
        
        state.dragSelection = null;
    },
    
    /**
     * Get drop index for target element
     */
    getDropIndex: function(target, dragType) {
        if (dragType === 'column' && target.tagName === 'TH') {
            const colIndex = parseInt(target.getAttribute('data-col') || '-1');
            if (colIndex >= 0) {
                // For columns, the drop indicator is shown at the left edge of the target column
                // This means the column should be inserted before the target column
                // So we return the target index as the insertion point
                return colIndex;
            }
        } else if (dragType === 'row' && (target.tagName === 'TR' || target.tagName === 'TD')) {
            const rowIndex = parseInt(target.getAttribute('data-row') || '-1');
            if (rowIndex >= 0) {
                // For rows, we want to insert at the position where the drop indicator is shown
                return rowIndex;
            }
        }
        return -1;
    },
    
    /**
     * Highlight drop zone with visual insertion indicator
     */
    highlightDropZone: function(target, dragType) {
        // Clear previous highlights and indicators
        document.querySelectorAll('.drop-zone').forEach(el => {
            el.classList.remove('drop-zone');
        });
        this.clearDropIndicator();
        
        if (dragType === 'column') {
            // Show column insertion indicator
            this.showColumnDropIndicator(target);
        } else if (dragType === 'row') {
            // Show row insertion indicator
            this.showRowDropIndicator(target);
        }
    },

    /**
     * Show column drop indicator (vertical line)
     */
    showColumnDropIndicator: function(target) {
        const table = document.querySelector('table');
        if (!table) return;

        const colIndex = parseInt(target.getAttribute('data-col') || '-1');
        if (colIndex < 0) return;

        // Create drop indicator
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator column';
        indicator.id = 'drop-indicator';

        // Position the indicator at the left edge of the target column
        const rect = target.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        
        indicator.style.left = (rect.left - tableRect.left) + 'px';
        indicator.style.top = (tableRect.top - tableRect.top) + 'px';
        indicator.style.height = tableRect.height + 'px';

        table.style.position = 'relative';
        table.appendChild(indicator);
    },

    /**
     * Show row drop indicator (horizontal line)
     */
    showRowDropIndicator: function(target) {
        const table = document.querySelector('table');
        if (!table) return;

        const rowIndex = parseInt(target.getAttribute('data-row') || '-1');
        if (rowIndex < 0) return;

        // Create drop indicator
        const indicator = document.createElement('div');
        indicator.className = 'drop-indicator row';
        indicator.id = 'drop-indicator';

        // Position the indicator at the top edge of the target row
        const rect = target.closest('tr').getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        
        indicator.style.top = (rect.top - tableRect.top) + 'px';
        indicator.style.left = (tableRect.left - tableRect.left) + 'px';
        indicator.style.width = tableRect.width + 'px';

        table.style.position = 'relative';
        table.appendChild(indicator);
    },

    /**
     * Clear drop indicator
     */
    clearDropIndicator: function() {
        const indicator = document.getElementById('drop-indicator');
        if (indicator) {
            indicator.remove();
        }
    },
    
    /**
     * Clear drag visuals
     */
    clearDragVisuals: function() {
        // Remove all drag-related CSS classes
        document.querySelectorAll('.dragging, .drag-over, .drop-zone').forEach(el => {
            el.classList.remove('dragging', 'drag-over', 'drop-zone');
        });
        
        // Clear drop indicator
        this.clearDropIndicator();
    },
    
    /**
     * Reorder column
     */
    reorderColumn: function(fromIndex, toIndex) {
        console.log('DragDropManager: Reordering column from', fromIndex, 'to', toIndex);
        
        if (fromIndex === toIndex) return;
        
        // Adjust toIndex based on the direction of the move
        // When moving a column, the original column is removed first, 
        // so we need to adjust the target index accordingly
        let adjustedToIndex = toIndex;
        if (fromIndex < toIndex) {
            // Moving right: target index should be decreased by 1
            // because the source column will be removed first
            adjustedToIndex = toIndex - 1;
        }
        // When moving left (fromIndex > toIndex), no adjustment needed
        
        console.log('DragDropManager: Adjusted reorder column from', fromIndex, 'to', adjustedToIndex);
        
        // Send message to VSCode extension to move the column
        if (window.TableEditor.vscode) {
            window.TableEditor.vscode.postMessage({
                command: 'moveColumn',
                data: { 
                    from: fromIndex, 
                    to: adjustedToIndex,
                    tableIndex: window.TableEditor.state.currentTableIndex
                }
            });
        } else {
            console.error('DragDropManager: VSCode API not available');
        }
    },
    
    /**
     * Reorder row
     */
    reorderRow: function(fromIndex, toIndex) {
        console.log('DragDropManager: Reordering row from', fromIndex, 'to', toIndex);
        
        if (fromIndex === toIndex) return;
        
        // Send message to VSCode extension to move the row
        if (window.TableEditor.vscode) {
            window.TableEditor.vscode.postMessage({
                command: 'moveRow',
                data: { 
                    from: fromIndex, 
                    to: toIndex,
                    tableIndex: window.TableEditor.state.currentTableIndex
                }
            });
        } else {
            console.error('DragDropManager: VSCode API not available');
        }
    },
    
    /**
     * Update drag selection visual
     */
    updateDragSelection: function() {
        const state = window.TableEditor.state;
        if (!state.dragSelection) return;
        
        // Clear previous selection highlighting
        document.querySelectorAll('.drag-selecting').forEach(cell => {
            cell.classList.remove('drag-selecting');
        });
        
        // Calculate selection bounds
        const startRow = Math.min(state.dragSelection.startRow, state.dragSelection.endRow);
        const endRow = Math.max(state.dragSelection.startRow, state.dragSelection.endRow);
        const startCol = Math.min(state.dragSelection.startCol, state.dragSelection.endCol);
        const endCol = Math.max(state.dragSelection.startCol, state.dragSelection.endCol);
        
        // Highlight selected range
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (cell) {
                    cell.classList.add('drag-selecting');
                }
            }
        }
    },
    
    /**
     * Finalize drag selection
     */
    finalizeDragSelection: function() {
        const state = window.TableEditor.state;
        if (!state.dragSelection) return;
        
        // Calculate final selection
        const startRow = Math.min(state.dragSelection.startRow, state.dragSelection.endRow);
        const endRow = Math.max(state.dragSelection.startRow, state.dragSelection.endRow);
        const startCol = Math.min(state.dragSelection.startCol, state.dragSelection.endCol);
        const endCol = Math.max(state.dragSelection.startCol, state.dragSelection.endCol);
        
        // Create selection array
        const selectedCells = [];
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                selectedCells.push({ row, col });
            }
        }
        
        // Update selection manager
        if (window.TableEditor.modules.SelectionManager) {
            window.TableEditor.modules.SelectionManager.setSelection(selectedCells);
        }
        
        // Clear drag selection visuals
        document.querySelectorAll('.drag-selecting').forEach(cell => {
            cell.classList.remove('drag-selecting');
        });
        
        console.log('DragDropManager: Finalized drag selection', selectedCells.length, 'cells');
    }
};

// Make DragDropManager globally available
window.DragDropManager = DragDropManager;

console.log('DragDropManager: Module script loaded');
