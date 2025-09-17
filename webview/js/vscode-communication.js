/**
 * ⚠️ DEPRECATED: このLegacy WebviewのJSモジュールは廃止されました ⚠️
 * 
 * このファイルは後方互換性のためにのみ保持されています。
 * 新しい開発やメンテナンスは webview-react/src/hooks/useVSCodeAPI.ts で行われています。
 * React版への移行が完了次第、このファイルは削除予定です。
 * 
 * VSCode Communication Module
 * 
 * Handles all communication between the webview and VSCode extension
 */

const VSCodeCommunication = {
    /**
     * Initialize VSCode communication
     */
    init: function() {
        console.log('VSCodeCommunication: Initializing...');
        
        // Set up message listener for VSCode communication
        this.messageHandler = (event) => {
            this.handleVSCodeMessage(event);
        };
        window.addEventListener('message', this.messageHandler);
        
        console.log('VSCodeCommunication: Initialized');

        // 起動直後にテーマ変数を要求して適用
        try {
            this.sendMessage({ command: 'requestThemeVariables' });
        } catch (e) {
            console.warn('VSCodeCommunication: Failed to request theme variables on init', e);
        }

        // 追加リトライ: 初期化後少し待って再要求（初回競合のケア）
        setTimeout(() => {
            try { this.sendMessage({ command: 'requestThemeVariables' }); } catch {}
        }, 300);
        setTimeout(() => {
            try { this.sendMessage({ command: 'requestThemeVariables' }); } catch {}
        }, 1000);
    },

    /**
     * Handle messages from VSCode extension
     */
    handleVSCodeMessage: function (event) {
        const message = event.data;
        console.log('VSCodeCommunication: Received message from VSCode:', message.command, message);

        switch (message.command) {
            case 'updateTableData':
                console.log('VSCodeCommunication: Processing updateTableData message with data:', message.data);
                TableEditor.callModule('TableManager', 'handleUpdateTableData', message.data, message.fileInfo);
                break;
            case 'cellUpdateError':
                console.log('VSCodeCommunication: Cell update error received:', message.data);
                TableEditor.callModule('TableManager', 'handleCellUpdateError', message.data);
                break;
            case 'setActiveTable':
                TableEditor.callModule('TableManager', 'handleSetActiveTable', message.data);
                break;
            case 'error':
                TableEditor.showError(message.message);
                break;
            case 'success':
                TableEditor.showSuccess(message.message);
                break;
            case 'cellUpdateSuccess':
            case 'headerUpdateSuccess':
            case 'tableUpdateSuccess':
                // Show auto-saved status for explicit save success notifications
                TableEditor.showAutoSavedStatus();
                break;
            case 'status':
                TableEditor.showStatus(message.status, message.data);
                break;
            case 'validationError':
                TableEditor.showValidationError(message.field, message.message);
                break;
            case 'applyThemeVariables':
                try {
                    const cssText = (message.data && message.data.cssText) || '';
                    // 1) スタイルタグ（後方互換）
                    let styleEl = document.getElementById('mte-theme-override');
                    if (!styleEl) {
                        styleEl = document.createElement('style');
                        styleEl.id = 'mte-theme-override';
                        document.head.appendChild(styleEl);
                    }
                    styleEl.textContent = cssText;

                    // 2) 可能なら :root に inline style として直接適用（優先度を上げる）
                    if (cssText && cssText.includes(':root')) {
                        const match = cssText.match(/:root\s*\{([^}]*)\}/);
                        if (match && match[1]) {
                            const block = match[1];
                            const decls = block.split(';');
                            decls.forEach(d => {
                                const [name, value] = d.split(':');
                                const varName = name && name.trim();
                                const varValue = value && value.trim();
                                if (varName && varValue && varName.startsWith('--vscode-')) {
                                    document.documentElement.style.setProperty(varName, varValue);
                                }
                            });
                        }
                    }
                } catch (e) {
                    console.error('VSCodeCommunication: Failed to apply theme variables', e);
                }
                break;
            case 'ping':
                // Respond to health check
                this.sendMessage({
                    command: 'pong',
                    timestamp: message.timestamp,
                    responseTime: Date.now() - message.timestamp
                });
                break;
            default:
                console.warn('VSCodeCommunication: Unknown message command:', message.command);
        }
    },

    /**
     * Request table data from VSCode
     */
    requestTableData: function () {
        console.log('VSCodeCommunication: Requesting table data from VSCode...');
        if (TableEditor.vscode) {
            TableEditor.vscode.postMessage({ command: 'requestTableData' });
            console.log('VSCodeCommunication: Request sent successfully');
        } else {
            console.error('VSCodeCommunication: VSCode API not available, cannot request data');
            TableEditor.showError('Cannot communicate with VSCode extension');
        }
    },

    /**
     * Send message to VSCode with error handling
     */
    sendMessage: function (message) {
        try {
            if (TableEditor.vscode) {
                // Include current file info if available and not already present
                if (TableEditor.state && TableEditor.state.fileInfo && !message.fileInfo) {
                    message.fileInfo = TableEditor.state.fileInfo;
                }
                // Include current URI for proper routing (ensure it's a string)
                if (TableEditor.state && TableEditor.state.fileInfo && TableEditor.state.fileInfo.uri && !message.uri) {
                    // Ensure URI is a string, not an object
                    const uri = TableEditor.state.fileInfo.uri;
                    message.uri = typeof uri === 'string' ? uri : uri.toString();
                }
                TableEditor.vscode.postMessage(message);
            } else {
                console.error('VSCodeCommunication: VSCode API not available');
            }
        } catch (error) {
            console.error('VSCodeCommunication: Failed to send message to VSCode:', error);
            TableEditor.showError('Communication error with VSCode');
        }
    },

    /**
     * Cleanup communication resources
     */
    cleanup: function() {
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }
        console.log('VSCodeCommunication: Cleaned up');
    }
};

// Register the module
if (window.TableEditor) {
    window.TableEditor.registerModule('VSCodeCommunication', VSCodeCommunication);
} else {
    // If TableEditor is not available yet, store the module for later registration
    window.VSCodeCommunication = VSCodeCommunication;
}

console.log('VSCodeCommunication: Module loaded');