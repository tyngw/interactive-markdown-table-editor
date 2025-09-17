/**
 * ⚠️ DEPRECATED: このLegacy WebviewのJSモジュールは廃止されました ⚠️
 * 
 * このファイルは後方互換性のためにのみ保持されています。
 * 新しい開発やメンテナンスは webview-react/src/utils/errorHandler.ts で行われています。
 * React版への移行が完了次第、このファイルは削除予定です。
 * 
 * Error Handling Module
 * 
 * Handles error management, logging, and recovery mechanisms
 */

const ErrorHandler = {
    /**
     * Initialize error handler
     */
    init: function() {
        console.log('ErrorHandler: Initializing...');
        this.setupErrorHandling();
        console.log('ErrorHandler: Initialized');
    },

    /**
     * Setup error handling mechanisms
     */
    setupErrorHandling: function () {
        // Use the state object for loading state tracking
        TableEditor.state.loadingState = {
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

        console.log('ErrorHandler: Error handling initialized');
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

        console.error('ErrorHandler Critical Error:', errorEntry);

        // Show fallback UI if main interface fails
        if (type === 'JavaScript Error') {
            TableEditor.callModule('UIRenderer', 'showFallbackMessage');
        }

        // Show critical error UI for severe issues
        this.showCriticalErrorUI(errorEntry);
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
     * Handle module errors gracefully
     */
    handleModuleError: function (moduleName, methodName, error) {
        const errorMsg = `Error in ${moduleName}.${methodName}: ${error.message}`;
        console.error('ErrorHandler:', errorMsg, error);
        TableEditor.showError(errorMsg);

        // Track failed modules for diagnostics
        if (!TableEditor.state.loadingState) {
            TableEditor.state.loadingState = {
                loaded: new Set(),
                failed: new Set(),
                loading: new Set()
            };
        }
        TableEditor.state.loadingState.failed.add(moduleName);
        return false;
    },

    /**
     * Get system diagnostics
     */
    getDiagnostics: function () {
        return {
            modules: Object.keys(TableEditor.modules),
            loadingState: TableEditor.state.loadingState || {
                loaded: new Set(Object.keys(TableEditor.modules)),
                failed: new Set(),
                loading: new Set()
            },
            tableCount: TableEditor.state.allTables ? TableEditor.state.allTables.length : 0,
            currentTable: TableEditor.state.currentTableIndex,
            hasVSCode: !!TableEditor.vscode,
            errors: this.errorLog || []
        };
    },

    /**
     * Check if a module is loaded
     */
    isModuleLoaded: function (moduleName) {
        return TableEditor.modules.hasOwnProperty(moduleName);
    },

    /**
     * Show error message
     */
    showError: function (message) {
        console.error('ErrorHandler:', message);

        // Show error in status bar if available
        const statusMessage = document.getElementById('statusMessage');
        if (statusMessage) {
            statusMessage.textContent = message;
            statusMessage.className = 'status-message error';
        }
    },

    /**
     * Cleanup error handler resources
     */
    cleanup: function() {
        // Clear error log
        this.errorLog = [];
        console.log('ErrorHandler: Cleaned up');
    }
};

// Register the module
if (window.TableEditor) {
    window.TableEditor.registerModule('ErrorHandler', ErrorHandler);
} else {
    // If TableEditor is not available yet, store the module for later registration
    window.ErrorHandler = ErrorHandler;
}

console.log('ErrorHandler: Module loaded');