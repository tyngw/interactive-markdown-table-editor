import * as vscode from 'vscode';
import * as path from 'path';
import { TableData } from './tableDataManager';
import * as fs from 'fs';
import { buildThemeVariablesCss } from './themeUtils';
import { UndoRedoManager } from './undoRedoManager';
import { WebviewMessage } from './messages/types';
export type { WebviewMessage } from './messages/types';
import { validateBasicMessageStructure, validateMessageCommand, validateMessageData } from './messages/validators';
import { ExtensionCommunicationManager } from './communication/ExtensionCommunicationManager';
import { WebviewCommand } from './communication/protocol';

    // WebviewMessage 型は messages/types へ分離

export class WebviewManager {
    private static instance: WebviewManager;
    private panels: Map<string, vscode.WebviewPanel> = new Map();
    private communicationManagers: Map<string, ExtensionCommunicationManager> = new Map();
    private context: vscode.ExtensionContext;
    private connectionHealthMap: Map<string, { lastActivity: number; isHealthy: boolean }> = new Map();
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private undoRedoManager: UndoRedoManager;
    private isInitialized: boolean = false;
    private initializationPromise: Promise<void> | null = null;
    // Legacy webview modular scripts (for tests and backward compatibility)
    private readonly legacyScriptFiles: string[] = [
        'js/core.js',
        'js/test-module.js'
    ];

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
        try {
            console.log('WebviewManager: Starting async initialization...');
            
            // Check if webview build directory exists and is accessible
            const reactBuildPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview-dist');
            try {
                await vscode.workspace.fs.stat(reactBuildPath);
                console.log('WebviewManager: React build directory verified');
            } catch (error) {
                console.warn('WebviewManager: React build directory not found, this may cause issues:', error);
            }
            
            // Verify key build files exist
            const indexHtmlPath = vscode.Uri.joinPath(reactBuildPath, 'index.html');
            try {
                await vscode.workspace.fs.stat(indexHtmlPath);
                console.log('WebviewManager: React build index.html verified');
            } catch (error) {
                console.warn('WebviewManager: React build index.html not found:', error);
            }
            
            this.isInitialized = true;
            console.log('WebviewManager: Async initialization completed');
        } catch (error) {
            console.error('WebviewManager: Async initialization failed:', error);
            // Don't throw - allow the manager to still function with reduced capabilities
        }
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
     * Get the number of active communication managers (for debugging)
     */
    public get communicationManagerCount(): number {
        return this.communicationManagers.size;
    }

    /**
     * Get all communication managers (internal use only)
     */
    private getCommunicationManagers(): Map<string, ExtensionCommunicationManager> {
        return this.communicationManagers;
    }

    /**
     * Broadcast message to all panels
     */
    public broadcastMessage(command: string, data?: any): void {
        const message = { command, data };
        if (this.panels.size === 0) {
            console.warn(`[WebviewManager] broadcastMessage("${command}"): No active panels to broadcast to`);
            return;
        }
        for (const panel of this.panels.values()) {
            try {
                panel.webview.postMessage(message);
            } catch (err) {
                console.error(`[WebviewManager] Failed to post message "${command}" to panel:`, err);
            }
        }
    }

    /**
     * Broadcast notification message to all panels using the new protocol
     * This ensures theme variables are applied immediately to all open panels
     */
    public broadcastNotification(command: string, data?: any): void {
        const managers = this.getCommunicationManagers();
        if (managers.size === 0) {
            console.warn(`[WebviewManager] broadcastNotification("${command}"): No active communication managers`);
            return;
        }
        for (const commManager of managers.values()) {
            try {
                commManager.sendNotification(command as any, data);
            } catch (err) {
                console.error(`[WebviewManager] Failed to send notification "${command}":`, err);
            }
        }
    }

