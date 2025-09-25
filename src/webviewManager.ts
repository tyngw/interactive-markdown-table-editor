import * as vscode from 'vscode';
import * as path from 'path';
import { TableData } from './tableDataManager';
import { buildThemeVariablesCss } from './themeUtils';
import { UndoRedoManager } from './undoRedoManager';
import { WebviewMessage } from './messages/types';
export type { WebviewMessage } from './messages/types';
import { validateBasicMessageStructure, validateMessageCommand, validateMessageData } from './messages/validators';
import { buildWebviewHtml } from './webviewHtmlBuilder';

    // WebviewMessage 型は messages/types へ分離

export class WebviewManager {
    private static instance: WebviewManager;
    private panels: Map<string, vscode.WebviewPanel> = new Map();
    private context: vscode.ExtensionContext;
    private connectionHealthMap: Map<string, { lastActivity: number; isHealthy: boolean }> = new Map();
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private undoRedoManager: UndoRedoManager;
    private isInitialized: boolean = false;
    private initializationPromise: Promise<void> | null = null;

    /**
     * 安全なURI文字列を生成するユーティリティメソッド
     */
    private getSafeUriString(uri: vscode.Uri): string {
        try {
            // 不正な文字をチェックして安全なURIを作成
            if (!uri || !uri.scheme) {
                console.warn('Invalid URI provided:', uri);
                return '';
            }

            // 最初にtoString()を試す
            const uriString = uri.toString();
            
            // Basic validation: URIに必要最小限の文字が含まれているかチェック
            if (uriString.length < 5 || !uriString.includes('://')) {
                console.warn('Invalid URI string format:', uriString);
                throw new Error('Invalid URI format');
            }

            // schemeに不正な文字が含まれていないかチェック
            const schemeRegex = /^[a-zA-Z][a-zA-Z0-9+.-]*$/;
            if (!schemeRegex.test(uri.scheme)) {
                console.warn('Invalid URI scheme detected:', uri.scheme, 'Full URI:', uriString);
                // エラーではなく、警告として処理し続行
            }

            return uriString;
        } catch (error) {
            console.error('Failed to create safe URI string:', error);
            console.error('Original URI:', uri);
            
            // より詳細なフォールバック処理
            try {
                // 基本的なURI再構成を試行
                const reconstructedUri = vscode.Uri.from({
                    scheme: uri.scheme === 'untitled' ? 'file' : (uri.scheme || 'file'),
                    path: uri.path || '',
                    query: uri.query || '',
                    fragment: uri.fragment || ''
                });
                const reconstructedString = reconstructedUri.toString();
                console.log('Reconstructed URI:', reconstructedString);
                return reconstructedString;
            } catch (reconstructError) {
                console.error('Failed to reconstruct URI:', reconstructError);
                
                // 最後のフォールバック: 安全な文字でエンコード
                try {
                    if (uri.path) {
                        // ファイルパスが利用可能な場合はfile schemeで再構築
                        const fileUri = vscode.Uri.file(uri.fsPath || uri.path);
                        return fileUri.toString();
                    } else {
                        // どうしても作れない場合は空文字を返す
                        console.error('Cannot create any valid URI representation');
                        return '';
                    }
                } catch (finalError) {
                    console.error('Final fallback also failed:', finalError);
                    return '';
                }
            }
        }
    }

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.undoRedoManager = UndoRedoManager.getInstance();
        this.startHealthMonitoring();
        
