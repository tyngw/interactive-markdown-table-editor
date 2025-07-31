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
        // 範囲選択のアンカーセル（選択開始点）を追跡
        rangeSelectionAnchor: null,

        // IME composition state tracking
        isComposing: false,
        imeJustEnded: false,

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
        },

        // Module loading state tracking
        loadingState: {
            loaded: new Set(),
            failed: new Set(),
            loading: new Set()
        },

        // Save status timeout tracking
        saveStatusTimeouts: {
            cell: null,
            header: null,
            table: null
        }
    },

    // VSCode API reference
    vscode: null,

    // Module registry
    modules: {},

    /**
     * Initialize the TableEditor core system
     */
    init: function () {
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
    loadCSS: function () {
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
    registerModule: function (name, module) {
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
    getModule: function (name) {
        return this.modules[name];
    },

    /**
     * Initialize modules in the correct order
     */
    initializeModules: function () {
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

        // Verify TableRenderer is properly registered
        const renderer = this.getModule('TableRenderer');
        console.log('TableEditor: TableRenderer module check:', {
            exists: !!renderer,
            hasRenderTableContent: !!(renderer && renderer.renderTableContent),
            hasInitializeColumnWidths: !!(renderer && renderer.initializeColumnWidths),
            hasSetTableWidth: !!(renderer && renderer.setTableWidth)
        });
    },

    /**
     * Initialize the table editor application
     */
    initializeTableEditor: function () {
        console.log('TableEditor: Initializing table editor application...');

        // Set up message listener for VSCode communication
        this.messageHandler = (event) => {
            this.handleVSCodeMessage(event);
        };
        window.addEventListener('message', this.messageHandler);

        // Set up beforeunload handler for cleanup
        this.beforeUnloadHandler = () => {
            this.cleanup();
        };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);

        // Request initial table data
        this.requestTableData();

        // For debugging: Add a timeout to show test data if no response received
        this.initialDataTimeout = setTimeout(() => {
            if (!this.state.tableData) {
                console.warn('TableEditor: No table data received after 5 seconds, requesting again...');
                this.requestTableData();

                // Show loading message
                const app = document.getElementById('app');
                if (app) {
                    app.innerHTML = '<div style="padding: 20px; text-align: center;">テーブルデータを読み込み中...</div>';
                }
            }
        }, 5000);

        console.log('TableEditor: Table editor application initialized');
    },

    /**
     * Handle messages from VSCode extension
     */
    handleVSCodeMessage: function (event) {
        const message = event.data;
        console.log('TableEditor: Received message from VSCode:', message.command, message);

        switch (message.command) {
            case 'updateTableData':
                console.log('TableEditor: Processing updateTableData message with data:', message.data);
                this.handleUpdateTableData(message.data, message.fileInfo);
                break;
            case 'cellUpdateError':
                console.log('TableEditor: Cell update error received:', message.data);
                this.handleCellUpdateError(message.data);
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
            case 'cellUpdateSuccess':
            case 'headerUpdateSuccess':
            case 'tableUpdateSuccess':
                // Show auto-saved status for explicit save success notifications
                this.showAutoSavedStatus();
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
    handleUpdateTableData: function (data, fileInfo) {
        console.log('TableEditor: handleUpdateTableData called with data:', data, 'fileInfo:', fileInfo);
        console.log('TableEditor: Current table index before update:', this.state.currentTableIndex);

        // Support both single table and multiple tables data structure
        if (Array.isArray(data)) {
            // Multiple tables
            console.log('TableEditor: Processing multiple tables, count:', data.length);

            // Store the previous table index to preserve user's current view
            const previousTableIndex = this.state.currentTableIndex;
            this.state.allTables = data;

            // Ensure currentTableIndex is valid for the new data
            if (previousTableIndex >= 0 && previousTableIndex < data.length) {
                // Keep the same table index if it's still valid
                this.state.currentTableIndex = previousTableIndex;
                console.log('TableEditor: Preserving table index', previousTableIndex);
            } else if (this.state.currentTableIndex >= data.length) {
                console.log('TableEditor: Current table index', this.state.currentTableIndex, 'is out of range, resetting to 0');
                this.state.currentTableIndex = 0;
            } else if (this.state.currentTableIndex < 0) {
                console.log('TableEditor: Current table index is negative, resetting to 0');
                this.state.currentTableIndex = 0;
            }

            this.state.tableData = data[this.state.currentTableIndex] || null;
            console.log('TableEditor: Selected table at index', this.state.currentTableIndex, ':', this.state.tableData);
        } else {
            // Single table (legacy)
            console.log('TableEditor: Processing single table');
            this.state.allTables = data ? [data] : [];
            this.state.currentTableIndex = 0;
            this.state.tableData = data;
        }

        console.log('TableEditor: Final currentTableIndex:', this.state.currentTableIndex);
        console.log('TableEditor: Final tableData:', this.state.tableData);

        this.state.displayData = this.state.tableData;
        this.state.originalData = this.state.tableData ? JSON.parse(JSON.stringify(this.state.tableData)) : null;
        this.state.fileInfo = fileInfo;

        // Debug state after update
        this.debugCurrentState();

        // Clear any existing sort state when new data arrives
        this.state.sortState = {
            column: -1,
            direction: 'none',
            isViewOnly: false,
            originalData: null
        };

        // Show auto-saved status when table data is updated from server
        this.showAutoSavedStatus();

        // Render table with tabs if multiple tables exist
        console.log('TableEditor: Calling renderApplicationWithTabs...');
        this.renderApplicationWithTabs();

        // Update status bar after rendering
        setTimeout(() => {
            this.callModule('StatusBarManager', 'updateTableDimensions');
        }, 100);
    },

    /**
     * Handle setting active table from VSCode
     */
    handleSetActiveTable: function (data) {
        if (data && typeof data.index === 'number') {
            this.switchToTable(data.index);
        }
    },

    /**
     * Handle cell update error from VSCode
     */
    handleCellUpdateError: function (errorData) {
        const { row, col, error } = errorData;
        console.error('TableEditor: Cell update failed for row', row, 'col', col, ':', error);

        // Clear any pending save status timeouts
        if (this.state.saveStatusTimeouts.cell) {
            clearTimeout(this.state.saveStatusTimeouts.cell);
            this.state.saveStatusTimeouts.cell = null;
        }
        if (this.state.saveStatusTimeouts.header) {
            clearTimeout(this.state.saveStatusTimeouts.header);
            this.state.saveStatusTimeouts.header = null;
        }
        if (this.state.saveStatusTimeouts.table) {
            clearTimeout(this.state.saveStatusTimeouts.table);
            this.state.saveStatusTimeouts.table = null;
        }

        // Could implement rollback logic here if needed
        // For now, just show an error message
        this.showError(`Failed to update cell at row ${row + 1}, column ${col + 1}: ${error}`);

        // Show save error status
        this.showSaveError();
    },

    /**
     * Render the application with table tabs
     */
    renderApplicationWithTabs: function () {
        console.log('TableEditor: renderApplicationWithTabs called');
        const app = document.getElementById('app');
        if (!app) {
            console.error('TableEditor: App element not found');
            return;
        }

        console.log('TableEditor: App element found, allTables count:', this.state.allTables.length);

        let html = '';

        // Render tabs (always show for consistency)
        if (this.state.allTables.length >= 1) {
            html += '<div class="table-tabs">';
            this.state.allTables.forEach((table, index) => {
                const isActive = index === this.state.currentTableIndex;
                const tabTitle = `表 ${index + 1}`;
                console.log('TableEditor: Rendering tab', index, 'active:', isActive, 'currentTableIndex:', this.state.currentTableIndex);
                html += `<button class="tab-button ${isActive ? 'active' : ''}" onclick="TableEditor.switchToTable(${index})">${tabTitle}</button>`;
            });
            html += '</div>';
        }

        // Add table container
        html += '<div id="table-content"></div>';

        console.log('TableEditor: Setting app innerHTML');
        app.innerHTML = html;

        // Render current table
        const renderer = this.getModule('TableRenderer');
        console.log('TableEditor: TableRenderer module:', !!renderer);
        console.log('TableEditor: Current tableData:', !!this.state.tableData);

        if (renderer && this.state.tableData) {
            console.log('TableEditor: Rendering table with TableRenderer');
            // Create a custom render method that targets table-content
            this.renderTableInContainer(this.state.tableData);
        } else if (!this.state.tableData) {
            console.log('TableEditor: No table data, showing no-data message');
            document.getElementById('table-content').innerHTML = '<div class="no-data">テーブルデータがありません</div>';
        } else {
            console.error('TableEditor: TableRenderer module not available');
            this.showError('Failed to render table: TableRenderer module not loaded');
        }
    },

    /**
     * Render table in the table-content container
     */
    renderTableInContainer: function (data) {
        console.log('TableEditor: renderTableInContainer called with data:', data);

        const tableContent = document.getElementById('table-content');
        if (!tableContent) {
            console.error('TableEditor: table-content element not found');
            return;
        }

        // Save current scroll position
        const tableContainer = tableContent.querySelector('.table-container');
        const scrollTop = tableContainer ? tableContainer.scrollTop : 0;
        const scrollLeft = tableContainer ? tableContainer.scrollLeft : 0;

        const renderer = this.getModule('TableRenderer');
        if (!renderer) {
            console.error('TableEditor: TableRenderer module not available');
            return;
        }

        if (!data || !data.headers || !data.rows) {
            console.error('TableEditor: Invalid data structure:', data);
            tableContent.innerHTML = '<div class="error">Invalid table data structure</div>';
            return;
        }

        // Update state data
        const state = this.state;
        state.tableData = data;
        state.displayData = data; // Currently displayed data

        console.log('TableEditor: Rendering table with', data.headers.length, 'columns and', data.rows.length, 'rows');

        try {
            const tableContentHtml = renderer.renderTableContent();
            console.log('TableEditor: Generated table content HTML length:', tableContentHtml.length);

            tableContent.innerHTML = `
                <div class="table-container">
                    <table class="table-editor" id="tableEditor">
                        ${tableContentHtml}
                    </table>
                </div>
                
                <!-- Sort Actions Panel -->
                <div class="sort-actions" id="sortActions" style="display: none;">
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
            `;

            // Initialize column widths for new data
            renderer.initializeColumnWidths(data);

            // Set table width to sum of column widths to prevent window resize effects
            renderer.setTableWidth();

            // Restore scroll position
            const newTableContainer = tableContent.querySelector('.table-container');
            if (newTableContainer) {
                newTableContainer.scrollTop = scrollTop;
                newTableContainer.scrollLeft = scrollLeft;
            }

            // Update sort actions visibility after rendering
            this.callModule('SortingManager', 'updateSortActionsVisibility');

            // Update status bar with table information
            this.callModule('StatusBarManager', 'updateTableDimensions');

            console.log('TableEditor: Table rendering completed successfully');
        } catch (error) {
            console.error('TableEditor: Error during table rendering:', error);
            tableContent.innerHTML = '<div class="error">Error rendering table: ' + error.message + '</div>';
        }
    },

    /**
     * Switch to a different table
     */
    switchToTable: function (index) {
        console.log('TableEditor: switchToTable called with index:', index);
        console.log('TableEditor: Current state - currentTableIndex:', this.state.currentTableIndex, 'allTables.length:', this.state.allTables.length);

        if (index >= 0 && index < this.state.allTables.length) {
            console.log('TableEditor: Switching from table', this.state.currentTableIndex, 'to table', index);

            // Update current table index FIRST
            this.state.currentTableIndex = index;
            this.state.tableData = this.state.allTables[index];
            this.state.displayData = this.state.tableData;
            this.state.originalData = JSON.parse(JSON.stringify(this.state.tableData));

            console.log('TableEditor: Updated currentTableIndex to:', this.state.currentTableIndex);
            console.log('TableEditor: New tableData:', this.state.tableData ? 'loaded' : 'null');

            // Clear sort state when switching tables
            this.state.sortState = {
                column: -1,
                direction: 'none',
                isViewOnly: false,
                originalData: null
            };

            // Clear selection state when switching tables
            this.state.selectedCells.clear();
            this.state.selectionStart = null;
            this.state.isSelecting = false;
            this.state.lastSelectedCell = null;
            this.state.rangeSelectionAnchor = null;

            // Re-render with new table
            this.renderApplicationWithTabs();

            // Update status bar after switching tables
            setTimeout(() => {
                this.callModule('StatusBarManager', 'updateTableDimensions');
            }, 100);

            // Send table switch notification to VSCode
            this.sendMessage({
                command: 'switchTable',
                data: { index: index }
            });

            console.log('TableEditor: Successfully switched to table', index, 'currentTableIndex is now:', this.state.currentTableIndex);
        } else {
            console.error('TableEditor: Invalid table index:', index, 'valid range: 0 -', this.state.allTables.length - 1);
        }
    },

    /**
     * Request table data from VSCode
     */
    requestTableData: function () {
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
    sendMessage: function (message) {
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
    showError: function (message) {
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
    showSuccess: function (message) {
        // Don't show "Cell update successfully" messages anymore
        if (message && (message.includes('Cell update successfully') || message.includes('Cell updated successfully'))) {
            // Instead, show auto-saved status
            this.showAutoSavedStatus();
            return;
        }

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
    showStatus: function (status, data) {
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
    showValidationError: function (field, message) {
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
    callModule: function (moduleName, methodName, ...args) {
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
     * Cleanup resources when webview is being closed
     */
    cleanup: function () {
        console.log('TableEditor: Starting cleanup...');

        try {
            // Clear any pending timeouts
            if (this.initialDataTimeout) {
                clearTimeout(this.initialDataTimeout);
                this.initialDataTimeout = null;
            }

            // Clear save status timeouts
            Object.keys(this.state.saveStatusTimeouts).forEach(key => {
                if (this.state.saveStatusTimeouts[key]) {
                    clearTimeout(this.state.saveStatusTimeouts[key]);
                    this.state.saveStatusTimeouts[key] = null;
                }
            });

            // Remove global event listeners
            if (this.messageHandler) {
                window.removeEventListener('message', this.messageHandler);
                this.messageHandler = null;
            }

            if (this.beforeUnloadHandler) {
                window.removeEventListener('beforeunload', this.beforeUnloadHandler);
                this.beforeUnloadHandler = null;
            }

            // Cleanup all modules
            Object.keys(this.modules).forEach(moduleName => {
                const module = this.modules[moduleName];
                if (module && typeof module.cleanup === 'function') {
                    try {
                        module.cleanup();
                        console.log(`TableEditor: Cleaned up module ${moduleName}`);
                    } catch (error) {
                        console.error(`TableEditor: Error cleaning up module ${moduleName}:`, error);
                    }
                }
            });

            // Clear state
            this.state.selectedCells.clear();
            this.state.currentEditingCell = null;
            this.state.tableData = null;
            this.state.rangeSelectionAnchor = null;
            this.state.displayData = null;
            this.state.originalData = null;

            console.log('TableEditor: Cleanup completed');
        } catch (error) {
            console.error('TableEditor: Error during cleanup:', error);
        }
    },

    /**
     * Add a new row to the table
     */
    addRow: function (index) {
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

        // Send addRow command to extension with current table index
        this.sendMessage({
            command: 'addRow',
            data: {
                index: index,
                tableIndex: this.state.currentTableIndex
            }
        });
    },

    /**
     * Delete a row from the table
     */
    deleteRow: function (index) {
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

        // Send deleteRow command to extension with current table index
        this.sendMessage({
            command: 'deleteRow',
            data: {
                index: index,
                tableIndex: this.state.currentTableIndex
            }
        });
    },

    /**
     * Add a new column to the table
     */
    addColumn: function (index, headerName) {
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

        // Send addColumn command to extension with current table index
        this.sendMessage({
            command: 'addColumn',
            data: {
                index: index,
                header: headerName,
                tableIndex: this.state.currentTableIndex
            }
        });
    },

    /**
     * Delete a column from the table
     */
    deleteColumn: function (index) {
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

        // Send deleteColumn command to extension with current table index
        this.sendMessage({
            command: 'deleteColumn',
            data: {
                index: index,
                tableIndex: this.state.currentTableIndex
            }
        });
    },

    /**
     * Update a header column name
     */
    updateHeader: function (col, value) {
        console.log('TableEditor: Updating header', col, 'with value:', value);
        console.log('TableEditor: Current table index:', this.state.currentTableIndex);

        const data = this.state.displayData || this.state.tableData;
        if (!data || !data.headers || col < 0 || col >= data.headers.length) {
            console.error('TableEditor: Invalid header column index');
            return;
        }

        // Update the header value
        data.headers[col] = value;

        // Update both tableData and displayData
        this.state.tableData = data;
        this.state.displayData = data;

        // Debug current state before sending update
        this.debugCurrentState();

        // Show saving status
        this.showSavingStatus();

        // Clear any existing timeout for header updates
        if (this.state.saveStatusTimeouts.header) {
            clearTimeout(this.state.saveStatusTimeouts.header);
        }

        // Send update to extension (with auto-save and current table index)
        if (this.vscode) {
            console.log('TableEditor: Sending updateHeader command with tableIndex:', this.state.currentTableIndex);
            this.vscode.postMessage({
                command: 'updateHeader',
                data: {
                    col: col,
                    value: value,
                    tableIndex: this.state.currentTableIndex
                }
            });

            // Show auto-saved status after a short delay
            this.state.saveStatusTimeouts.header = setTimeout(() => {
                this.showAutoSavedStatus();
                this.state.saveStatusTimeouts.header = null;
            }, 500);
        }

        console.log('TableEditor: Header updated successfully');
    },

    /**
     * Update a single cell value
     */
    updateCell: function (row, col, value) {
        console.log('TableEditor: Updating cell', row, col, 'with value:', value);
        console.log('TableEditor: Current table index:', this.state.currentTableIndex);

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

        // Debug current state before sending update
        this.debugCurrentState();

        // Show saving status
        this.showSavingStatus();

        // Clear any existing timeout for cell updates
        if (this.state.saveStatusTimeouts.cell) {
            clearTimeout(this.state.saveStatusTimeouts.cell);
        }

        // Send update to extension (with auto-save and current table index)
        if (this.vscode) {
            console.log('TableEditor: Sending updateCell command with tableIndex:', this.state.currentTableIndex);
            this.vscode.postMessage({
                command: 'updateCell',
                data: {
                    row: row,
                    col: col,
                    value: value,
                    tableIndex: this.state.currentTableIndex
                }
            });

            // Show auto-saved status after a short delay
            this.state.saveStatusTimeouts.cell = setTimeout(() => {
                this.showAutoSavedStatus();
                this.state.saveStatusTimeouts.cell = null;
            }, 500);
        }

        console.log('TableEditor: Cell updated successfully');
    },

    /**
     * Show saving status in save indicator
     */
    showSavingStatus: function () {
        const statusBar = this.getModule('StatusBarManager');
        if (statusBar && statusBar.showSavingStatus) {
            statusBar.showSavingStatus();
        } else {
            // Fallback if StatusBarManager is not available
            const saveIndicator = document.getElementById('saveIndicator');
            if (saveIndicator) {
                saveIndicator.textContent = '💾 Saving...';
                saveIndicator.className = 'save-indicator saving';
            }
        }
    },

    /**
     * Show auto-saved status in save indicator
     */
    showAutoSavedStatus: function () {
        const statusBar = this.getModule('StatusBarManager');
        if (statusBar && statusBar.showAutoSavedStatus) {
            statusBar.showAutoSavedStatus();
        } else {
            // Fallback if StatusBarManager is not available
            const saveIndicator = document.getElementById('saveIndicator');
            if (saveIndicator) {
                saveIndicator.textContent = '✓ Auto-saved';
                saveIndicator.className = 'save-indicator saved';
            }
        }
    },

    /**
     * Show save error status in save indicator
     */
    showSaveError: function () {
        const statusBar = this.getModule('StatusBarManager');
        if (statusBar && statusBar.showSaveError) {
            statusBar.showSaveError();
        } else {
            // Fallback if StatusBarManager is not available
            const saveIndicator = document.getElementById('saveIndicator');
            if (saveIndicator) {
                saveIndicator.textContent = '✗ Save failed';
                saveIndicator.className = 'save-indicator failed';
            }
        }
    },

    /**
     * Send table update to extension
     */
    sendTableUpdate: function () {
        if (this.vscode && this.state.tableData) {
            // Show saving status
            this.showSavingStatus();

            // Clear any existing timeout for table updates
            if (this.state.saveStatusTimeouts.table) {
                clearTimeout(this.state.saveStatusTimeouts.table);
            }

            this.vscode.postMessage({
                command: 'updateTableData',
                data: this.state.tableData
            });

            // Show auto-saved status after a short delay
            this.state.saveStatusTimeouts.table = setTimeout(() => {
                this.showAutoSavedStatus();
                this.state.saveStatusTimeouts.table = null;
            }, 500);
        }
    },

    /**
     * Send message to VSCode extension
     */
    sendMessage: function (message) {
        if (this.vscode) {
            this.vscode.postMessage(message);
        }
    },

    /**
     * Debug function to check current state
     */
    debugCurrentState: function () {
        console.log('=== TableEditor Debug State ===');
        console.log('currentTableIndex:', this.state.currentTableIndex);
        console.log('allTables.length:', this.state.allTables.length);
        console.log('tableData exists:', !!this.state.tableData);
        console.log('displayData exists:', !!this.state.displayData);
        if (this.state.tableData) {
            console.log('tableData.id:', this.state.tableData.id);
            console.log('tableData.metadata.tableIndex:', this.state.tableData.metadata?.tableIndex);
        }
        console.log('===============================');
    },



    /**
     * Load a module dynamically
     */
    loadModule: function (moduleName) {
        // For now, assume modules are already loaded since we're using script tags
        // This could be extended to support dynamic loading in the future
        if (this.modules.has(moduleName)) {
            console.log(`TableEditor: Module ${moduleName} already loaded`);
            return true;
        }
        console.warn(`TableEditor: Module ${moduleName} not found`);
        return false;
    },

    /**
     * Handle module errors gracefully
     */
    handleModuleError: function (moduleName, methodName, error) {
        const errorMsg = `Error in ${moduleName}.${methodName}: ${error.message}`;
        console.error('TableEditor:', errorMsg, error);
        this.showError(errorMsg);

        // Track failed modules for diagnostics
        if (!this.state.loadingState) {
            this.state.loadingState = {
                loaded: new Set(),
                failed: new Set(),
                loading: new Set()
            };
        }
        this.state.loadingState.failed.add(moduleName);
        return false;
    },

    /**
     * Get system diagnostics
     */
    getDiagnostics: function () {
        return {
            modules: Array.from(this.modules.keys()),
            loadingState: this.state.loadingState || {
                loaded: new Set(this.modules.keys()),
                failed: new Set(),
                loading: new Set()
            },
            tableCount: this.state.allTables ? this.state.allTables.length : 0,
            currentTable: this.state.currentTableIndex,
            hasVSCode: !!this.vscode,
            errors: this.errorLog || []
        };
    },

    /**
     * Setup error handling mechanisms
     */
    setupErrorHandling: function () {
        // Use the state object for loading state tracking
        this.state.loadingState = {
            loaded: new Set(),
            failed: new Set(),
            loading: new Set()
        };

        // Initialize error log
        this.errorLog = [];

        // Global error handlers
        window.addEventListener('error', (event) => {
            this.handleCriticalError('JavaScript Error', event.error);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.handleCriticalError('Unhandled Promise Rejection', event.reason);
        });

        console.log('TableEditor: Error handling initialized');
    },

    /**
     * Handle critical errors
     */
    handleCriticalError: function (type, error) {
        const errorEntry = {
            type: type,
            message: error ? error.message || String(error) : 'Unknown error',
            timestamp: new Date().toISOString(),
            stack: error ? error.stack : undefined
        };

        this.errorLog = this.errorLog || [];
        this.errorLog.push(errorEntry);

        console.error('TableEditor Critical Error:', errorEntry);

        // Show fallback UI if main interface fails
        if (type === 'JavaScript Error') {
            this.showFallbackMessage();
        }

        // Show critical error UI for severe issues
        this.showCriticalErrorUI(errorEntry);
    },

    /**
     * Show fallback message when main interface fails
     */
    showFallbackMessage: function () {
        const container = document.getElementById('table-container');
        if (container) {
            container.innerHTML = '<div class="error-fallback">Table editor encountered an error. Please reload the webview.</div>';
        }
    },

    /**
     * Show critical error UI
     */
    showCriticalErrorUI: function (errorEntry) {
        const statusBar = document.getElementById('statusMessage');
        if (statusBar) {
            statusBar.textContent = `Critical Error: ${errorEntry.message}`;
            statusBar.className = 'status-message error critical';
        }
    },

    /**
     * Check if a module is loaded
     */
    isModuleLoaded: function (moduleName) {
        return this.modules.has(moduleName);
    },

    /**
     * Show error message
     */
    showError: function (message) {
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