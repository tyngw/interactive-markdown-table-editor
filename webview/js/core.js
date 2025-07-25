/**
 * Core Module for Markdown Table Editor
 * 
 * This module provides the foundation for the modular table editor system.
 * It manages global state, VSCode API initialization, and module registration.
 */

// Global TableEditor namespace
const TableEditor = {
    // Global state management
    state: {
        tableData: null,
        currentEditingCell: null,
        sortState: { 
            column: -1, 
            direction: 'none',
            isViewOnly: false,
            originalData: null
        },
        columnWidths: {},
        displayData: null,
        originalData: null,
        fileInfo: null,
        selectedCells: new Set(),
        selectionStart: null,
        isSelecting: false,
        lastSelectedCell: null,
        
        // IME composition state tracking
        isComposing: false,
        
        // Multiple tables support
        allTables: [], // All tables from the document
        currentTableIndex: 0, // Currently displayed table index
        
        // Column resizing state
        isResizing: false,
        resizeColumn: -1,
        startX: 0,
        startWidth: 0,
        
        // Drag and drop state
        dragState: {
            isDragging: false,
            dragType: null, // 'row' or 'column'
            dragIndex: -1,
            dropIndex: -1
        },
        
        // Context menu state
        contextMenuState: {
            visible: false,
            type: null, // 'row' or 'column'
            index: -1
        }
    },
    
    // VSCode API reference
    vscode: null,
    
    // Module registry
    modules: {},
    
    /**
     * Initialize the TableEditor core system
     */
    init: function() {
        console.log('TableEditor: Initializing core system...');
        console.log('TableEditor: Available modules before init:', Object.keys(this.modules));
        
        try {
            // Use globally acquired VSCode API
            if (window.vscode) {
                this.vscode = window.vscode;
                console.log('TableEditor: Using globally acquired VSCode API');
            } else {
                console.error('TableEditor: Global VSCode API not available');
            }
        } catch (error) {
            console.error('TableEditor: Failed to access VSCode API:', error);
        }
        
        try {
            // Load CSS if available
            this.loadCSS();
        } catch (error) {
            console.error('TableEditor: Failed to load CSS:', error);
        }
        
        try {
            // Initialize modules in dependency order
            this.initializeModules();
        } catch (error) {
            console.error('TableEditor: Failed to initialize modules:', error);
        }
        
        try {
            // Initialize the table editor
            this.initializeTableEditor();
        } catch (error) {
            console.error('TableEditor: Failed to initialize table editor:', error);
        }
        
        console.log('TableEditor: Core initialization complete');
        console.log('TableEditor: Available modules after init:', Object.keys(this.modules));
    },
    
    /**
     * Load CSS file
     */
    loadCSS: function() {
        if (window.cssUri) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = window.cssUri;
            document.head.appendChild(link);
            console.log('TableEditor: CSS loaded from', window.cssUri);
        }
    },
    
    /**
     * Register a module with the core system
     */
    registerModule: function(name, module) {
        // Check if module is already registered to prevent duplicate registration
        if (this.modules[name]) {
            console.log('TableEditor: Module', name, 'already registered, skipping');
            return;
        }
        
        console.log('TableEditor: Registering module', name, 'with methods:', Object.keys(module));
        this.modules[name] = module;
        
        // Initialize module if it has an init method and hasn't been initialized yet
        if (module && typeof module.init === 'function') {
            // Check if module has already been initialized
            if (module.isInitialized) {
                console.log('TableEditor: Module', name, 'already initialized, skipping');
                return;
            }
            
            try {
                console.log('TableEditor: Initializing module', name);
                module.init();
                // Mark module as initialized
                module.isInitialized = true;
                console.log('TableEditor: Module', name, 'initialized successfully');
            } catch (error) {
                console.error('TableEditor: Failed to initialize module', name, error);
            }
        } else {
            console.log('TableEditor: Module', name, 'has no init method, skipping initialization');
        }
    },
    
    /**
     * Get a registered module
     */
    getModule: function(name) {
        return this.modules[name];
    },
    
    /**
     * Initialize modules in the correct order
     */
    initializeModules: function() {
        console.log('TableEditor: Module initialization phase starting...');
        console.log('TableEditor: Available module objects in window:', 
            Object.keys(window).filter(key => key.endsWith('Manager') || key === 'TableRenderer' || key === 'CSVExporter'));
        
        // Initialize modules in dependency order
        const moduleConfigs = [
            { name: 'TableRenderer', object: 'TableRenderer' },
            { name: 'SelectionManager', object: 'SelectionManager' }, 
            { name: 'CellEditor', object: 'CellEditor' },
            { name: 'SortingManager', object: 'SortingManager' },
            { name: 'KeyboardNavigationManager', object: 'KeyboardNavigationManager' },
            { name: 'ClipboardManager', object: 'ClipboardManager' },
            { name: 'ColumnResizeManager', object: 'ColumnResizeManager' },
            { name: 'ContextMenuManager', object: 'ContextMenuManager' },
            { name: 'DragDropManager', object: 'DragDropManager' },
            { name: 'StatusBarManager', object: 'StatusBarManager' },
            { name: 'CSVExporter', object: 'CSVExporter' }
        ];
        
        moduleConfigs.forEach(config => {
            try {
                // Get the module object from the global scope
                const moduleObject = window[config.object];
                
                if (moduleObject) {
                    console.log('TableEditor: Found module object for', config.name);
                    this.registerModule(config.name, moduleObject);
                } else {
                    console.warn('TableEditor: Module object not found for', config.name);
                }
            } catch (error) {
                console.error('TableEditor: Failed to initialize module', config.name, error);
            }
        });
        
        console.log('TableEditor: Module initialization complete. Registered modules:', Object.keys(this.modules));
    },
    
    /**
     * Initialize the table editor application
     */
    initializeTableEditor: function() {
        console.log('TableEditor: Initializing table editor application...');
        
        // Set up message listener for VSCode communication
        window.addEventListener('message', (event) => {
            this.handleVSCodeMessage(event);
        });
        
        // Request initial table data
        this.requestTableData();
        
        // For debugging: Add a timeout to show test data if no response received
        setTimeout(() => {
            if (!this.state.tableData) {
                console.warn('TableEditor: No table data received after 3 seconds, showing test data');
                this.handleUpdateTableData({
                    headers: ['Column A', 'Column B', 'Column C'],
                    rows: [
                        ['Row 1, Col A', 'Row 1, Col B', 'Row 1, Col C'],
                        ['Row 2, Col A', 'Row 2, Col B', 'Row 2, Col C'],
                        ['Row 3, Col A', 'Row 3, Col B', 'Row 3, Col C']
                    ]
                }, { filename: 'test.md' });
            }
        }, 3000);
        
        console.log('TableEditor: Table editor application initialized');
    },
    
    /**
     * Handle messages from VSCode extension
     */
    handleVSCodeMessage: function(event) {
        const message = event.data;
        console.log('TableEditor: Received message from VSCode:', message.command, message);
        
        switch (message.command) {
            case 'updateTableData':
                this.handleUpdateTableData(message.data, message.fileInfo);
                break;
            case 'setActiveTable':
                this.handleSetActiveTable(message.data);
                break;
            case 'error':
                this.showError(message.message);
                break;
            case 'success':
                this.showSuccess(message.message);
                break;
            case 'status':
                this.showStatus(message.status, message.data);
                break;
            case 'validationError':
                this.showValidationError(message.field, message.message);
                break;
            case 'ping':
                // Respond to health check
                this.vscode.postMessage({
                    command: 'pong',
                    timestamp: message.timestamp,
                    responseTime: Date.now() - message.timestamp
                });
                break;
            default:
                console.warn('TableEditor: Unknown message command:', message.command);
        }
    },
    
    /**
     * Handle table data update from VSCode
     */
    handleUpdateTableData: function(data, fileInfo) {
        // Support both single table and multiple tables data structure
        if (Array.isArray(data)) {
            // Multiple tables
            this.state.allTables = data;
            this.state.currentTableIndex = Math.min(this.state.currentTableIndex, data.length - 1);
            this.state.tableData = data[this.state.currentTableIndex] || null;
        } else {
            // Single table (legacy)
            this.state.allTables = data ? [data] : [];
            this.state.currentTableIndex = 0;
            this.state.tableData = data;
        }
        
        this.state.displayData = this.state.tableData;
        this.state.originalData = this.state.tableData ? JSON.parse(JSON.stringify(this.state.tableData)) : null;
        this.state.fileInfo = fileInfo;
        
        // Clear any existing sort state when new data arrives
        this.state.sortState = { 
            column: -1, 
            direction: 'none',
            isViewOnly: false,
            originalData: null
        };
        
        // Render table with tabs if multiple tables exist
        this.renderApplicationWithTabs();
    },

    /**
     * Handle setting active table from VSCode
     */
    handleSetActiveTable: function(data) {
        if (data && typeof data.index === 'number') {
            this.switchToTable(data.index);
        }
    },
    
    /**
     * Render the application with table tabs
     */
    renderApplicationWithTabs: function() {
        const app = document.getElementById('app');
        if (!app) {
            console.error('TableEditor: App element not found');
            return;
        }
        
        let html = '';
        
        // Render tabs (always show for consistency)
        if (this.state.allTables.length >= 1) {
            html += '<div class="table-tabs">';
            this.state.allTables.forEach((table, index) => {
                const isActive = index === this.state.currentTableIndex;
                const tabTitle = `表 ${index + 1}`;
                html += `<button class="tab-button ${isActive ? 'active' : ''}" onclick="TableEditor.switchToTable(${index})">${tabTitle}</button>`;
            });
            html += '</div>';
        }
        
        // Add table container
        html += '<div id="table-content"></div>';
        
        app.innerHTML = html;
        
        // Render current table
        const renderer = this.getModule('TableRenderer');
        if (renderer && renderer.renderTable && this.state.tableData) {
            // Temporarily set the target to table-content for rendering
            const originalApp = document.getElementById('app');
            const tableContent = document.getElementById('table-content');
            if (tableContent) {
                tableContent.id = 'app'; // Temporarily change ID for renderer
                renderer.renderTable(this.state.tableData);
                tableContent.id = 'table-content'; // Restore ID
            }
        } else if (!this.state.tableData) {
            document.getElementById('table-content').innerHTML = '<div class="no-data">テーブルデータがありません</div>';
        } else {
            console.error('TableEditor: TableRenderer module not available');
            this.showError('Failed to render table: TableRenderer module not loaded');
        }
    },
    
    /**
     * Switch to a different table
     */
    switchToTable: function(index) {
        if (index >= 0 && index < this.state.allTables.length) {
            this.state.currentTableIndex = index;
            this.state.tableData = this.state.allTables[index];
            this.state.displayData = this.state.tableData;
            this.state.originalData = JSON.parse(JSON.stringify(this.state.tableData));
            
            // Clear sort state when switching tables
            this.state.sortState = { 
                column: -1, 
                direction: 'none',
                isViewOnly: false,
                originalData: null
            };
            
            // Re-render with new table
            this.renderApplicationWithTabs();
            
            // Send table switch notification to VSCode
            this.sendMessage({
                command: 'switchTable',
                data: { index: index }
            });
        }
    },
    
    /**
     * Request table data from VSCode
     */
    requestTableData: function() {
        console.log('TableEditor: Requesting table data from VSCode...');
        if (this.vscode) {
            this.vscode.postMessage({ command: 'requestTableData' });
            console.log('TableEditor: Request sent successfully');
        } else {
            console.error('TableEditor: VSCode API not available, cannot request data');
            this.showError('Cannot communicate with VSCode extension');
        }
    },
    
    /**
     * Send message to VSCode with error handling
     */
    sendMessage: function(message) {
        try {
            this.vscode.postMessage(message);
        } catch (error) {
            console.error('TableEditor: Failed to send message to VSCode:', error);
            this.showError('Communication error with VSCode');
        }
    },
    
    /**
     * Show error message
     */
    showError: function(message) {
        const statusBar = this.getModule('StatusBarManager');
        if (statusBar && statusBar.showError) {
            statusBar.showError(message);
        } else {
            console.error('TableEditor Error:', message);
        }
    },
    
    /**
     * Show success message
     */
    showSuccess: function(message) {
        const statusBar = this.getModule('StatusBarManager');
        if (statusBar && statusBar.showSuccess) {
            statusBar.showSuccess(message);
        } else {
            console.log('TableEditor Success:', message);
        }
    },
    
    /**
     * Show status message
     */
    showStatus: function(status, data) {
        const statusBar = this.getModule('StatusBarManager');
        if (statusBar && statusBar.showStatus) {
            statusBar.showStatus(status, data);
        } else {
            console.log('TableEditor Status:', status, data);
        }
    },
    
    /**
     * Show validation error
     */
    showValidationError: function(field, message) {
        const statusBar = this.getModule('StatusBarManager');
        if (statusBar && statusBar.showValidationError) {
            statusBar.showValidationError(field, message);
        } else {
            console.error('TableEditor Validation Error:', field, message);
        }
    },
    
    /**
     * Safe module method call with error handling
     */
    callModule: function(moduleName, methodName, ...args) {
        const module = this.getModule(moduleName);
        if (module && typeof module[methodName] === 'function') {
            try {
                return module[methodName](...args);
            } catch (error) {
                console.error(`TableEditor: Error calling ${moduleName}.${methodName}:`, error);
                this.showError(`Module error: ${moduleName}.${methodName}`);
            }
        } else {
            console.warn(`TableEditor: Module method ${moduleName}.${methodName} not available`);
        }
        return null;
    },
    
    /**
     * Add a new row to the table
     */
    addRow: function(index) {
        const data = this.state.displayData || this.state.tableData;
        if (!data || !data.headers) {
            console.error('TableEditor: No table data available');
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
        
        // Update table data
        this.state.tableData = data;
        this.state.displayData = data;
        
        // Re-render table
        this.callModule('TableRenderer', 'renderTable', data);
        
        // Send addRow command to extension
        this.sendMessage({
            command: 'addRow',
            data: { index: index }
        });
    },
    
    /**
     * Delete a row from the table
     */
    deleteRow: function(index) {
        const data = this.state.displayData || this.state.tableData;
        if (!data || !data.rows || index < 0 || index >= data.rows.length) {
            console.error('TableEditor: Invalid row index');
            return;
        }
        
        if (data.rows.length <= 1) {
            this.showError('Cannot delete the last row');
            return;
        }
        
        // Remove row
        data.rows.splice(index, 1);
        
        // Update table data
        this.state.tableData = data;
        this.state.displayData = data;
        
        // Re-render table
        this.callModule('TableRenderer', 'renderTable', data);
        
        // Send deleteRow command to extension
        this.sendMessage({
            command: 'deleteRow',
            data: { index: index }
        });
    },
    
    /**
     * Add a new column to the table
     */
    addColumn: function(index, headerName) {
        const data = this.state.displayData || this.state.tableData;
        if (!data || !data.headers) {
            console.error('TableEditor: No table data available');
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
        
        // Update table data
        this.state.tableData = data;
        this.state.displayData = data;
        
        // Re-render table
        this.callModule('TableRenderer', 'renderTable', data);
        
        // Send addColumn command to extension
        this.sendMessage({
            command: 'addColumn',
            data: { index: index, header: headerName }
        });
    },
    
    /**
     * Delete a column from the table
     */
    deleteColumn: function(index) {
        const data = this.state.displayData || this.state.tableData;
        if (!data || !data.headers || index < 0 || index >= data.headers.length) {
            console.error('TableEditor: Invalid column index');
            return;
        }
        
        if (data.headers.length <= 1) {
            this.showError('Cannot delete the last column');
            return;
        }
        
        // Remove header
        data.headers.splice(index, 1);
        
        // Remove cells from all rows
        data.rows.forEach(row => {
            if (index < row.length) {
                row.splice(index, 1);
            }
        });
        
        // Update table data
        this.state.tableData = data;
        this.state.displayData = data;
        
        // Re-render table
        this.callModule('TableRenderer', 'renderTable', data);
        
        // Send deleteColumn command to extension
        this.sendMessage({
            command: 'deleteColumn',
            data: { index: index }
        });
    },
    
    /**
     * Update a single cell value
     */
    updateCell: function(row, col, value) {
        console.log('TableEditor: Updating cell', row, col, 'with value:', value);
        
        const data = this.state.displayData || this.state.tableData;
        if (!data || !data.rows || row < 0 || row >= data.rows.length) {
            console.error('TableEditor: Invalid row index');
            return;
        }
        
        if (col < 0 || col >= data.rows[row].length) {
            console.error('TableEditor: Invalid column index');
            return;
        }
        
        // Update the cell value
        data.rows[row][col] = value;
        
        // Update both tableData and displayData
        this.state.tableData = data;
        this.state.displayData = data;
        
        // Send update to extension (with auto-save)
        if (this.vscode) {
            this.vscode.postMessage({
                command: 'updateCell',
                data: {
                    row: row,
                    col: col,
                    value: value
                }
            });
        }
        
        // Show auto-saved status
        this.showAutoSavedStatus();
        
        console.log('TableEditor: Cell updated successfully');
    },

    /**
     * Show auto-saved status in save indicator
     */
    showAutoSavedStatus: function() {
        const saveIndicator = document.getElementById('saveIndicator');
        if (saveIndicator) {
            saveIndicator.textContent = '✓ Auto-saved';
            saveIndicator.className = 'save-indicator saved';
        }
    },

    /**
     * Send table update to extension
     */
    sendTableUpdate: function() {
        if (this.vscode && this.state.tableData) {
            this.vscode.postMessage({
                command: 'updateTableData',
                data: this.state.tableData
            });
        }
    },
    
    /**
     * Send message to VSCode extension
     */
    sendMessage: function(message) {
        if (this.vscode) {
            this.vscode.postMessage(message);
        }
    },
    
    /**
     * Show error message
     */
    showError: function(message) {
        console.error('TableEditor:', message);
        
        // Show error in status bar if available
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message error';
        }
    }
};

// Make TableEditor globally available
window.TableEditor = TableEditor;

console.log('TableEditor: Core module loaded');