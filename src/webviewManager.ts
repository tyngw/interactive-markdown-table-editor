import * as vscode from 'vscode';
import * as path from 'path';
import { TableData } from './tableDataManager';
import * as fs from 'fs';
import { buildThemeVariablesCss } from './themeUtils';

export interface WebviewMessage {
    command: 'requestTableData' | 'updateCell' | 'updateHeader' | 'addRow' | 'deleteRows' | 'addColumn' | 'deleteColumns' | 'sort' | 'moveRow' | 'moveColumn' | 'exportCSV' | 'pong' | 'switchTable' | 'requestThemeVariables';
    data?: any;
    timestamp?: number;
    responseTime?: number;
}

export class WebviewManager {
    private static instance: WebviewManager;
    private panels: Map<string, vscode.WebviewPanel> = new Map();
    private context: vscode.ExtensionContext;
    private connectionHealthMap: Map<string, { lastActivity: number; isHealthy: boolean }> = new Map();
    private healthCheckInterval: NodeJS.Timeout | null = null;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.startHealthMonitoring();
    }

    public static getInstance(context?: vscode.ExtensionContext): WebviewManager {
        if (!WebviewManager.instance && context) {
            WebviewManager.instance = new WebviewManager(context);
        }
        return WebviewManager.instance;
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
    public createTableEditorPanel(tableData: TableData | TableData[], uri: vscode.Uri): vscode.WebviewPanel {
        return this._createTableEditorPanel(tableData, uri, false);
    }

    /**
     * Create a new table editor panel, always in a new panel
     * Returns both the panel and the unique panel ID used internally
     */
    public createTableEditorPanelNewPanel(tableData: TableData | TableData[], uri: vscode.Uri): { panel: vscode.WebviewPanel; panelId: string } {
        const result = this._createTableEditorPanel(tableData, uri, true);
        // Find the panel ID that was actually used
        const panelId = Array.from(this.panels.entries()).find(([_, p]) => p === result)?.[0] || uri.toString();
        return { panel: result, panelId };
    }

    /**
     * Internal method to create table editor panel with option to force new panel
     */
    private _createTableEditorPanel(tableData: TableData | TableData[], uri: vscode.Uri, forceNewPanel: boolean): vscode.WebviewPanel {
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

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'markdownTableEditor',
            panelTitle,
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'webview')
                ]
            }
        );

        // Set the icon for the webview panel tab
        panel.iconPath = vscode.Uri.joinPath(this.context.extensionUri, 'icon.png');

        console.log('Webview panel created, setting HTML content...');

        // Generate vscode-resource URIs for CSS and JavaScript files
        const cssPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'style.css');
        const cssUri = panel.webview.asWebviewUri(cssPath);

        // Generate script URIs for modular JavaScript files
        const scriptFiles = [
            // Core system must be loaded first
            'js/core.js',

            // Core modules (order matters for dependencies)
            'js/error-handler.js',
            'js/vscode-communication.js',
            'js/ui-renderer.js',
            'js/table-manager.js',

            // Feature modules
            'js/table-renderer.js',
            'js/selection.js',
            'js/cell-editor.js',
            'js/sorting.js',
            'js/keyboard-navigation.js',
            'js/clipboard.js',
            'js/column-resize.js',
            'js/context-menu.js',
            'js/drag-drop.js',
            'js/status-bar.js',
            'js/csv-exporter.js',
            'js/test-module.js'
        ];

        const scriptUris = scriptFiles.map(file => {
            const scriptPath = vscode.Uri.joinPath(this.context.extensionUri, 'webview', file);
            return panel.webview.asWebviewUri(scriptPath);
        });

        // Get HTML content and inject URIs
        let html = this.getWebviewContent();

        // Inject CSS URI and script URIs into HTML
        const themeCssText = this.buildInitialThemeCssSync();
        const injectionScript = `
<script>
window.cssUri = '${cssUri}';
window.scriptUris = ${JSON.stringify(scriptUris.map(uri => uri.toString()))};
</script>`;

        const themeStyleTag = themeCssText ? `<style id="mte-theme-override">${themeCssText}</style>` : '';
        html = html.replace(/<head>/i, `<head>${injectionScript}${themeStyleTag}`);
        panel.webview.html = html;

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
                console.log('Panel became active, refreshing data for:', panelId);
                // Request fresh data when panel becomes active
                this.refreshPanelData(panel, uri);
                // Ensure theme is applied when panel becomes active
                this.applyThemeToPanel(panel);
            }
        }, null, this.context.subscriptions);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            (message: WebviewMessage) => this.handleMessage(message, panel, uri),
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

        panel.webview.postMessage(message);
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
        console.log('Refreshing panel data for:', uri.toString());

        const actualPanelId = this.findPanelId(panel);
        console.log('Using panel ID for refresh:', actualPanelId);

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
    private async handleMessage(message: WebviewMessage, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        try {
            // Mark connection as healthy when we receive a message
            const panelId = this.findPanelId(panel);
            this.markConnectionHealthy(panelId);

            // Basic message structure validation
            if (!this.validateBasicMessageStructure(message)) {
                this.sendError(panel, 'Invalid message format received from webview');
                return;
            }

            console.log(`Handling webview message: ${message.command}`, message.data);

            // Validate specific message content based on command
            if (!this.validateMessageCommand(message)) {
                this.sendError(panel, `Unknown command: ${message.command}`);
                return;
            }

            if (!this.validateMessageData(message)) {
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
                    console.log('Table switch notification:', message.data);
                    // This is just a notification, no action needed
                    break;

                case 'requestThemeVariables':
                    await this.handleRequestThemeVariables(panel);
                    break;

                default:
                    console.warn('Unknown message command:', message.command);
                    this.sendError(panel, `Unknown command: ${message.command}`);
            }
        } catch (error) {
            console.error('Error handling webview message:', error);
            this.sendError(panel, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Validate incoming message structure
     */
    public validateMessage(message: any): message is WebviewMessage {
        return this.validateBasicMessageStructure(message) &&
            this.validateMessageCommand(message) &&
            this.validateMessageData(message);
    }

    /**
     * Validate basic message structure (object with command)
     */
    public validateBasicMessageStructure(message: any): boolean {
        if (!message || typeof message !== 'object') {
            return false;
        }

        if (!message.command || typeof message.command !== 'string') {
            return false;
        }

        return true;
    }

    /**
     * Validate if the command is known
     */
    public validateMessageCommand(message: any): boolean {
        const validCommands = [
            'requestTableData', 'updateCell', 'updateHeader', 'addRow', 'deleteRows',
            'addColumn', 'deleteColumns', 'sort', 'moveRow', 'moveColumn', 'exportCSV', 'pong', 'switchTable', 'requestThemeVariables'
        ];

        return validCommands.includes(message.command);
    }

    /**
     * Validate message data based on command
     */
    public validateMessageData(message: any): boolean {
        // Validate data structure based on command
        switch (message.command) {
            case 'requestTableData':
                return true; // No data required

            case 'updateCell':
                return this.validateCellUpdateData(message.data);

            case 'updateHeader':
                return this.validateHeaderUpdateData(message.data);

            case 'addRow':
                return this.validateAddRowData(message.data);

            case 'deleteRows':
                return this.validateDeleteRowsData(message.data);

            case 'addColumn':
                return this.validateAddColumnData(message.data);

            case 'deleteColumns':
                return this.validateDeleteColumnsData(message.data);

            case 'sort':
                return this.validateSortData(message.data);

            case 'moveRow':
            case 'moveColumn':
                return this.validateMoveData(message.data);

            case 'exportCSV':
                return this.validateExportCSVData(message.data);

            case 'pong':
                return true; // Pong messages don't require data validation

            case 'switchTable':
                return this.validateSwitchTableData(message.data);

            default:
                return false;
        }
    }

    private validateCellUpdateData(data: any): boolean {
        if (!data) return false;
        return typeof data.row === 'number' && data.row >= 0 &&
            typeof data.col === 'number' && data.col >= 0 &&
            typeof data.value === 'string' &&
            (data.tableIndex === undefined || (typeof data.tableIndex === 'number' && data.tableIndex >= 0));
    }

    private validateHeaderUpdateData(data: any): boolean {
        if (!data) return false;
        return typeof data.col === 'number' && data.col >= 0 &&
            typeof data.value === 'string' &&
            (data.tableIndex === undefined || (typeof data.tableIndex === 'number' && data.tableIndex >= 0));
    }

    private validateAddRowData(data: any): boolean {
        return !data || (data &&
            (data.index === undefined || (typeof data.index === 'number' && data.index >= 0)) &&
            (data.tableIndex === undefined || (typeof data.tableIndex === 'number' && data.tableIndex >= 0)));
    }

    private validateDeleteRowsData(data: any): boolean {
        if (!data) return false;
        return Array.isArray(data.indices) && data.indices.length > 0 &&
            data.indices.every((index: any) => typeof index === 'number' && index >= 0) &&
            (data.tableIndex === undefined || (typeof data.tableIndex === 'number' && data.tableIndex >= 0));
    }

    private validateAddColumnData(data: any): boolean {
        return !data || (data &&
            (data.index === undefined || (typeof data.index === 'number' && data.index >= 0)) &&
            (data.header === undefined || typeof data.header === 'string') &&
            (data.tableIndex === undefined || (typeof data.tableIndex === 'number' && data.tableIndex >= 0)));
    }

    private validateDeleteColumnsData(data: any): boolean {
        if (!data) return false;
        return Array.isArray(data.indices) && data.indices.length > 0 &&
            data.indices.every((index: any) => typeof index === 'number' && index >= 0) &&
            (data.tableIndex === undefined || (typeof data.tableIndex === 'number' && data.tableIndex >= 0));
    }

    private validateSortData(data: any): boolean {
        if (!data) return false;
        return typeof data.column === 'number' && data.column >= 0 &&
            typeof data.direction === 'string' &&
            (data.direction === 'asc' || data.direction === 'desc') &&
            (data.tableIndex === undefined || (typeof data.tableIndex === 'number' && data.tableIndex >= 0));
    }

    private validateMoveData(data: any): boolean {
        if (!data) return false;
        return typeof data.from === 'number' && data.from >= 0 &&
            typeof data.to === 'number' && data.to >= 0 &&
            (data.tableIndex === undefined || (typeof data.tableIndex === 'number' && data.tableIndex >= 0));
    }

    private validateExportCSVData(data: any): boolean {
        if (!data) return false;
        
        // csvContent is required and must be a non-empty string
        if (typeof data.csvContent !== 'string' || data.csvContent.length === 0) {
            return false;
        }
        
        // filename is optional (can be auto-generated), but if provided must be a string
        if (data.filename !== undefined && (typeof data.filename !== 'string' || data.filename.length === 0)) {
            return false;
        }
        
        // encoding is optional (defaults to utf8), but if provided must be a string
        if (data.encoding !== undefined && typeof data.encoding !== 'string') {
            return false;
        }
        
        return true;
    }

    private validateSwitchTableData(data: any): boolean {
        if (!data) return false;
        return typeof data.index === 'number' && data.index >= 0;
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
     * Handle cell update
     */
    private async handleCellUpdate(data: { row: number; col: number; value: string; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Cell update:', data, 'for file:', uri.toString());
        console.log('Cell update tableIndex:', data.tableIndex);

        const actualPanelId = this.findPanelId(panel);

        const commandData = {
            uri: uri.toString(), // Convert URI to string
            panelId: actualPanelId,
            row: data.row,
            col: data.col,
            value: data.value,
            tableIndex: data.tableIndex
        };

        console.log('Sending command data:', commandData);

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

        const commandData = {
            uri: uri.toString(), // Convert URI to string
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

        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.sort', {
            uri: uri.toString(),
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

        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.moveRow', {
            uri: uri.toString(),
            panelId: actualPanelId,
            fromIndex: data.fromIndex,
            toIndex: data.toIndex,
            tableIndex: data?.tableIndex
        });
    }

    /**
     * Handle move column
     */
    private async handleMoveColumn(data: { fromIndex: number; toIndex: number; tableIndex?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Move column:', data, 'for file:', uri.toString());

        const actualPanelId = this.findPanelId(panel);

        vscode.commands.executeCommand('markdownTableEditor.internal.moveColumn', {
            uri: uri.toString(),
            panelId: actualPanelId,
            fromIndex: data.fromIndex,
            toIndex: data.toIndex,
            tableIndex: data?.tableIndex
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
        
        // Stop health monitoring
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }

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


}