    /**
     * Backward-compatible message validator for tests
     */
    public validateMessage(message: any): boolean {
        if (!validateBasicMessageStructure(message)) {return false;}
        if (!validateMessageCommand(message)) {return false;}
        if (!validateMessageData(message)) {return false;}
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

        // If panel already exists for the same file and not forcing new panel, reveal it
        if (!forceNewPanel && this.panels.has(panelId)) {
            const existingPanel = this.panels.get(panelId)!;
            existingPanel.reveal();
            this.updateTableData(existingPanel, tableData, uri);
            return existingPanel;
        }

        // If any table editor panel is already open and not forcing new panel, reuse it for the new file
        if (!forceNewPanel && this.panels.size > 0) {
            const existingPanelEntry = Array.from(this.panels.entries())[0];
            const [oldPanelId, existingPanel] = existingPanelEntry;
            
            // Remove old panel reference and add new one
            this.panels.delete(oldPanelId);
            this.panels.set(panelId, existingPanel);
            
            // Update connection health mapping
            const oldHealth = this.connectionHealthMap.get(oldPanelId);
            if (oldHealth) {
                this.connectionHealthMap.delete(oldPanelId);
                this.connectionHealthMap.set(panelId, oldHealth);
            }
            
            // Re-setup communication handlers with new URI
            const oldCommManager = this.communicationManagers.get(oldPanelId);
            if (oldCommManager) {
                // Dispose old handlers and create new ones
                oldCommManager.dispose();
                this.communicationManagers.delete(oldPanelId);
            }
            
            // Create new communication manager with new URI
            const newCommManager = new ExtensionCommunicationManager(existingPanel);
            this.communicationManagers.set(panelId, newCommManager);
            this.setupCommunicationHandlers(newCommManager, existingPanel, uri);
            
            // Update panel title
            existingPanel.title = `${path.basename(uri.fsPath)} - Table Editor`;
            
            // Reveal and update with new data
            existingPanel.reveal();
            this.updateTableData(existingPanel, tableData, uri);
            return existingPanel;
        }

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

        // Use React build for webview with enhanced error handling and retry logic
        const reactBuildPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview-dist');
        
        // Enhanced build path validation
        let html: string = '';
        let buildReady = false;
        const maxRetries = 3;
        const retryDelay = 100; // 100ms
        
        for (let attempt = 1; attempt <= maxRetries && !buildReady; attempt++) {
            try {
                // Check if React build directory exists first
                try {
                    await vscode.workspace.fs.stat(reactBuildPath);
                } catch (dirError) {
                    console.error('React build directory not found:', reactBuildPath.toString());
                    throw new Error(`React build directory not accessible: ${dirError}`);
                }

                // Check if index.html exists
                const indexHtmlPath = vscode.Uri.joinPath(reactBuildPath, 'index.html');
                try {
                    await vscode.workspace.fs.stat(indexHtmlPath);
                } catch (htmlError) {
                    console.error('React build index.html not found:', indexHtmlPath.toString());
                    throw new Error(`React build index.html not accessible: ${htmlError}`);
                }
                
                // Try to read React build HTML
                const htmlBuffer = await vscode.workspace.fs.readFile(indexHtmlPath);
                html = Buffer.from(htmlBuffer).toString('utf8');

                if (!html || html.trim().length === 0) {
                    throw new Error('React build HTML is empty');
                }

                // Add language information
                const vscodeLanguage = vscode.env.language;
                const displayLanguage = vscodeLanguage.toLowerCase().split('-')[0];

                // Add language attributes to html tag
                html = html.replace(/<html([^>]*)>/i, `<html lang="${displayLanguage}" data-vscode-language="${vscodeLanguage}"$1>`);

                buildReady = true;

            } catch (buildError) {
                if (attempt < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                } else {
                    console.error('All build loading attempts failed');
                    throw new Error(`React webview build not accessible after ${maxRetries} attempts: ${buildError}`);
                }
            }
        }
        
        if (!buildReady || !html) {
            throw new Error('Failed to load React build after all retry attempts');
        }
        
        try {
            // Convert relative paths to webview URIs with safe URI handling
            const assetsPath = vscode.Uri.joinPath(reactBuildPath, 'assets');
            let assetsUri: vscode.Uri;
            let assetsUriString: string;
            
            try {
                assetsUri = panel.webview.asWebviewUri(assetsPath);
                assetsUriString = this.getSafeUriString(assetsUri);
                
                // Fallback if getSafeUriString returns empty
                if (!assetsUriString) {
                    assetsUriString = assetsUri.toString();
                }
            } catch (uriError) {
                console.error('Failed to convert assets path to webview URI:', uriError);
                console.error('Assets path:', assetsPath.toString());
                
                // Fallback: try to encode the path safely
                try {
                    assetsUri = panel.webview.asWebviewUri(vscode.Uri.file(assetsPath.fsPath));
                    assetsUriString = assetsUri.toString();
                } catch (fallbackError) {
                    console.error('Fallback URI creation also failed:', fallbackError);
                    throw new Error(`Failed to create safe webview URI for assets: ${fallbackError}`);
                }
            }

            // Replace asset paths with webview URIs (be careful not to double-replace)
            const originalHtml = html;
            // First replace relative paths
            html = html.replace(/src="\.\/assets\//g, `src="${assetsUriString}/`);
            html = html.replace(/href="\.\/assets\//g, `href="${assetsUriString}/`);
            // Then replace any remaining absolute paths that weren't already replaced
            html = html.replace(/src="\/assets\//g, `src="${assetsUriString}/`);
            html = html.replace(/href="\/assets\//g, `href="${assetsUriString}/`);

            // Update CSP to allow React and webview resources
            // Note: Do NOT add "https://file+.vscode-resource.vscode-cdn.net". The '+' is encoded in actual host (file%2B...),
            // and hardcoding it causes CSP warnings. Use only panel.webview.cspSource as recommended by VS Code docs.
            const cspContent = `default-src 'none'; style-src 'unsafe-inline' ${panel.webview.cspSource}; script-src 'unsafe-inline' 'unsafe-eval' ${panel.webview.cspSource}; img-src ${panel.webview.cspSource} https: data:; font-src ${panel.webview.cspSource} https:`;

            // 既存の全てのCSPメタタグを削除（バリエーションを広くカバー）
            const cspMetaPattern = /<meta\s+[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi;
            html = html.replace(cspMetaPattern, '');

            // <head>タグ直後にCSPメタタグを挿入（viewport 有無によらず確実に先頭近くに配置）
            html = html.replace(
                /(<head[^>]*>)/i,
                `$1\n    <meta http-equiv="Content-Security-Policy" content="${cspContent}">`
            );
        } catch (error) {
            console.error('Failed to load React build:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`React webview build not found: ${errorMessage}`);
        }

        panel.webview.html = html;

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

                    // Dispose communication manager
                    const commMgr = this.communicationManagers.get(key);
                    if (commMgr) {
                        commMgr.dispose();
                        this.communicationManagers.delete(key);
                        console.log('[MTE][Ext] Communication manager disposed for panel:', key);
                    }

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
                    this.applyFontSettingsToPanel(e.webviewPanel);
                }
            } else {
                const currentPanelId = this.findPanelId(e.webviewPanel);
                console.log('[MTE][Ext] Panel state changed (inactive or hidden):', { active: e.webviewPanel.active, visible: e.webviewPanel.visible, panelId: currentPanelId });
            }
        }, null, this.context.subscriptions);

        // Initialize new communication manager for this panel
        const commManager = new ExtensionCommunicationManager(panel);
        this.communicationManagers.set(panelId, commManager);
        this.setupCommunicationHandlers(commManager, panel, uri);

        // Apply theme and font settings on initial load
        await this.applyThemeToPanel(panel);
        await this.applyFontSettingsToPanel(panel);

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

        // Include Git theme colors for diff visualization
        try {
            const { getGitThemeColors } = require('./gitDiffUtils');
            const gitColors = getGitThemeColors();
            message.gitThemeColors = gitColors;
        } catch (error) {
            console.warn('[WebviewManager] Failed to get Git theme colors:', error);
        }

        try {
            const tables = Array.isArray(tableData) ? tableData.length : 1;
            console.log('[MTE][Ext] Sending updateTableData', { tables, hasUri: !!uri, panelActive: panel.active, panelVisible: panel.visible });
        } catch {}

        // Send via new communication manager
        const panelId = this.findPanelId(panel);
        const commManager = this.communicationManagers.get(panelId);
        if (commManager) {
            try {
                commManager.updateTableData(message);
                console.log('[MTE][Ext] updateTableData sent via communication manager in', Date.now() - start, 'ms');
            } catch (error) {
                console.error('[MTE][Ext] Failed to send via communication manager:', error);
            }
        } else {
            console.warn('[MTE][Ext] Communication manager not found for panel:', panelId);
        }
    }

