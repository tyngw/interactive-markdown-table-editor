/**
 * Core Module for Markdown Table Editor
 * 
 * This module provides the foundation for the modular table editor system.
 * It manages global state, VSCode API initialization, and module registration.
 */

// Global TableEditor namespace
const TableEditor = {
    // Configuration settings
    config: {
        columnWidth: {
            default: 150,
            min: 50,
            max: 800,
            step: 10
        }
    },

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
     * Dynamically load and register a module
     */
    loadModule: function (name, module) {
        try {
            if (!name || !module) {
                throw new Error('Invalid arguments for loadModule');
            }
            this.registerModule(name, module);
            return true;
        } catch (error) {
            this.handleModuleError(name, error);
            return false;
        }
    },

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

        // Setup global error handling hooks
        try {
            this.setupErrorHandling();
        } catch (error) {
            console.error('TableEditor: Failed to setup error handling:', error);
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
                this.state.loadingState.loaded.add(name);
            } catch (error) {
                this.state.loadingState.failed.add(name);
                this.handleModuleError(name, error);
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
     * Check whether a module is loaded
     */
    isModuleLoaded: function (name) {
        return !!this.modules[name];
    },

    /**
     * Initialize modules in the correct order
     */
    initializeModules: function () {
        console.log('TableEditor: Module initialization phase starting...');
        console.log('TableEditor: Available module objects in window:',
            Object.keys(window).filter(key => key.endsWith('Manager') || key === 'TableRenderer' || key === 'CSVExporter'));

        // Initialize core modules first
        const coreModuleConfigs = [
            { name: 'ErrorHandler', object: 'ErrorHandler' },
            { name: 'VSCodeCommunication', object: 'VSCodeCommunication' },
            { name: 'UIRenderer', object: 'UIRenderer' },
            { name: 'TableManager', object: 'TableManager' }
        ];

        // Initialize feature modules
        const featureModuleConfigs = [
            { name: 'ContentConverter', object: 'ContentConverter' },
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

        // Initialize all modules
        [...coreModuleConfigs, ...featureModuleConfigs].forEach(config => {
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

        // Debug: Log all available window objects that might be modules
        console.log('TableEditor: Available window objects:', Object.keys(window).filter(key =>
            key.includes('Manager') || key.includes('Handler') || key.includes('Renderer') ||
            key.includes('Communication') || key.includes('Exporter') || key.includes('Editor')
        ));

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

        // Set up beforeunload handler for cleanup
        this.beforeUnloadHandler = () => {
            this.cleanup();
        };
        window.addEventListener('beforeunload', this.beforeUnloadHandler);

        // Request initial table data
        this.callModule('VSCodeCommunication', 'requestTableData');

        // For debugging: Add a timeout to show test data if no response received
        this.initialDataTimeout = setTimeout(() => {
            if (!this.state.tableData) {
                console.warn('TableEditor: No table data received after 5 seconds, requesting again...');
                this.callModule('VSCodeCommunication', 'requestTableData');

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
     * Safe module method call with error handling
     */
    callModule: function (moduleName, methodName, ...args) {
        const module = this.getModule(moduleName);
        if (module && typeof module[methodName] === 'function') {
            try {
                return module[methodName](...args);
            } catch (error) {
                this.handleModuleError(`${moduleName}.${methodName}`, error);
                this.showError(`Module error: ${moduleName}.${methodName}`);
            }
        } else {
            console.warn(`TableEditor: Module method ${moduleName}.${methodName} not available`);
        }
        return null;
    },

    /**
     * Error handling helpers for modules and critical failures
     */
    setupErrorHandling: function () {
        const onError = (event) => {
            try {
                const message = event && event.message ? event.message : 'Unknown error';
                this.handleCriticalError(message, event && event.error);
            } catch (e) {
                // ignore
            }
        };
        const onRejection = (event) => {
            try {
                const reason = event && event.reason ? event.reason : 'Unhandled rejection';
                this.handleCriticalError(String(reason), event && event.reason);
            } catch (e) {
                // ignore
            }
        };
        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection);
    },

    handleModuleError: function (moduleName, error) {
        console.error('TableEditor: Module error in', moduleName, error);
    },

    handleCriticalError: function (message, error) {
        console.error('TableEditor: Critical error:', message, error);
        this.showCriticalErrorUI(message);
    },

    showFallbackMessage: function (message) {
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `<div class="loading">${message || '読み込み中...'}</div>`;
        }
    },

    showCriticalErrorUI: function (message) {
        const app = document.getElementById('app');
        if (app) {
            app.innerHTML = `<div style="padding:16px;color:var(--vscode-errorForeground)">致命的なエラー: ${message}</div>`;
        }
    },

    getDiagnostics: function () {
        return {
            modules: Object.keys(this.modules),
            loadedCount: Object.keys(this.modules).length,
            loadingState: {
                loaded: Array.from(this.state.loadingState.loaded),
                failed: Array.from(this.state.loadingState.failed),
                loading: Array.from(this.state.loadingState.loading)
            }
        };
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

            // Remove global event listeners
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

            console.log('TableEditor: Cleanup completed');
        } catch (error) {
            console.error('TableEditor: Error during cleanup:', error);
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
     * Unified scroll position management
     */
    scrollManager: {
        /**
         * Save current scroll position
         */
        saveScrollPosition: function () {
            const tableContainer = document.querySelector('.table-container');
            const scrollState = {
                top: tableContainer ? tableContainer.scrollTop : 0,
                left: tableContainer ? tableContainer.scrollLeft : 0
            };
            console.log('ScrollManager: Saved scroll position:', scrollState);
            return scrollState;
        },

        /**
         * Restore scroll position immediately without flickering
         */
        restoreScrollPosition: function (scrollState, context = 'unknown') {
            if (!scrollState || (scrollState.top === 0 && scrollState.left === 0)) {
                console.log('ScrollManager: No scroll position to restore for context:', context);
                return;
            }

            console.log('ScrollManager: Attempting to restore scroll position for context:', context, scrollState);

            const tableContainer = document.querySelector('.table-container');
            if (!tableContainer) {
                console.warn('ScrollManager: Table container not found for scroll restoration');
                return;
            }

            // Immediately set scroll position to prevent flickering
            tableContainer.scrollTop = scrollState.top;
            tableContainer.scrollLeft = scrollState.left;

            console.log('ScrollManager: Scroll position restored for context:', context, {
                top: tableContainer.scrollTop,
                left: tableContainer.scrollLeft
            });
        },

        /**
         * Restore scroll position with DOM ready check (for cases where DOM might not be ready)
         */
        restoreScrollPositionSafe: function (scrollState, context = 'unknown') {
            if (!scrollState || (scrollState.top === 0 && scrollState.left === 0)) {
                console.log('ScrollManager: No scroll position to restore for context:', context);
                return;
            }

            const attemptRestore = () => {
                const tableContainer = document.querySelector('.table-container');
                if (!tableContainer) {
                    // Use requestAnimationFrame for better timing
                    requestAnimationFrame(attemptRestore);
                    return;
                }

                tableContainer.scrollTop = scrollState.top;
                tableContainer.scrollLeft = scrollState.left;

                console.log('ScrollManager: Safe scroll position restored for context:', context, {
                    top: tableContainer.scrollTop,
                    left: tableContainer.scrollLeft
                });
            };

            attemptRestore();
        },

        /**
         * Execute function with scroll preservation (immediate restoration)
         */
        withScrollPreservation: function (operation, context = 'unknown') {
            const scrollState = this.saveScrollPosition();

            // Execute the operation
            const result = operation();

            // Immediately restore scroll position to prevent flickering
            this.restoreScrollPosition(scrollState, context);

            return result;
        },

        /**
         * Execute function with scroll preservation (safe restoration for async operations)
         */
        withScrollPreservationSafe: function (operation, context = 'unknown') {
            const scrollState = this.saveScrollPosition();

            // Execute the operation
            const result = operation();

            // Use safe restoration for cases where DOM might be modified asynchronously
            requestAnimationFrame(() => {
                this.restoreScrollPositionSafe(scrollState, context);
            });

            return result;
        }
    },

    /**
     * Color utility functions for handling VSCode theme colors
     */
    colorUtils: {
        /**
         * Convert transparent color to opaque color
         * @param {string} color - CSS color value (rgba, rgb, hex, etc.)
         * @param {string} fallbackColor - Fallback color if conversion fails
         * @returns {string} Opaque color
         */
        convertToOpaque: function(color, fallbackColor = '#ffffff') {
            if (!color) return fallbackColor;
            
            // If it's already opaque (no alpha channel), return as is
            if (!color.includes('rgba')) {
                return color;
            }
            
            try {
                // Parse rgba color
                const rgbaMatch = color.match(/rgba?\(([^)]+)\)/);
                if (!rgbaMatch) return fallbackColor;
                
                const values = rgbaMatch[1].split(',').map(v => v.trim());
                if (values.length < 3) return fallbackColor;
                
                const r = parseInt(values[0]);
                const g = parseInt(values[1]);
                const b = parseInt(values[2]);
                const a = values.length > 3 ? parseFloat(values[3]) : 1;
                
                // If alpha is already 1 (opaque), return rgb format
                if (a >= 1) {
                    return `rgb(${r}, ${g}, ${b})`;
                }
                
                // Convert transparent color to opaque by blending with white background
                const blendedR = Math.round(r * a + 255 * (1 - a));
                const blendedG = Math.round(g * a + 255 * (1 - a));
                const blendedB = Math.round(b * a + 255 * (1 - a));
                
                return `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
            } catch (error) {
                console.warn('TableEditor: Failed to convert color to opaque:', color, error);
                return fallbackColor;
            }
        },

        /**
         * Apply opaque colors to row number and column header elements
         */
        applyOpaqueColors: function() {
            console.log('TableEditor: Applying opaque colors to row numbers and column headers');
            
            // Get computed styles for VSCode theme colors
            const rootStyles = getComputedStyle(document.documentElement);
            
            // Colors that might be transparent in VSCode themes
            const themeColors = {
                lineHighlight: rootStyles.getPropertyValue('--vscode-editor-lineHighlightBackground').trim(),
                hoverBackground: rootStyles.getPropertyValue('--vscode-list-hoverBackground').trim(),
                activeSelection: rootStyles.getPropertyValue('--vscode-list-activeSelectionBackground').trim(),
                editorForeground: rootStyles.getPropertyValue('--vscode-editor-foreground').trim(),
                foreground: rootStyles.getPropertyValue('--vscode-foreground').trim()
            };
            
            console.log('TableEditor: Original theme colors:', themeColors);
            
            // Convert to opaque colors
            const opaqueColors = {
                lineHighlight: this.convertToOpaque(themeColors.lineHighlight, '#f5f5f5'),
                hoverBackground: this.convertToOpaque(themeColors.hoverBackground, '#e8e8e8'),
                activeSelection: this.convertToOpaque(themeColors.activeSelection, '#0078d4')
            };
            
            // Determine appropriate text color based on theme
            const textColor = themeColors.editorForeground || themeColors.foreground || '#333333';
            
            console.log('TableEditor: Converted opaque colors:', opaqueColors);
            console.log('TableEditor: Using text color:', textColor);
            
            // Apply opaque colors to row numbers
            const rowNumbers = document.querySelectorAll('.table-editor td.row-number');
            rowNumbers.forEach(cell => {
                cell.style.backgroundColor = opaqueColors.lineHighlight;
                cell.style.color = textColor;
            });
            
            // Apply opaque colors to column headers
            const columnHeaders = document.querySelectorAll('.table-editor th');
            columnHeaders.forEach(header => {
                if (!header.classList.contains('header-corner')) {
                    header.style.backgroundColor = opaqueColors.lineHighlight;
                    header.style.color = textColor;
                }
            });
            
            // Apply opaque colors to header corner
            const headerCorner = document.querySelector('.header-corner');
            if (headerCorner) {
                headerCorner.style.background = `linear-gradient(135deg, ${opaqueColors.lineHighlight} 0%, ${opaqueColors.hoverBackground} 100%)`;
                headerCorner.style.color = textColor;
            }
            
            // Apply text color to column titles and cell content
            const columnTitles = document.querySelectorAll('.column-title, .header-text');
            columnTitles.forEach(title => {
                title.style.color = textColor;
            });
            
            const cellContents = document.querySelectorAll('.cell-content');
            cellContents.forEach(content => {
                content.style.color = textColor;
            });
            
            console.log('TableEditor: Opaque colors and text colors applied successfully');
        }
    }
};

// Make TableEditor globally available
window.TableEditor = TableEditor;

console.log('TableEditor: Core module loaded');