        // Start async initialization but don't block constructor
        this.initializationPromise = this.initializeAsync();
    }
    
    /**
     * 非同期初期化処理
     */
    private async initializeAsync(): Promise<void> {
        // ビルド成果物の存在チェックは HTML ビルダー側で実施するため、ここでは状態遷移のみ行う。
        this.isInitialized = true;
    }
    
    /**
     * 初期化完了を待つ
     */
    private async ensureInitialized(): Promise<void> {
        if (!this.isInitialized && this.initializationPromise) {
            await this.initializationPromise;
        }
    }

    public static getInstance(context?: vscode.ExtensionContext): WebviewManager {
        // 後方互換: context未指定でもインスタンスを生成できるようにする（テスト用）
        if (!WebviewManager.instance) {
            const ctx = context ?? (WebviewManager as any)._createDefaultContext?.() ?? WebviewManager.createDefaultContext();
            WebviewManager.instance = new WebviewManager(ctx);
        }
        return WebviewManager.instance;
    }

    // テストやユーティリティ用途のための最小コンテキストを生成
    private static createDefaultContext(): vscode.ExtensionContext {
        const root = vscode.Uri.file(process.cwd());
        // 型の厳格性は求めない（必要最低限のプロパティのみ）
        const ctx: any = {
            subscriptions: [],
            extensionUri: root,
            extensionPath: root.fsPath,
            asAbsolutePath: (rel: string) => path.join(root.fsPath, rel),
            workspaceState: {},
            globalState: {},
            storageUri: root,
            globalStorageUri: root,
            logUri: root,
            storagePath: root.fsPath,
            globalStoragePath: root.fsPath,
            logPath: root.fsPath,
            extensionMode: vscode.ExtensionMode.Test,
        };
        return ctx as vscode.ExtensionContext;
    }

    /**
     * Check if there is any active panel
     */
    public hasActivePanel(): boolean {
        return this.panels.size > 0;
    }

    /**
     * Get the URI of the currently active panel
     */
    public getActivePanelUri(): string | null {
        if (this.panels.size === 0) {
            return null;
        }
        // Return the first (and likely only) panel's URI
        return Array.from(this.panels.keys())[0];
    }

    /**
     * Get panel by panel ID or URI
     */
    public getPanel(panelId: string): vscode.WebviewPanel | null;
    public getPanel(uri: vscode.Uri): vscode.WebviewPanel | null;
    public getPanel(panelIdOrUri: string | vscode.Uri): vscode.WebviewPanel | null {
        const panelId = typeof panelIdOrUri === 'string' ? panelIdOrUri : panelIdOrUri.toString();
        return this.panels.get(panelId) || null;
    }

    /**
     * Get panel ID from URI (for backward compatibility)
     */
    public getPanelId(uri: vscode.Uri): string {
        return uri.toString();
    }

    /**
     * Find the actual panel ID for a given panel instance
     */
    private findPanelId(panel: vscode.WebviewPanel): string {
        for (const [panelId, panelInstance] of this.panels.entries()) {
            if (panelInstance === panel) {
                return panelId;
            }
        }
        // Fallback - should not happen in normal operation
        return '';
    }

    /**
     * Get all panels for a specific file URI
     */
    public getPanelsForFile(fileUri: string): Map<string, vscode.WebviewPanel> {
        const filePanels = new Map<string, vscode.WebviewPanel>();
        for (const [panelId, panel] of this.panels.entries()) {
            if (panelId.startsWith(fileUri)) {
                filePanels.set(panelId, panel);
            }
        }
        return filePanels;
    }

    /**
     * Broadcast message to all panels
     */
    public broadcastMessage(command: string, data?: any): void {
        const message = { command, data };
        for (const panel of this.panels.values()) {
            panel.webview.postMessage(message);
        }
    }

    /**
     * Backward-compatible message validator for tests
     */
    public validateMessage(message: any): boolean {
        if (!validateBasicMessageStructure(message)) return false;
        if (!validateMessageCommand(message)) return false;
        if (!validateMessageData(message)) return false;
        return true;
    }

    /**
     * Send success message to webview
     */
    public sendSuccess(panel: vscode.WebviewPanel, message: string, data?: any): void {
        panel.webview.postMessage({
            command: 'success',
            message: message,
            data: data
        });
    }

    /**
     * Create a new table editor panel
     */
    public async createTableEditorPanel(tableData: TableData | TableData[], uri: vscode.Uri): Promise<vscode.WebviewPanel> {
        return await this._createTableEditorPanel(tableData, uri, false);
    }

    /**
     * Create a new table editor panel, always in a new panel
     * Returns both the panel and the unique panel ID used internally
     */
    public async createTableEditorPanelNewPanel(tableData: TableData | TableData[], uri: vscode.Uri): Promise<{ panel: vscode.WebviewPanel; panelId: string }> {
        const result = await this._createTableEditorPanel(tableData, uri, true);
        // Find the panel ID that was actually used
        const panelId = Array.from(this.panels.entries()).find(([_, p]) => p === result)?.[0] || uri.toString();
        return { panel: result, panelId };
    }

    /**
     * Internal method to create table editor panel with option to force new panel
     */
    private async _createTableEditorPanel(tableData: TableData | TableData[], uri: vscode.Uri, forceNewPanel: boolean): Promise<vscode.WebviewPanel> {
        // Ensure WebviewManager is fully initialized before proceeding
        await this.ensureInitialized();
        
        let panelId = uri.toString();

        // If forcing new panel, create unique panel ID
        if (forceNewPanel) {
            let timestamp = Date.now();
            panelId = `${uri.toString()}_${timestamp}`;
            // Ensure uniqueness by incrementing timestamp if needed
            while (this.panels.has(panelId)) {
                timestamp++;
                panelId = `${uri.toString()}_${timestamp}`;
            }
        }

        console.log('Creating webview panel for:', panelId, forceNewPanel ? '(forced new panel)' : '');

        // If panel already exists for the same file and not forcing new panel, reveal it
        if (!forceNewPanel && this.panels.has(panelId)) {
            console.log('Panel already exists for same file, revealing...');
            const existingPanel = this.panels.get(panelId)!;
            existingPanel.reveal();
            this.updateTableData(existingPanel, tableData, uri);
            return existingPanel;
        }

        // If any table editor panel is already open and not forcing new panel, reuse it for the new file
        if (!forceNewPanel && this.panels.size > 0) {
            console.log('Existing table editor panel found, reusing for new file...');
            const existingPanelEntry = Array.from(this.panels.entries())[0];
            const [oldPanelId, existingPanel] = existingPanelEntry;
            
            // Remove old panel reference and add new one
            this.panels.delete(oldPanelId);
            this.panels.set(panelId, existingPanel);
            
            // Update panel title
            existingPanel.title = `${path.basename(uri.fsPath)} - Table Editor`;
            
            // Reveal and update with new data
            existingPanel.reveal();
            this.updateTableData(existingPanel, tableData, uri);
            return existingPanel;
        }

        console.log('Creating new webview panel...');

        // Generate appropriate title
        let panelTitle = `${path.basename(uri.fsPath)} - Table Editor`;
        if (forceNewPanel) {
            // Add panel number for new panels to distinguish them
            const existingPanelsForFile = Array.from(this.panels.keys()).filter(id => id.startsWith(uri.toString()));
            const panelNumber = existingPanelsForFile.length + 1;
            panelTitle = `${path.basename(uri.fsPath)} - Table Editor (${panelNumber})`;
        }

        // Create new panel with safe URI handling
        let panel: vscode.WebviewPanel;
        try {
            panel = vscode.window.createWebviewPanel(
                'markdownTableEditor',
                panelTitle,
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(this.context.extensionUri, 'webview-dist'),
                        vscode.Uri.joinPath(this.context.extensionUri, 'out', 'webview'),
                        vscode.Uri.joinPath(this.context.extensionUri, 'webview')
                    ]
                }
            );

            // Set the icon for the webview panel tab with error handling
            try {
                panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'icon.png');
            } catch (iconError) {
                console.warn('Failed to set panel icon:', iconError);
                // Continue without icon
            }
        } catch (panelError) {
            console.error('Failed to create webview panel:', panelError);
            throw new Error(`Failed to create webview panel: ${panelError instanceof Error ? panelError.message : String(panelError)}`);
        }

        console.log('Webview panel created, setting HTML content...');

        try {
            console.log('Creating webview HTML via builder');
            const html = await buildWebviewHtml(this.context, panel);
            panel.webview.html = html;
        } catch (error) {
            console.error('Failed to construct webview HTML:', error);
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Unable to construct webview HTML: ${message}`);
        }

        console.log('HTML content set, storing panel reference...');

        // Store panel reference
        this.panels.set(panelId, panel);

        // Handle panel disposal
        panel.onDidDispose(() => {
            console.log('Panel disposed for:', panelId);
            // Remove the panel reference by finding the entry that matches the panel object
            for (const [key, panelRef] of this.panels.entries()) {
                if (panelRef === panel) {
                    this.panels.delete(key);
                    this.connectionHealthMap.delete(key);
                    break;
                }
            }
        }, null, this.context.subscriptions);

        // Handle panel view state changes (when tab becomes active/inactive)
        panel.onDidChangeViewState((e) => {
            if (e.webviewPanel.active && e.webviewPanel.visible) {
                const currentPanelId = this.findPanelId(e.webviewPanel);
                if (currentPanelId) {
                    console.log('[MTE][Ext] Panel became active, refreshing data for:', currentPanelId);
                    // Request fresh data when panel becomes active
                    this.refreshPanelData(e.webviewPanel, vscode.Uri.parse(currentPanelId.replace(/_\d{13,}$/, '')));
                    // Ensure theme is applied when panel becomes active
                    this.applyThemeToPanel(e.webviewPanel);
                }
            } else {
                const currentPanelId = this.findPanelId(e.webviewPanel);
                console.log('[MTE][Ext] Panel state changed (inactive or hidden):', { active: e.webviewPanel.active, visible: e.webviewPanel.visible, panelId: currentPanelId });
            }
        }, null, this.context.subscriptions);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            (message: WebviewMessage) => this.handleMessage(message, panel),
            undefined,
            this.context.subscriptions
        );

        console.log('Setting up initial data timeout...');

        // Send initial data after webview is fully ready
        setTimeout(() => {
            console.log('Sending initial table data to webview...');
            this.updateTableData(panel, tableData, uri);
            // Apply theme shortly after data is sent to avoid race with script init
            this.applyThemeToPanel(panel);

            // Send a second update after another delay to ensure it's received
            setTimeout(() => {
                console.log('Sending table data to webview...');
                this.updateTableData(panel, tableData, uri);
                // Re-apply theme again to cover late-initialized listeners
                this.applyThemeToPanel(panel);
            }, 1000);
        }, 500);

        console.log('Webview panel setup complete');
        return panel;
    }

    /**
     * Update table data in the webview
     */
    public updateTableData(panel: vscode.WebviewPanel, tableData: TableData | TableData[], uri?: vscode.Uri): void {
    const start = Date.now();
        const message: any = {
            command: 'updateTableData',
            data: tableData
        };

        // Include file information if URI is provided
        if (uri) {
            const path = require('path');
            message.fileInfo = {
                uri: uri.toString(),
                fileName: path.basename(uri.fsPath),
                fileNameWithoutExt: path.basename(uri.fsPath, path.extname(uri.fsPath))
            };
        }

        try {
            const tables = Array.isArray(tableData) ? tableData.length : 1;
            console.log('[MTE][Ext] Sending updateTableData', { tables, hasUri: !!uri, panelActive: panel.active, panelVisible: panel.visible });
        } catch {}
        panel.webview.postMessage(message);
        try {
            console.log('[MTE][Ext] updateTableData posted in', Date.now() - start, 'ms');
        } catch {}
    }

    /**
     * Set active table index in webview
     */
    public setActiveTable(panel: vscode.WebviewPanel, index: number): void {
        panel.webview.postMessage({
            command: 'setActiveTable',
            data: { index }
        });
    }

    /**
     * Refresh panel data when it becomes active
     */
    private refreshPanelData(panel: vscode.WebviewPanel, uri: vscode.Uri): void {
        const actualPanelId = this.findPanelId(panel);

        // Request fresh table data from the file
        vscode.commands.executeCommand('markdownTableEditor.internal.requestTableData', {
            uri,
            panelId: actualPanelId,
            forceRefresh: true // Flag to indicate this is a forced refresh
        });
    }

    /**
     * Send error message to webview
     */
    public sendError(panel: vscode.WebviewPanel, message: string): void {
        panel.webview.postMessage({
            command: 'error',
            message: message
        });
    }

    /**
     * Send cell update error to webview for potential rollback
     */
    public sendCellUpdateError(panel: vscode.WebviewPanel, errorInfo: { row: number; col: number; error: string }): void {
        panel.webview.postMessage({
            command: 'cellUpdateError',
            data: errorInfo
        });
    }

    public sendHeaderUpdateError(panel: vscode.WebviewPanel, errorInfo: { col: number; error: string }): void {
        panel.webview.postMessage({
            command: 'headerUpdateError',
            data: errorInfo
        });
    }

    /**
     * Handle messages from webview
     */
    private async handleMessage(message: WebviewMessage, panel: vscode.WebviewPanel): Promise<void> {
        try {
            // Mark connection as healthy when we receive a message
            let panelId = this.findPanelId(panel);
            const uriString = panelId.replace(/_\d{13,}$/, '');
            const uri = vscode.Uri.parse(uriString);

            // テスト環境などでパネルが登録されていない場合はURIをフォールバックキーに使用
            if (!panelId) {
                panelId = uri?.toString?.() || '';
            }
            this.markConnectionHealthy(panelId);

            // Basic message structure validation
            if (!validateBasicMessageStructure(message)) {
                this.sendError(panel, 'Invalid message format received from webview');
                return;
            }

            console.log(`Handling webview message: ${message.command}`, message.data);

            // Validate specific message content based on command
            if (!validateMessageCommand(message)) {
                this.sendError(panel, `Unknown command: ${message.command}`);
                return;
            }

            if (!validateMessageData(message)) {
                this.sendError(panel, 'Invalid message data received from webview');
                return;
            }

            switch (message.command) {
                case 'requestTableData':
                    await this.handleRequestTableData(panel, uri);
                    break;

                case 'updateCell':
                    await this.handleCellUpdate(message.data, panel, uri);
                    break;

                case 'bulkUpdateCells':
                    await this.handleBulkUpdateCells(message.data, panel, uri);
                    break;

                case 'updateHeader':
                    await this.handleHeaderUpdate(message.data, panel, uri);
                    break;

                case 'addRow':
                    await this.handleAddRow(message.data, panel, uri);
                    break;

                case 'deleteRows':
                    await this.handleDeleteRows(message.data, panel, uri);
                    break;

                case 'addColumn':
                    await this.handleAddColumn(message.data, panel, uri);
                    break;

                case 'deleteColumns':
                    await this.handleDeleteColumns(message.data, panel, uri);
                    break;

                case 'sort':
                    await this.handleSort(message.data, panel, uri);
                    break;

                case 'moveRow':
                    await this.handleMoveRow(message.data, panel, uri);
                    break;

                case 'moveColumn':
                    await this.handleMoveColumn(message.data, panel, uri);
                    break;

                case 'exportCSV':
                    await this.handleExportCSV(message.data, panel, uri);
                    break;

                case 'pong':
                    // Handle pong response from webview
                    console.log(`Received pong from webview, response time: ${message.responseTime ? message.responseTime - (message.timestamp || 0) : 'unknown'}ms`);
                    this.markConnectionHealthy(panelId);
                    break;

                case 'switchTable':
                    // Handle table switch notification from webview
                    console.log('[MTE][Ext] Table switch notification from webview:', message.data);
                    // Send setActiveTable to synchronize the index explicitly
                    await this.handleSwitchTable(message.data, panel, uri);
                    break;

                case 'requestThemeVariables':
                    await this.handleRequestThemeVariables(panel);
                    break;

                case 'undo':
                    await this.handleUndo(panel, uri);
                    break;

                case 'redo':
                    await this.handleRedo(panel, uri);
                    break;

                case 'diag':
                    // Diagnostic pings from webview – keep lightweight
                    console.log('[MTE][Ext] diag:', message.data);
                    break;

                case 'webviewError':
                    console.warn('[MTE][Ext] webviewError:', message.data);
                    break;

                case 'webviewUnhandledRejection':
                    console.warn('[MTE][Ext] webviewUnhandledRejection:', message.data);
                    break;

                default:
                    console.warn('[MTE][Ext] Unhandled webview command:', message.command, message.data);
                    break;
            }
        } catch (err) {
            console.error('[MTE][Ext] Error handling webview message:', err);
            try { this.sendError(panel, `Error handling message: ${err instanceof Error ? err.message : String(err)}`); } catch {}
        }
    }


    /**
     * Handle request for table data
     */
    private async handleRequestTableData(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Table data requested for:', uri.toString());

        const actualPanelId = this.findPanelId(panel);

        // Emit custom event that can be handled by the extension
        vscode.commands.executeCommand('markdownTableEditor.internal.requestTableData', {
            uri: uri.toString(), // Convert URI to string
            panelId: actualPanelId
        });
    }

    /**
     * Handle undo request from webview - USING CUSTOM UNDO/REDO (NO FOCUS CHANGE!)
     */
    private async handleUndo(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        try {
            console.log('[MTE][Ext] Executing custom undo (no focus change required)');
            
            // Log stats before undo
            const statsBefore = this.undoRedoManager.getStats(uri);
            console.log('[MTE][Ext] Before undo:', statsBefore);
            
            const success = await this.undoRedoManager.undo(uri);
            
            if (success) {
                // Log stats after undo
                const statsAfter = this.undoRedoManager.getStats(uri);
                console.log('[MTE][Ext] After undo:', statsAfter);
                
                // Refresh panel data to reflect changes
                this.refreshPanelData(panel, uri);
                console.log('[MTE][Ext] Undo completed successfully');
            } else {
                // Show warning in VSCode notification instead of webview error screen
                vscode.window.showWarningMessage('No changes to undo');
            }
            
        } catch (error) {
            console.error('[MTE][Ext] Undo command failed:', error);
            const errorMessage = `Undo failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            // Show error in VSCode notification instead of webview error screen
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    /**
     * Handle redo request from webview - USING CUSTOM UNDO/REDO (NO FOCUS CHANGE!)
     */
    private async handleRedo(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        try {
            console.log('[MTE][Ext] Executing custom redo (no focus change required)');
            
            // Log stats before redo
            const statsBefore = this.undoRedoManager.getStats(uri);
            console.log('[MTE][Ext] Before redo:', statsBefore);
            
            const success = await this.undoRedoManager.redo(uri);
            
            if (success) {
                // Log stats after redo
                const statsAfter = this.undoRedoManager.getStats(uri);
                console.log('[MTE][Ext] After redo:', statsAfter);
                
                // Refresh panel data to reflect changes
                this.refreshPanelData(panel, uri);
                console.log('[MTE][Ext] Redo completed successfully');
            } else {
                // Show warning in VSCode notification instead of webview error screen
                vscode.window.showWarningMessage('No changes to redo');
            }
            
        } catch (error) {
            console.error('[MTE][Ext] Redo command failed:', error);
            const errorMessage = `Redo failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
            // Show error in VSCode notification instead of webview error screen
            vscode.window.showErrorMessage(errorMessage);
        }
    }

    /**
     * Handle bulk cell update
     */
    private async handleBulkUpdateCells(data: { updates: Array<{ row: number; col: number; value: string }>; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('🔧 WebviewManager: Bulk cell update received from React:');
        console.log('📦 Raw React Data:', JSON.stringify(data, null, 2));
        console.log('📊 Bulk update tableIndex from React:', data.tableIndex);

        // Save state before making changes for undo functionality
        await this.undoRedoManager.saveState(uri, 'Bulk cell update');

        const actualPanelId = this.findPanelId(panel);

        const commandData = {
            uri: uri.toString(),
            panelId: actualPanelId,
            updates: data.updates,
            tableIndex: data.tableIndex
        };

        console.log('📤 Sending bulk command data to Extension:', JSON.stringify(commandData, null, 2));

        // Emit custom event that can be handled by the extension
        vscode.commands.executeCommand('markdownTableEditor.internal.bulkUpdateCells', commandData);
    }

    /**
     * Handle cell update
     */
    private async handleCellUpdate(data: { row: number; col: number; value: string; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('🔧 WebviewManager: Cell update received from React:');
        console.log('📦 Raw React Data:', JSON.stringify(data, null, 2));
        console.log('📊 Cell update tableIndex from React:', data.tableIndex);

        const actualPanelId = this.findPanelId(panel);
        const safeUriString = this.getSafeUriString(uri);

        if (!safeUriString) {
            console.error('Failed to create safe URI string for cell update operation');
            return;
        }

        const commandData = {
            uri: safeUriString,
            panelId: actualPanelId,
            row: data.row,
            col: data.col,
            value: data.value,
            tableIndex: data.tableIndex
        };

        console.log('📤 Sending command data to Extension:', JSON.stringify(commandData, null, 2));

        // Emit custom event that can be handled by the extension
        vscode.commands.executeCommand('markdownTableEditor.internal.updateCell', commandData);
    }

    /**
     * Handle header update
     */
    private async handleHeaderUpdate(data: { col: number; value: string; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Header update:', data, 'for file:', uri.toString());
        console.log('Header update tableIndex:', data.tableIndex);

        const actualPanelId = this.findPanelId(panel);
        const safeUriString = this.getSafeUriString(uri);

        if (!safeUriString) {
            console.error('Failed to create safe URI string for header update operation');
            return;
        }

        const commandData = {
            uri: safeUriString,
            panelId: actualPanelId,
            col: data.col,
            value: data.value,
            tableIndex: data.tableIndex
        };

        console.log('Sending header command data:', commandData);

        // Emit custom event that can be handled by the extension
        vscode.commands.executeCommand('markdownTableEditor.internal.updateHeader', commandData);
    }

    /**
     * Handle add row
     */
    private async handleAddRow(data: { index?: number; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Add row:', data, 'for file:', uri.toString());

        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.addRow', {
            uri: uri.toString(),
            panelId: actualPanelId,
            index: data?.index,
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Handle delete multiple rows
     */
    private async handleDeleteRows(data: { indices: number[]; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Delete rows:', data, 'for file:', uri.toString());

        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.deleteRows', {
            uri: uri.toString(),
            panelId: actualPanelId,
            indices: data.indices,
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Handle add column
     */
    private async handleAddColumn(data: { index?: number; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Add column:', data, 'for file:', uri.toString());

        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.addColumn', {
            uri: uri.toString(),
            panelId: actualPanelId,
            index: data?.index,
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Handle delete multiple columns
     */
    private async handleDeleteColumns(data: { indices: number[]; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Delete columns:', data, 'for file:', uri.toString());

        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.deleteColumns', {
            uri: uri.toString(),
            panelId: actualPanelId,
            indices: data.indices,
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Handle sort
     */
    private async handleSort(data: { column: number; direction: string; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Sort:', data, 'for file:', uri.toString());

        // データの検証
        if (!data || typeof data.column !== 'number' || !data.direction) {
            console.error('Invalid sort data:', data);
            return;
        }

        // direction値の検証
        const validDirections = ['asc', 'desc', 'none'];
        if (!validDirections.includes(data.direction)) {
            console.error('Invalid sort direction:', data.direction);
            return;
        }

        const actualPanelId = this.findPanelId(panel);
        const safeUriString = this.getSafeUriString(uri);

        if (!safeUriString) {
            console.error('Failed to create safe URI string for sort operation');
            return;
        }

        vscode.commands.executeCommand('markdownTableEditor.internal.sort', {
            uri: safeUriString,
            panelId: actualPanelId,
            column: data.column,
            direction: data.direction,
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Handle move row
     */
    private async handleMoveRow(data: { fromIndex: number; toIndex: number; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Move row:', data, 'for file:', uri.toString());

        // Validate indices
        if (typeof data.fromIndex !== 'number' || typeof data.toIndex !== 'number') {
            const error = `Failed to move row: Invalid row indices: from ${data.fromIndex}, to ${data.toIndex}`;
            console.error(error);
            panel.webview.postMessage({
                command: 'error',
                message: error
            });
            return;
        }

        if (data.fromIndex < 0 || data.toIndex < 0) {
            const error = `Failed to move row: Invalid row indices (negative): from ${data.fromIndex}, to ${data.toIndex}`;
            console.error(error);
            panel.webview.postMessage({
                command: 'error',
                message: error
            });
            return;
        }

        const actualPanelId = this.findPanelId(panel);

        try {
            vscode.commands.executeCommand('markdownTableEditor.internal.moveRow', {
                uri: uri.toString(),
                panelId: actualPanelId,
                fromIndex: data.fromIndex,
                toIndex: data.toIndex,
                tableIndex: data?.tableIndex
            });
        } catch (error) {
            const errorMessage = `Failed to execute moveRow command: ${error}`;
            console.error(errorMessage);
            panel.webview.postMessage({
                command: 'error',
                message: errorMessage
            });
        }
    }

    /**
     * Handle move column
     */
    private async handleMoveColumn(data: { fromIndex: number; toIndex: number; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Move column:', data, 'for file:', uri.toString());

        // Validate indices
        if (typeof data.fromIndex !== 'number' || typeof data.toIndex !== 'number') {
            const error = `Failed to move column: Invalid column indices: from ${data.fromIndex}, to ${data.toIndex}`;
            console.error(error);
            panel.webview.postMessage({
                command: 'error',
                message: error
            });
            return;
        }

        if (data.fromIndex < 0 || data.toIndex < 0) {
            const error = `Failed to move column: Invalid column indices (negative): from ${data.fromIndex}, to ${data.toIndex}`;
            console.error(error);
            panel.webview.postMessage({
                command: 'error',
                message: error
            });
            return;
        }

        const actualPanelId = this.findPanelId(panel);

        try {
            vscode.commands.executeCommand('markdownTableEditor.internal.moveColumn', {
                uri: uri.toString(),
                panelId: actualPanelId,
                fromIndex: data.fromIndex,
                toIndex: data.toIndex,
                tableIndex: data?.tableIndex
            });
        } catch (error) {
            const errorMessage = `Failed to execute moveColumn command: ${error}`;
            console.error(errorMessage);
            panel.webview.postMessage({
                command: 'error',
                message: errorMessage
            });
        }
    }

    /**
     * Handle switch table request
     */
    private async handleSwitchTable(data: { index: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('[MTE][Ext] Handling switchTable to index:', data.index);
        
        // Send setActiveTable to ensure React side is synchronized
        this.setActiveTable(panel, data.index);
        
        // Also request fresh table data to ensure consistency
        const actualPanelId = this.findPanelId(panel);
        vscode.commands.executeCommand('markdownTableEditor.internal.requestTableData', {
            uri: uri.toString(),
            panelId: actualPanelId,
            forceRefresh: false,
            switchToIndex: data.index // Hint for which table to show
        });
    }

    /**
     * Handle export CSV
     */
    private async handleExportCSV(data: { tableIndex?: number; csvContent?: string; filename?: string; encoding?: string }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Export CSV:', data, 'for file:', uri.toString());

        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.exportCSV', {
            uri: uri.toString(),
            panelId: actualPanelId,
            data: {
                csvContent: data?.csvContent,
                filename: data?.filename,
                encoding: data?.encoding
            },
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Handle theme variables request from webview
     */
    private async handleRequestThemeVariables(panel: vscode.WebviewPanel): Promise<void> {
        try {
            const selectedTheme = vscode.workspace.getConfiguration('markdownTableEditor').get<string>('theme', 'inherit');
            const themeVars = await buildThemeVariablesCss(selectedTheme);
            panel.webview.postMessage({ command: 'applyThemeVariables', data: { cssText: themeVars.cssText } });
        } catch (error) {
            console.warn('Failed to send theme variables to panel:', error);
        }
    }

    /**
     * Dispose all resources
     */
    public dispose(): void {
        console.log('WebviewManager: Disposing resources...');

        // Stop periodic health checks
        this.stopHealthMonitoring();

        // Dispose all panels
        for (const panel of this.panels.values()) {
            try {
                panel.dispose();
            } catch (error) {
                console.error('Error disposing panel:', error);
            }
        }

        // Clear all maps
        this.panels.clear();
        this.connectionHealthMap.clear();

        console.log('WebviewManager: Resources disposed');
    }

    /**
     * Apply current configured theme CSS to a specific panel
     */
    private async applyThemeToPanel(panel: vscode.WebviewPanel): Promise<void> {
        try {
            const selectedTheme = vscode.workspace.getConfiguration('markdownTableEditor').get<string>('theme', 'inherit');
            const themeVars = await buildThemeVariablesCss(selectedTheme);
            panel.webview.postMessage({ command: 'applyThemeVariables', data: { cssText: themeVars.cssText } });
        } catch (error) {
            console.warn('WebviewManager: Failed to apply theme to panel:', error);
        }
    }

    /**
     * Send status update to webview
     */
    public sendStatus(panel: vscode.WebviewPanel, status: string, data?: any): void {
        panel.webview.postMessage({
            command: 'status',
            status: status,
            data: data
        });
    }

    /**
     * Send validation error to webview
     */
    public sendValidationError(panel: vscode.WebviewPanel, field: string, message: string): void {
        panel.webview.postMessage({
            command: 'validationError',
            field: field,
            message: message
        });
    }



    /**
     * Get all active panel URIs
     */
    public getActivePanelUris(): vscode.Uri[] {
        return Array.from(this.panels.keys()).map(panelId => vscode.Uri.parse(panelId));
    }

    /**
     * Check if panel exists for URI
     */
    public hasPanelForUri(uri: vscode.Uri): boolean {
        return this.panels.has(uri.toString());
    }

    /**
     * Get panel count
     */
    public getPanelCount(): number {
        return this.panels.size;
    }

    /**
     * Start monitoring webview health
     */
    private startHealthMonitoring(): void {
        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, 30000); // Check every 30 seconds
    }

    /**
     * Stop health monitoring
     */
    private stopHealthMonitoring(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
    }

    /**
     * Perform health check on all active panels
     */
    private performHealthCheck(): void {
        const now = Date.now();
        const healthTimeout = 60000; // 1 minute

        for (const [panelId, panel] of this.panels.entries()) {
            const health = this.connectionHealthMap.get(panelId);

            if (!health || (now - health.lastActivity) > healthTimeout) {
                // Connection may be unhealthy
                this.connectionHealthMap.set(panelId, {
                    lastActivity: health?.lastActivity || now,
                    isHealthy: false
                });

                // Try to ping the webview
                this.pingWebview(panel, panelId);
            }
        }
    }

    /**
     * Ping webview to check if it's responsive
     */
    private pingWebview(panel: vscode.WebviewPanel, panelId: string): void {
        try {
            panel.webview.postMessage({
                command: 'ping',
                timestamp: Date.now()
            });
        } catch (error) {
            console.error(`Failed to ping webview ${panelId}:`, error);
            this.markConnectionUnhealthy(panelId);
        }
    }

    /**
     * Mark connection as healthy
     */
    private markConnectionHealthy(panelId: string): void {
        this.connectionHealthMap.set(panelId, {
            lastActivity: Date.now(),
            isHealthy: true
        });
    }

    /**
     * Mark connection as unhealthy
     */
    private markConnectionUnhealthy(panelId: string): void {
        const health = this.connectionHealthMap.get(panelId);
        this.connectionHealthMap.set(panelId, {
            lastActivity: health?.lastActivity || Date.now(),
            isHealthy: false
        });
    }

    /**
     * Send message with retry logic
     */
    public sendMessageWithRetry(panel: vscode.WebviewPanel, message: any, maxRetries: number = 3): Promise<void> {
        return new Promise((resolve, reject) => {
            let retries = 0;

            const attemptSend = () => {
                try {
                    panel.webview.postMessage(message);
                    resolve();
                } catch (error) {
                    retries++;
                    if (retries < maxRetries) {
                        console.warn(`Failed to send message, retrying (${retries}/${maxRetries}):`, error);
                        setTimeout(attemptSend, 1000 * retries); // Exponential backoff
                    } else {
                        console.error(`Failed to send message after ${maxRetries} retries:`, error);
                        reject(error);
                    }
                }
            };

            attemptSend();
        });
    }

    /**
     * Enhanced update table data with retry logic
     */
    public async updateTableDataWithRetry(panel: vscode.WebviewPanel, tableData: TableData): Promise<void> {
        return this.sendMessageWithRetry(panel, {
            command: 'updateTableData',
            data: tableData
        });
    }

}