    /**
     * Update Git diff data in the webview
     */
    public updateGitDiff(panel: vscode.WebviewPanel, diffData: any): void {
        const panelId = this.findPanelId(panel);
        const commManager = this.communicationManagers.get(panelId);
        if (commManager) {
            commManager.updateGitDiff(diffData);
        } else {
            console.warn('[MTE][Ext] Communication manager not found for updateGitDiff');
        }
    }

    /**
     * Set active table index in webview
     */
    public setActiveTable(panel: vscode.WebviewPanel, index: number): void {
        const panelId = this.findPanelId(panel);
        const commManager = this.communicationManagers.get(panelId);
        if (commManager) {
            commManager.setActiveTable(index);
        } else {
            console.warn('[MTE][Ext] Communication manager not found for setActiveTable');
        }
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
        const panelId = this.findPanelId(panel);
        const commManager = this.communicationManagers.get(panelId);
        if (commManager) {
            commManager.sendOperationError(message);
        } else {
            console.warn('[MTE][Ext] Communication manager not found for sendError');
        }
    }

    /**
     * Send operation success notification to webview
     */
    public sendOperationSuccess(panel: vscode.WebviewPanel, message: string, data?: any): void {
        const panelId = this.findPanelId(panel);
        const commManager = this.communicationManagers.get(panelId);
        if (commManager) {
            commManager.sendOperationSuccess(message, data);
        } else {
            console.warn('[MTE][Ext] Communication manager not found for sendOperationSuccess');
        }
    }

