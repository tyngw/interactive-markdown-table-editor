/**
 * Status Bar Manager Module for Markdown Table Editor
 * 
 * This module handles all status bar operations, including:
 * - Current cell position display
 * - Table dimensions
 * - Selection information
 * - Operation status messages
 * - Table statistics
 */

const StatusBarManager = {
    // Initialization state
    isInitialized: false,
    
    /**
     * Initialize the status bar manager module
     */
    init: function() {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('StatusBarManager: Already initialized, skipping');
            return;
        }
        
        console.log('StatusBarManager: Initializing status bar manager module...');
        
        this.createStatusBar();
        this.setupStatusBarListeners();
        
        this.isInitialized = true;
        console.log('StatusBarManager: Module initialized');
    },
    
    /**
     * Create status bar element
     */
    createStatusBar: function() {
        // Check if status bar already exists
        let statusBar = document.getElementById('status-bar');
        if (statusBar) return statusBar;
        
        // Create status bar
        statusBar = document.createElement('div');
        statusBar.id = 'status-bar';
        statusBar.className = 'status-bar';
        
        statusBar.innerHTML = `
            <div class="status-left">
                <span class="save-indicator saved" id="saveIndicator">✓ Auto-saved</span>
                <span id="status-position" class="status-item">-</span>
                <span id="status-selection" class="status-item">-</span>
            </div>
            <div class="status-center">
                <span id="status-message" class="status-message"></span>
            </div>
            <div class="status-right">
                <span id="status-rows" class="status-item">-</span>
                <span id="status-columns" class="status-item">-</span>
                <span id="status-stats" class="status-item">-</span>
            </div>
        `;
        
        // Insert status bar at the bottom of the container
        const container = document.body;
        container.appendChild(statusBar);
        
        return statusBar;
    },
    
    /**
     * Set up status bar event listeners
     */
    setupStatusBarListeners: function() {
        // Listen for cell focus changes
        document.addEventListener('click', this.handleCellFocus.bind(this));
        document.addEventListener('keydown', this.handleKeyNavigation.bind(this));
        
        // Listen for table data changes
        document.addEventListener('table-data-changed', this.updateTableStats.bind(this));
        document.addEventListener('selection-changed', this.updateSelectionInfo.bind(this));
    },
    
    /**
     * Handle cell focus for position updates
     */
    handleCellFocus: function(event) {
        const target = event.target.closest('td, th');
        if (!target) return;
        
        const rowIndex = parseInt(target.getAttribute('data-row') || '-1');
        const colIndex = parseInt(target.getAttribute('data-col') || '-1');
        
        if (rowIndex >= 0 && colIndex >= 0) {
            this.updatePosition(rowIndex, colIndex);
        }
    },
    
    /**
     * Handle keyboard navigation for position updates
     */
    handleKeyNavigation: function(event) {
        // Update position after navigation keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(event.key)) {
            setTimeout(() => {
                const activeCell = document.querySelector('.cell-selected, .cell-editing');
                if (activeCell) {
                    const rowIndex = parseInt(activeCell.getAttribute('data-row') || '-1');
                    const colIndex = parseInt(activeCell.getAttribute('data-col') || '-1');
                    
                    if (rowIndex >= 0 && colIndex >= 0) {
                        this.updatePosition(rowIndex, colIndex);
                    }
                }
            }, 10);
        }
    },
    
    /**
     * Update current cell position display
     */
    updatePosition: function(rowIndex, colIndex) {
        const positionElement = document.getElementById('status-position');
        if (!positionElement) return;
        
        // Convert to Excel-style coordinates (A1, B2, etc.)
        const columnLetter = this.numberToColumnLetter(colIndex);
        const rowNumber = rowIndex + 1; // 1-based for display
        
        positionElement.textContent = `${columnLetter}${rowNumber}`;
        
        // Update cell content preview if available
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (data && data.rows && data.rows[rowIndex] && data.rows[rowIndex][colIndex] !== undefined) {
            const cellContent = data.rows[rowIndex][colIndex];
            const preview = cellContent.length > 30 ? cellContent.substring(0, 30) + '...' : cellContent;
            positionElement.title = `Cell content: ${preview}`;
        }
    },
    
    /**
     * Update table dimensions display
     */
    updateTableDimensions: function() {
        const rowsElement = document.getElementById('status-rows');
        const columnsElement = document.getElementById('status-columns');
        
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (data && data.headers && data.rows) {
            const cols = data.headers.length;
            const rows = data.rows.length;
            
            if (rowsElement) {
                rowsElement.textContent = `${rows}行`;
            }
            if (columnsElement) {
                columnsElement.textContent = `${cols}列`;
            }
        } else {
            if (rowsElement) {
                rowsElement.textContent = '-';
            }
            if (columnsElement) {
                columnsElement.textContent = '-';
            }
        }
    },
    
    /**
     * Update selection information
     */
    updateSelectionInfo: function(event) {
        const selectionElement = document.getElementById('status-selection');
        if (!selectionElement) return;
        
        const state = window.TableEditor.state;
        
        if (state.selectedCells && state.selectedCells.length > 1) {
            const selectionCount = state.selectedCells.length;
            selectionElement.textContent = `${selectionCount}セル選択中`;
            
            // Calculate selection bounds for range display
            const rows = [...new Set(state.selectedCells.map(cell => cell.row))];
            const cols = [...new Set(state.selectedCells.map(cell => cell.col))];
            
            if (rows.length > 1 || cols.length > 1) {
                const minRow = Math.min(...rows);
                const maxRow = Math.max(...rows);
                const minCol = Math.min(...cols);
                const maxCol = Math.max(...cols);
                
                const startRef = this.numberToColumnLetter(minCol) + (minRow + 1);
                const endRef = this.numberToColumnLetter(maxCol) + (maxRow + 1);
                
                selectionElement.textContent = `${startRef}:${endRef} (${selectionCount}セル)`;
            }
        } else {
            selectionElement.textContent = '';
        }
    },
    
    /**
     * Update table statistics
     */
    updateTableStats: function() {
        const statsElement = document.getElementById('status-stats');
        if (!statsElement) return;
        
        const state = window.TableEditor.state;
        const data = state.displayData || state.tableData;
        
        if (data && data.rows) {
            // Calculate statistics
            let totalCells = 0;
            let filledCells = 0;
            let emptyCells = 0;
            
            data.rows.forEach(row => {
                row.forEach(cell => {
                    totalCells++;
                    if (cell && cell.trim()) {
                        filledCells++;
                    } else {
                        emptyCells++;
                    }
                });
            });
            
            const fillPercentage = totalCells > 0 ? Math.round((filledCells / totalCells) * 100) : 0;
            statsElement.textContent = `充填率: ${fillPercentage}%`;
            statsElement.title = `総セル数: ${totalCells}, 入力済み: ${filledCells}, 空: ${emptyCells}`;
        } else {
            statsElement.textContent = '-';
        }
        
        // Also update dimensions when stats are updated
        this.updateTableDimensions();
    },
    
    /**
     * Show status message
     */
    showMessage: function(message, type = 'info', duration = 3000) {
        const messageElement = document.getElementById('status-message');
        if (!messageElement) return;
        
        // Clear any existing timeout
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
        
        // Set message and type
        messageElement.textContent = message;
        messageElement.className = `status-message ${type}`;
        
        // Auto-clear message after duration
        if (duration > 0) {
            this.messageTimeout = setTimeout(() => {
                messageElement.textContent = '';
                messageElement.className = 'status-message';
            }, duration);
        }
        
        console.log('StatusBarManager: Status message:', message, type);
    },
    
    /**
     * Show success message
     */
    showSuccess: function(message, duration = 3000) {
        this.showMessage(message, 'success', duration);
    },
    
    /**
     * Show error message
     */
    showError: function(message, duration = 5000) {
        this.showMessage(message, 'error', duration);
    },
    
    /**
     * Show warning message
     */
    showWarning: function(message, duration = 4000) {
        this.showMessage(message, 'warning', duration);
    },
    
    /**
     * Show info message
     */
    showInfo: function(message, duration = 3000) {
        this.showMessage(message, 'info', duration);
    },
    

    
    /**
     * Convert column number to Excel-style letter
     */
    numberToColumnLetter: function(num) {
        let result = '';
        while (num >= 0) {
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26) - 1;
        }
        return result;
    },
    
    /**
     * Update all status bar elements
     */
    updateAll: function() {
        this.updateTableStats();
        this.updateSelectionInfo();
        
        // Update position if there's a current active cell
        const activeCell = document.querySelector('.cell-selected, .cell-editing');
        if (activeCell) {
            const rowIndex = parseInt(activeCell.getAttribute('data-row') || '-1');
            const colIndex = parseInt(activeCell.getAttribute('data-col') || '-1');
            
            if (rowIndex >= 0 && colIndex >= 0) {
                this.updatePosition(rowIndex, colIndex);
            }
        }
    },
    
    /**
     * Show auto-saved status
     */
    showAutoSavedStatus: function() {
        const saveIndicator = document.getElementById('saveIndicator');
        if (saveIndicator) {
            saveIndicator.textContent = '✓ Auto-saved';
            saveIndicator.className = 'save-indicator saved';
        }
    },
    
    /**
     * Show saving status
     */
    showSavingStatus: function() {
        const saveIndicator = document.getElementById('saveIndicator');
        if (saveIndicator) {
            saveIndicator.textContent = '💾 Saving...';
            saveIndicator.className = 'save-indicator saving';
        }
    },
    
    /**
     * Show save error status
     */
    showSaveError: function() {
        const saveIndicator = document.getElementById('saveIndicator');
        if (saveIndicator) {
            saveIndicator.textContent = '✗ Save failed';
            saveIndicator.className = 'save-indicator failed';
        }
    },
    
    /**
     * Show validation error
     */
    showValidationError: function(field, message) {
        this.showError(`Validation error in ${field}: ${message}`, 5000);
    },
    
    /**
     * Show status with data
     */
    showStatus: function(status, data) {
        this.showInfo(status);
    },

    /**
     * Clear all status information
     */
    clear: function() {
        const elements = ['status-position', 'status-selection', 'status-rows', 'status-columns', 'status-stats'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '-';
            }
        });
        
        // Clear message
        const messageElement = document.getElementById('status-message');
        if (messageElement) {
            messageElement.textContent = '';
            messageElement.className = 'status-message';
        }
    },
    
    /**
     * Cleanup resources when module is being disposed
     */
    cleanup: function() {
        console.log('StatusBarManager: Starting cleanup...');
        
        // Clear any pending timeouts
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
            this.messageTimeout = null;
        }
        
        // Remove event listeners (note: these are bound functions, so we need to store references)
        // For now, we'll just clear the status bar content
        this.clear();
        
        console.log('StatusBarManager: Cleanup completed');
    }
};

// Make StatusBarManager globally available
window.StatusBarManager = StatusBarManager;

console.log('StatusBarManager: Module script loaded');
