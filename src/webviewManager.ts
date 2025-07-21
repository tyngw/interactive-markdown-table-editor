import * as vscode from 'vscode';
import * as path from 'path';
import { TableData } from './tableDataManager';

export interface WebviewMessage {
    command: 'requestTableData' | 'updateCell' | 'addRow' | 'deleteRow' | 'addColumn' | 'deleteColumn' | 'sort' | 'moveRow' | 'moveColumn' | 'pong';
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
     * Create a new table editor panel
     */
    public createTableEditorPanel(tableData: TableData, uri: vscode.Uri): vscode.WebviewPanel {
        const panelId = uri.toString();
        
        // If panel already exists, reveal it
        if (this.panels.has(panelId)) {
            const existingPanel = this.panels.get(panelId)!;
            existingPanel.reveal();
            this.updateTableData(existingPanel, tableData);
            return existingPanel;
        }

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            'markdownTableEditor',
            `Table Editor - ${path.basename(uri.fsPath)}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this.context.extensionUri, 'webview')
                ]
            }
        );

        // Set the HTML content
        panel.webview.html = this.getWebviewContent();

        // Store panel reference
        this.panels.set(panelId, panel);

        // Handle panel disposal
        panel.onDidDispose(() => {
            this.panels.delete(panelId);
        }, null, this.context.subscriptions);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            (message: WebviewMessage) => this.handleMessage(message, panel, uri),
            undefined,
            this.context.subscriptions
        );

        // Send initial data after a short delay to ensure webview is ready
        setTimeout(() => {
            this.updateTableData(panel, tableData);
        }, 100);

        return panel;
    }

    /**
     * Update table data in the webview
     */
    public updateTableData(panel: vscode.WebviewPanel, tableData: TableData): void {
        panel.webview.postMessage({
            command: 'updateTableData',
            data: tableData
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
     * Handle messages from webview
     */
    private async handleMessage(message: WebviewMessage, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        try {
            // Mark connection as healthy when we receive a message
            this.markConnectionHealthy(this.getPanelId(uri));

            // Validate message structure
            if (!this.validateMessage(message)) {
                this.sendError(panel, 'Invalid message format received from webview');
                return;
            }

            console.log(`Handling webview message: ${message.command}`, message.data);

            switch (message.command) {
                case 'requestTableData':
                    await this.handleRequestTableData(panel, uri);
                    break;

                case 'updateCell':
                    await this.handleCellUpdate(message.data, panel, uri);
                    break;

                case 'addRow':
                    await this.handleAddRow(message.data, panel, uri);
                    break;

                case 'deleteRow':
                    await this.handleDeleteRow(message.data, panel, uri);
                    break;

                case 'addColumn':
                    await this.handleAddColumn(message.data, panel, uri);
                    break;

                case 'deleteColumn':
                    await this.handleDeleteColumn(message.data, panel, uri);
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

                case 'pong':
                    // Handle pong response from webview
                    console.log(`Received pong from webview, response time: ${message.responseTime ? message.responseTime - (message.timestamp || 0) : 'unknown'}ms`);
                    this.markConnectionHealthy(this.getPanelId(uri));
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
    private validateMessage(message: any): message is WebviewMessage {
        if (!message || typeof message !== 'object') {
            return false;
        }

        if (!message.command || typeof message.command !== 'string') {
            return false;
        }

        const validCommands = [
            'requestTableData', 'updateCell', 'addRow', 'deleteRow', 
            'addColumn', 'deleteColumn', 'sort', 'moveRow', 'moveColumn', 'pong'
        ];

        if (!validCommands.includes(message.command)) {
            return false;
        }

        // Validate data structure based on command
        switch (message.command) {
            case 'requestTableData':
                return true; // No data required

            case 'updateCell':
                return this.validateCellUpdateData(message.data);

            case 'addRow':
                return this.validateAddRowData(message.data);

            case 'deleteRow':
                return this.validateDeleteRowData(message.data);

            case 'addColumn':
                return this.validateAddColumnData(message.data);

            case 'deleteColumn':
                return this.validateDeleteColumnData(message.data);

            case 'sort':
                return this.validateSortData(message.data);

            case 'moveRow':
            case 'moveColumn':
                return this.validateMoveData(message.data);

            case 'pong':
                return true; // Pong messages don't require data validation

            default:
                return false;
        }
    }

    private validateCellUpdateData(data: any): boolean {
        return data && 
               typeof data.row === 'number' && data.row >= 0 &&
               typeof data.col === 'number' && data.col >= 0 &&
               typeof data.value === 'string';
    }

    private validateAddRowData(data: any): boolean {
        return !data || (data && (data.index === undefined || (typeof data.index === 'number' && data.index >= 0)));
    }

    private validateDeleteRowData(data: any): boolean {
        return data && typeof data.index === 'number' && data.index >= 0;
    }

    private validateAddColumnData(data: any): boolean {
        return !data || (data && 
               (data.index === undefined || (typeof data.index === 'number' && data.index >= 0)) &&
               (data.header === undefined || typeof data.header === 'string'));
    }

    private validateDeleteColumnData(data: any): boolean {
        return data && typeof data.index === 'number' && data.index >= 0;
    }

    private validateSortData(data: any): boolean {
        return data && 
               typeof data.column === 'number' && data.column >= 0 &&
               typeof data.direction === 'string' && 
               (data.direction === 'asc' || data.direction === 'desc');
    }

    private validateMoveData(data: any): boolean {
        return data && 
               typeof data.from === 'number' && data.from >= 0 &&
               typeof data.to === 'number' && data.to >= 0;
    }

    /**
     * Handle request for table data
     */
    private async handleRequestTableData(panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Table data requested for:', uri.toString());
        
        // Emit custom event that can be handled by the extension
        vscode.commands.executeCommand('markdownTableEditor.internal.requestTableData', {
            uri,
            panelId: this.getPanelId(uri)
        });
    }

    /**
     * Handle cell update
     */
    private async handleCellUpdate(data: { row: number; col: number; value: string }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Cell update:', data, 'for file:', uri.toString());
        
        // Emit custom event that can be handled by the extension
        vscode.commands.executeCommand('markdownTableEditor.internal.updateCell', {
            uri,
            panelId: this.getPanelId(uri),
            row: data.row,
            col: data.col,
            value: data.value
        });
    }

    /**
     * Handle add row
     */
    private async handleAddRow(data: { index?: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Add row:', data, 'for file:', uri.toString());
        
        vscode.commands.executeCommand('markdownTableEditor.internal.addRow', {
            uri,
            panelId: this.getPanelId(uri),
            index: data?.index
        });
    }

    /**
     * Handle delete row
     */
    private async handleDeleteRow(data: { index: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Delete row:', data, 'for file:', uri.toString());
        
        vscode.commands.executeCommand('markdownTableEditor.internal.deleteRow', {
            uri,
            panelId: this.getPanelId(uri),
            index: data.index
        });
    }

    /**
     * Handle add column
     */
    private async handleAddColumn(data: { index?: number; header?: string }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Add column:', data, 'for file:', uri.toString());
        
        vscode.commands.executeCommand('markdownTableEditor.internal.addColumn', {
            uri,
            panelId: this.getPanelId(uri),
            index: data?.index,
            header: data?.header
        });
    }

    /**
     * Handle delete column
     */
    private async handleDeleteColumn(data: { index: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Delete column:', data, 'for file:', uri.toString());
        
        vscode.commands.executeCommand('markdownTableEditor.internal.deleteColumn', {
            uri,
            panelId: this.getPanelId(uri),
            index: data.index
        });
    }

    /**
     * Handle sort
     */
    private async handleSort(data: { column: number; direction: 'asc' | 'desc' }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Sort:', data, 'for file:', uri.toString());
        
        vscode.commands.executeCommand('markdownTableEditor.internal.sort', {
            uri,
            panelId: this.getPanelId(uri),
            column: data.column,
            direction: data.direction
        });
    }

    /**
     * Handle move row
     */
    private async handleMoveRow(data: { from: number; to: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Move row:', data, 'for file:', uri.toString());
        
        vscode.commands.executeCommand('markdownTableEditor.internal.moveRow', {
            uri,
            panelId: this.getPanelId(uri),
            from: data.from,
            to: data.to
        });
    }

    /**
     * Handle move column
     */
    private async handleMoveColumn(data: { from: number; to: number }, panel: vscode.WebviewPanel, uri: vscode.Uri): Promise<void> {
        console.log('Move column:', data, 'for file:', uri.toString());
        
        vscode.commands.executeCommand('markdownTableEditor.internal.moveColumn', {
            uri,
            panelId: this.getPanelId(uri),
            from: data.from,
            to: data.to
        });
    }

    /**
     * Get the webview HTML content
     */
    private getWebviewContent(): string {
        // Read the HTML file content
        const htmlPath = path.join(this.context.extensionPath, 'webview', 'tableEditor.html');
        
        try {
            const fs = require('fs');
            return fs.readFileSync(htmlPath, 'utf8');
        } catch (error) {
            console.error('Error reading webview HTML file:', error);
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
     * Get panel by URI
     */
    public getPanel(uri: vscode.Uri): vscode.WebviewPanel | undefined {
        return this.panels.get(uri.toString());
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
     * Get panel ID from URI
     */
    private getPanelId(uri: vscode.Uri): string {
        return uri.toString();
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
     * Broadcast message to all panels
     */
    public broadcastMessage(command: string, data?: any): void {
        for (const panel of this.panels.values()) {
            panel.webview.postMessage({
                command: command,
                data: data
            });
        }
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
     * Cleanup resources
     */
    public dispose(): void {
        this.stopHealthMonitoring();
        this.closeAllPanels();
        this.connectionHealthMap.clear();
    }
}