    /**
     * Send cell update error to webview for potential rollback
     */
    public sendCellUpdateError(panel: vscode.WebviewPanel, errorInfo: { row: number; col: number; error: string }): void {
        const panelId = this.findPanelId(panel);
        const commManager = this.communicationManagers.get(panelId);
        if (commManager) {
            commManager.sendCellUpdateError(errorInfo.row, errorInfo.col, errorInfo.error);
        } else {
            console.warn('[MTE][Ext] Communication manager not found for sendCellUpdateError');
        }
    }

    public sendHeaderUpdateError(panel: vscode.WebviewPanel, errorInfo: { col: number; error: string }): void {
        const panelId = this.findPanelId(panel);
        const commManager = this.communicationManagers.get(panelId);
        if (commManager) {
            commManager.sendHeaderUpdateError(errorInfo.col, errorInfo.error);
        } else {
            console.warn('[MTE][Ext] Communication manager not found for sendHeaderUpdateError');
        }
    }



    /**
     * Handle request for table data
     */
    private async handleRequestTableData(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
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
        // Save state before making changes for undo functionality
        await this.undoRedoManager.saveState(uri, 'Bulk cell update');

        const actualPanelId = this.findPanelId(panel);

        const commandData = {
            uri: uri.toString(),
            panelId: actualPanelId,
            updates: data.updates,
            tableIndex: data.tableIndex
        };

        // Emit custom event that can be handled by the extension
        vscode.commands.executeCommand('markdownTableEditor.internal.bulkUpdateCells', commandData);
    }

    /**
     * Handle cell update
     */
    private async handleCellUpdate(data: { row: number; col: number; value: string; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
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

        // Emit custom event that can be handled by the extension
        vscode.commands.executeCommand('markdownTableEditor.internal.updateCell', commandData);
    }

    /**
     * Handle header update
     */
    private async handleHeaderUpdate(data: { col: number; value: string; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
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

        // Emit custom event that can be handled by the extension
        vscode.commands.executeCommand('markdownTableEditor.internal.updateHeader', commandData);
    }

    /**
     * Handle add row
     */
    private async handleAddRow(data: { index?: number; count?: number; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.addRow', {
            uri: uri.toString(),
            panelId: actualPanelId,
            index: data?.index,
            count: data?.count,
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Handle delete multiple rows
     */
    private async handleDeleteRows(data: { indices: number[]; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
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
    private async handleAddColumn(data: { index?: number; count?: number; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.addColumn', {
            uri: uri.toString(),
            panelId: actualPanelId,
            index: data?.index,
            count: data?.count,
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Handle delete multiple columns
     */
    private async handleDeleteColumns(data: { indices: number[]; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
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
     * Handle import CSV
     */
    private async handleImportCSV(data: { tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.importCSV', {
            uri: uri.toString(),
            panelId: actualPanelId,
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Build initial theme CSS synchronously for faster panel startup
     */
    private buildInitialThemeCssSync(): string {
        // Simplified synchronous theme building for faster startup
        return `
            :root {
                --primary-color: var(--vscode-button-background, #007acc);
                --primary-hover: var(--vscode-button-hoverBackground, #005a9e);
                --secondary-color: var(--vscode-button-secondaryBackground, #5f6a79);
                --border-color: var(--vscode-panel-border, #454545);
                --text-color: var(--vscode-foreground, #cccccc);
                --background-color: var(--vscode-editor-background, #1e1e1e);
                --selected-background: var(--vscode-list-activeSelectionBackground, #094771);
                --hover-background: var(--vscode-list-hoverBackground, #2a2d2e);
                --input-background: var(--vscode-input-background, #3c3c3c);
                --input-border: var(--vscode-input-border, #464647);
            }
        `;
    }

    /**
     * Handle theme variables request from webview
     */
    private async handleRequestThemeVariables(panel: vscode.WebviewPanel): Promise<void> {
        await this.applyThemeToPanel(panel);
    }

    /**
     * Dispose all resources
     */
    public dispose(): void {
        console.log('WebviewManager: Disposing resources...');

        // Stop health monitoring
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

        // Dispose all communication managers
        for (const [panelId, commManager] of this.communicationManagers.entries()) {
            try {
                commManager.dispose();
                console.log('[MTE][Ext] Communication manager disposed for panel:', panelId);
            } catch (error) {
                console.error('Error disposing communication manager:', error);
            }
        }
        this.communicationManagers.clear();

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
            const panelId = this.findPanelId(panel);
            const commManager = this.communicationManagers.get(panelId);
            if (commManager) {
                commManager.applyThemeVariables(themeVars.cssText);
            } else {
                console.warn('[MTE][Ext] Communication manager not found for applyThemeToPanel');
            }
        } catch (error) {
            console.warn('WebviewManager: Failed to apply theme to panel:', error);
        }
    }

    /**
     * Apply current configured font settings to a specific panel
     */
    private async applyFontSettingsToPanel(panel: vscode.WebviewPanel): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('markdownTableEditor');
            const fontFamily = config.get<string>('fontFamily', '');
            const fontSize = config.get<number>('fontSize', 0);
            const panelId = this.findPanelId(panel);
            const commManager = this.communicationManagers.get(panelId);
            if (commManager) {
                commManager.applyFontSettings(fontFamily, fontSize);
            } else {
                console.warn('[MTE][Ext] Communication manager not found for applyFontSettingsToPanel');
            }
        } catch (error) {
            console.warn('WebviewManager: Failed to apply font settings to panel:', error);
        }
    }

    /**
     * Get the webview HTML content
     */
    private getWebviewContent(): string {
        // Read the HTML file content
        const htmlPath = path.join(this.context.extensionPath, 'webview', 'tableEditor.html');

        console.log('Reading HTML from path:', htmlPath);

        try {
            const fs = require('fs');
            const content = fs.readFileSync(htmlPath, 'utf8');
            console.log('Successfully read HTML file, length:', content.length);
            return content;
        } catch (error) {
            console.error('Error reading webview HTML file:', error);
            console.log('Using fallback HTML');
            return this.getFallbackHtml();
        }
    }

    /**
     * Get fallback HTML content if file reading fails
     */
    private getFallbackHtml(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Markdown Table Editor</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        color: var(--vscode-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 20px;
                        text-align: center;
                    }
                    .error {
                        color: var(--vscode-errorForeground);
                        background-color: var(--vscode-inputValidation-errorBackground);
                        border: 1px solid var(--vscode-inputValidation-errorBorder);
                        padding: 20px;
                        border-radius: 4px;
                        margin: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="error">
                    <h2>Error Loading Table Editor</h2>
                    <p>Could not load the table editor interface. Please check the extension installation.</p>
                </div>
            </body>
            </html>
        `;
    }



    /**
     * Close panel by URI
     */
    public closePanel(uri: vscode.Uri): void {
        const panel = this.panels.get(uri.toString());
        if (panel) {
            panel.dispose();
        }
    }

    /**
     * Close all panels
     */
    public closeAllPanels(): void {
        for (const panel of this.panels.values()) {
            panel.dispose();
        }
        this.panels.clear();
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

    /**
     * Apply table state without window switching by directly invoking file update
     */
    private async applyTableState(markdownContent: string, tableIndex: number, uri: vscode.Uri, panel: vscode.WebviewPanel): Promise<void> {
        try {
            // Execute the internal file update command directly
            vscode.commands.executeCommand('markdownTableEditor.internal.directFileUpdate', {
                uri: uri.toString(),
                panelId: this.findPanelId(panel),
                markdownContent,
                tableIndex
            });
            
            // Refresh panel data to reflect the changes
            this.refreshPanelData(panel, uri);
            
        } catch (error) {
            console.error('[MTE][Ext] Failed to apply table state:', error);
            throw error;
        }
    }

    /**
     * Setup communication handlers for a panel
     */
    private setupCommunicationHandlers(
        commManager: ExtensionCommunicationManager,
        panel: vscode.WebviewPanel,
        uri: vscode.Uri
    ): void {
        // Register handlers for all webview commands
        commManager.registerHandler(WebviewCommand.REQUEST_TABLE_DATA, async (data) => {
            console.log('[MTE][Ext] Handler: REQUEST_TABLE_DATA');
            await this.handleRequestTableData(panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.UPDATE_CELL, async (data) => {
            console.log('[MTE][Ext] Handler: UPDATE_CELL', data);
            await this.handleCellUpdate(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.BULK_UPDATE_CELLS, async (data) => {
            console.log('[MTE][Ext] Handler: BULK_UPDATE_CELLS', data);
            await this.handleBulkUpdateCells(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.UPDATE_HEADER, async (data) => {
            console.log('[MTE][Ext] Handler: UPDATE_HEADER', data);
            await this.handleHeaderUpdate(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.ADD_ROW, async (data) => {
            console.log('[MTE][Ext] Handler: ADD_ROW', data);
            await this.handleAddRow(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.DELETE_ROWS, async (data) => {
            console.log('[MTE][Ext] Handler: DELETE_ROWS', data);
            await this.handleDeleteRows(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.ADD_COLUMN, async (data) => {
            console.log('[MTE][Ext] Handler: ADD_COLUMN', data);
            await this.handleAddColumn(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.DELETE_COLUMNS, async (data) => {
            console.log('[MTE][Ext] Handler: DELETE_COLUMNS', data);
            await this.handleDeleteColumns(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.SORT, async (data) => {
            console.log('[MTE][Ext] Handler: SORT', data);
            await this.handleSort(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.MOVE_ROW, async (data) => {
            console.log('[MTE][Ext] Handler: MOVE_ROW', data);
            await this.handleMoveRow(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.MOVE_COLUMN, async (data) => {
            console.log('[MTE][Ext] Handler: MOVE_COLUMN', data);
            await this.handleMoveColumn(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.EXPORT_CSV, async (data) => {
            console.log('[MTE][Ext] Handler: EXPORT_CSV', data);
            await this.handleExportCSV(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.IMPORT_CSV, async (data) => {
            console.log('[MTE][Ext] Handler: IMPORT_CSV', data);
            await this.handleImportCSV(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.SWITCH_TABLE, async (data) => {
            console.log('[MTE][Ext] Handler: SWITCH_TABLE', data);
            await this.handleSwitchTable(data, panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.REQUEST_THEME_VARIABLES, async (data) => {
            console.log('[MTE][Ext] Handler: REQUEST_THEME_VARIABLES');
            await this.handleRequestThemeVariables(panel);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.UNDO, async (data) => {
            console.log('[MTE][Ext] Handler: UNDO');
            await this.handleUndo(panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.REDO, async (data) => {
            console.log('[MTE][Ext] Handler: REDO');
            await this.handleRedo(panel, uri);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.PONG, async (data) => {
            console.log('[MTE][Ext] Handler: PONG');
            const panelId = this.findPanelId(panel);
            this.markConnectionHealthy(panelId);
            return { success: true };
        });

        commManager.registerHandler(WebviewCommand.REQUEST_SYNC, async (data) => {
            console.log('[MTE][Ext] Handler: REQUEST_SYNC');
            // 現在の状態を送信
            this.refreshPanelData(panel, uri);
            return { success: true };
        });

        console.log('[MTE][Ext] All communication handlers registered');
    }

    /**
     * Get communication manager for a panel
     */
    public getCommunicationManager(panelId: string): ExtensionCommunicationManager | null {
        return this.communicationManagers.get(panelId) || null;
    }

    /**
     * Get appropriate ViewColumn for text editor based on webview panel position
     */
    private getAppropriateViewColumn(panel: vscode.WebviewPanel): vscode.ViewColumn {
        // If webview is in column Two, place text editor in column One
        // If webview is in column One, place text editor in column Two
        // Otherwise, use Beside to place it next to the webview
        switch (panel.viewColumn) {
            case vscode.ViewColumn.Two:
                return vscode.ViewColumn.One;
            case vscode.ViewColumn.One:
                return vscode.ViewColumn.Two;
            case vscode.ViewColumn.Three:
                return vscode.ViewColumn.Two;
            default:
                return vscode.ViewColumn.Beside;
        }
    }


}