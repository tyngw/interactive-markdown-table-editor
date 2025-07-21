import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for file system operations related to Markdown files
 */
export interface FileHandler {
    readMarkdownFile(uri: vscode.Uri): Promise<string>;
    writeMarkdownFile(uri: vscode.Uri, content: string): Promise<void>;
    updateTableInFile(uri: vscode.Uri, startLine: number, endLine: number, newTableContent: string): Promise<void>;
    updateMultipleTablesInFile(uri: vscode.Uri, updates: Array<{
        startLine: number;
        endLine: number;
        newContent: string;
    }>): Promise<void>;
    createBackup(uri: vscode.Uri): Promise<string>;
}

/**
 * Error types for file system operations
 */
export class FileSystemError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly uri: vscode.Uri,
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'FileSystemError';
    }
}

/**
 * Implementation of file system handler for Markdown table operations
 */
export class MarkdownFileHandler implements FileHandler {
    private readonly outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('Markdown Table Editor');
    }

    /**
     * Read the content of a Markdown file
     */
    async readMarkdownFile(uri: vscode.Uri): Promise<string> {
        try {
            this.outputChannel.appendLine(`Reading file: ${uri.fsPath}`);
            
            // Check if file exists
            if (!fs.existsSync(uri.fsPath)) {
                throw new FileSystemError(
                    `File does not exist: ${uri.fsPath}`,
                    'read',
                    uri
                );
            }

            // Check if file is readable
            try {
                await fs.promises.access(uri.fsPath, fs.constants.R_OK);
            } catch (error) {
                throw new FileSystemError(
                    `File is not readable: ${uri.fsPath}`,
                    'read',
                    uri,
                    error as Error
                );
            }

            // Read file content
            const content = await fs.promises.readFile(uri.fsPath, 'utf8');
            this.outputChannel.appendLine(`Successfully read file: ${uri.fsPath} (${content.length} characters)`);
            
            return content;
        } catch (error) {
            if (error instanceof FileSystemError) {
                throw error;
            }
            
            const fileError = new FileSystemError(
                `Failed to read file: ${uri.fsPath}`,
                'read',
                uri,
                error as Error
            );
            
            this.outputChannel.appendLine(`Error reading file: ${fileError.message}`);
            this.showErrorNotification(fileError);
            throw fileError;
        }
    }

    /**
     * Write content to a Markdown file
     */
    async writeMarkdownFile(uri: vscode.Uri, content: string): Promise<void> {
        try {
            this.outputChannel.appendLine(`Writing file: ${uri.fsPath}`);
            
            // Ensure directory exists
            const dir = path.dirname(uri.fsPath);
            if (!fs.existsSync(dir)) {
                await fs.promises.mkdir(dir, { recursive: true });
            }

            // Check if file is writable (if it exists)
            if (fs.existsSync(uri.fsPath)) {
                try {
                    await fs.promises.access(uri.fsPath, fs.constants.W_OK);
                } catch (error) {
                    throw new FileSystemError(
                        `File is not writable: ${uri.fsPath}`,
                        'write',
                        uri,
                        error as Error
                    );
                }
            }

            // Write file content
            await fs.promises.writeFile(uri.fsPath, content, 'utf8');
            this.outputChannel.appendLine(`Successfully wrote file: ${uri.fsPath} (${content.length} characters)`);
            
            // Notify VSCode about file changes
            this.notifyFileChange(uri);
            
        } catch (error) {
            if (error instanceof FileSystemError) {
                throw error;
            }
            
            const fileError = new FileSystemError(
                `Failed to write file: ${uri.fsPath}`,
                'write',
                uri,
                error as Error
            );
            
            this.outputChannel.appendLine(`Error writing file: ${fileError.message}`);
            this.showErrorNotification(fileError);
            throw fileError;
        }
    }

    /**
     * Update a specific table section in a Markdown file by table index
     */
    async updateTableByIndex(
        uri: vscode.Uri, 
        tableIndex: number,
        newTableContent: string
    ): Promise<void> {
        try {
            this.outputChannel.appendLine(`Updating table ${tableIndex} in file: ${uri.fsPath}`);
            
            // Create backup before modification
            const backupPath = await this.createBackup(uri);
            this.outputChannel.appendLine(`Created backup: ${backupPath}`);
            
            // Read current file content and re-parse to get accurate table positions
            const currentContent = await this.readMarkdownFile(uri);
            
            // Parse the content to get current table positions
            const MarkdownIt = require('markdown-it');
            const md = new MarkdownIt({
                html: true,
                linkify: true,
                typographer: true
            });
            
            const tokens = md.parse(currentContent, {});
            const currentTables = this.extractTablePositionsFromTokens(tokens, currentContent);
            
            if (tableIndex < 0 || tableIndex >= currentTables.length) {
                throw new FileSystemError(
                    `Table index ${tableIndex} is out of range (found ${currentTables.length} tables)`,
                    'update',
                    uri
                );
            }
            
            const targetTable = currentTables[tableIndex];
            this.outputChannel.appendLine(`Target table found at lines ${targetTable.startLine}-${targetTable.endLine}`);
            
            // Update using the accurate line numbers
            await this.updateTableInFile(uri, targetTable.startLine, targetTable.endLine, newTableContent);
            
            this.outputChannel.appendLine(`Successfully updated table ${tableIndex} in file: ${uri.fsPath}`);
            
        } catch (error) {
            if (error instanceof FileSystemError) {
                throw error;
            }
            
            const fileError = new FileSystemError(
                `Failed to update table ${tableIndex} in file: ${uri.fsPath}`,
                'update',
                uri,
                error as Error
            );
            
            this.outputChannel.appendLine(`Error updating table by index: ${fileError.message}`);
            this.showErrorNotification(fileError);
            throw fileError;
        }
    }

    /**
     * Extract table positions from markdown tokens
     */
    private extractTablePositionsFromTokens(tokens: any[], content: string): Array<{
        startLine: number;
        endLine: number;
        tableIndex: number;
    }> {
        const tables: Array<{
            startLine: number;
            endLine: number;
            tableIndex: number;
        }> = [];

        let tableIndex = 0;
        
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            if (token?.type === 'table_open' && token?.map) {
                const startLine = token.map[0];
                let endLine = token.map[1];
                
                this.outputChannel.appendLine(`Found table_open token: startLine=${startLine}, initial endLine=${endLine}`);
                
                // Find the corresponding table_close token for more accurate end line
                for (let j = i + 1; j < tokens.length; j++) {
                    const closeToken = tokens[j];
                    if (closeToken?.type === 'table_close') {
                        if (closeToken?.map) {
                            this.outputChannel.appendLine(`Found table_close token: endLine=${closeToken.map[1]}`);
                            endLine = closeToken.map[1];
                        }
                        break;
                    }
                }
                
                // Adjust endLine to be inclusive (subtract 1 for 0-based indexing)
                const adjustedEndLine = Math.max(0, endLine - 1);
                this.outputChannel.appendLine(`Table ${tableIndex}: lines ${startLine}-${adjustedEndLine} (adjusted from ${endLine})`);
                
                tables.push({
                    startLine,
                    endLine: adjustedEndLine,
                    tableIndex
                });
                
                tableIndex++;
            }
        }
        
        return tables;
    }
    async updateTableInFile(
        uri: vscode.Uri, 
        startLine: number, 
        endLine: number, 
        newTableContent: string
    ): Promise<void> {
        try {
            this.outputChannel.appendLine(`Updating table in file: ${uri.fsPath} (lines ${startLine}-${endLine})`);
            
            // Create backup before modification
            const backupPath = await this.createBackup(uri);
            this.outputChannel.appendLine(`Created backup: ${backupPath}`);
            
            // Read current file content
            const currentContent = await this.readMarkdownFile(uri);
            const lines = currentContent.split('\n');
            
            this.outputChannel.appendLine(`File has ${lines.length} lines (0-${lines.length - 1})`);
            this.outputChannel.appendLine(`Requested range: ${startLine}-${endLine}`);
            
            // Validate line numbers - endLine should be less than lines.length for 0-based indexing
            if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
                this.outputChannel.appendLine(`Line validation failed: startLine=${startLine}, endLine=${endLine}, lines.length=${lines.length}`);
                throw new FileSystemError(
                    `Invalid line range: ${startLine}-${endLine} (file has ${lines.length} lines, valid range: 0-${lines.length - 1})`,
                    'update',
                    uri
                );
            }
            
            // Replace table content
            const beforeTable = lines.slice(0, startLine);
            const afterTable = lines.slice(endLine + 1);
            const newTableLines = newTableContent.split('\n');
            
            const updatedLines = [...beforeTable, ...newTableLines, ...afterTable];
            const updatedContent = updatedLines.join('\n');
            
            // Write updated content
            await this.writeMarkdownFile(uri, updatedContent);
            
            this.outputChannel.appendLine(`Successfully updated table in file: ${uri.fsPath}`);
            
        } catch (error) {
            if (error instanceof FileSystemError) {
                throw error;
            }
            
            const fileError = new FileSystemError(
                `Failed to update table in file: ${uri.fsPath}`,
                'update',
                uri,
                error as Error
            );
            
            this.outputChannel.appendLine(`Error updating table: ${fileError.message}`);
            this.showErrorNotification(fileError);
            throw fileError;
        }
    }

    /**
     * Update multiple tables in a file atomically
     */
    async updateMultipleTablesInFile(
        uri: vscode.Uri,
        updates: Array<{
            startLine: number;
            endLine: number;
            newContent: string;
        }>
    ): Promise<void> {
        try {
            this.outputChannel.appendLine(`Updating ${updates.length} tables in file: ${uri.fsPath}`);
            
            // Create backup before any modifications
            const backupPath = await this.createBackup(uri);
            this.outputChannel.appendLine(`Created backup: ${backupPath}`);
            
            // Read current file content
            const currentContent = await this.readMarkdownFile(uri);
            const lines = currentContent.split('\n');
            
            // Sort updates by line number in descending order to avoid index shifting
            const sortedUpdates = updates.sort((a, b) => b.startLine - a.startLine);
            
            // Apply updates from bottom to top
            for (const update of sortedUpdates) {
                // Validate line numbers
                if (update.startLine < 0 || update.endLine >= lines.length || update.startLine > update.endLine) {
                    throw new FileSystemError(
                        `Invalid line range: ${update.startLine}-${update.endLine} (file has ${lines.length} lines)`,
                        'update',
                        uri
                    );
                }
                
                // Replace table content
                const beforeTable = lines.slice(0, update.startLine);
                const afterTable = lines.slice(update.endLine + 1);
                const newTableLines = update.newContent.split('\n');
                
                // Reconstruct lines array
                lines.splice(0, lines.length, ...beforeTable, ...newTableLines, ...afterTable);
            }
            
            const updatedContent = lines.join('\n');
            
            // Write updated content
            await this.writeMarkdownFile(uri, updatedContent);
            
            this.outputChannel.appendLine(`Successfully updated ${updates.length} tables in file: ${uri.fsPath}`);
            
        } catch (error) {
            if (error instanceof FileSystemError) {
                throw error;
            }
            
            const fileError = new FileSystemError(
                `Failed to update multiple tables in file: ${uri.fsPath}`,
                'update',
                uri,
                error as Error
            );
            
            this.outputChannel.appendLine(`Error updating multiple tables: ${fileError.message}`);
            this.showErrorNotification(fileError);
            throw fileError;
        }
    }

    /**
     * Create a backup of the file before modification
     */
    async createBackup(uri: vscode.Uri): Promise<string> {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = `${uri.fsPath}.backup-${timestamp}`;
            
            const content = await this.readMarkdownFile(uri);
            await fs.promises.writeFile(backupPath, content, 'utf8');
            
            this.outputChannel.appendLine(`Created backup: ${backupPath}`);
            return backupPath;
            
        } catch (error) {
            const fileError = new FileSystemError(
                `Failed to create backup for file: ${uri.fsPath}`,
                'backup',
                uri,
                error as Error
            );
            
            this.outputChannel.appendLine(`Error creating backup: ${fileError.message}`);
            // Don't throw here - backup failure shouldn't prevent the main operation
            // but we should log it
            return '';
        }
    }

    /**
     * Notify VSCode about file changes
     */
    private notifyFileChange(uri: vscode.Uri): void {
        try {
            // Fire file change event to update editors and other extensions
            vscode.workspace.fs.stat(uri).then(() => {
                // This will trigger file watchers and update open editors
                this.outputChannel.appendLine(`File change notification sent for: ${uri.fsPath}`);
                
                // Also trigger a workspace edit event to ensure proper change detection
                const edit = new vscode.WorkspaceEdit();
                // This creates an empty edit but triggers change detection
                vscode.workspace.applyEdit(edit);
                
            }, (error: any) => {
                this.outputChannel.appendLine(`Warning: Could not notify file change: ${error.message}`);
            });
            
            // Additionally, try to refresh any open text editors for this file
            const openEditors = vscode.window.visibleTextEditors.filter(
                editor => editor.document.uri.fsPath === uri.fsPath
            );
            
            if (openEditors.length > 0) {
                this.outputChannel.appendLine(`Found ${openEditors.length} open editor(s) for file: ${uri.fsPath}`);
                // The file system change should automatically refresh the editors
            }
            
        } catch (error) {
            this.outputChannel.appendLine(`Error in file change notification: ${error}`);
        }
    }

    /**
     * Show error notification to user with appropriate actions
     */
    private showErrorNotification(error: FileSystemError): void {
        const message = `File operation failed: ${error.message}`;
        
        switch (error.operation) {
            case 'read':
                vscode.window.showErrorMessage(
                    message,
                    'Retry',
                    'Show Details'
                ).then(action => {
                    if (action === 'Show Details') {
                        this.outputChannel.show();
                    }
                });
                break;
                
            case 'write':
            case 'update':
                vscode.window.showErrorMessage(
                    message,
                    'Retry',
                    'Save As...',
                    'Show Details'
                ).then(action => {
                    if (action === 'Show Details') {
                        this.outputChannel.show();
                    } else if (action === 'Save As...') {
                        vscode.window.showSaveDialog({
                            defaultUri: error.uri,
                            filters: {
                                'Markdown': ['md'],
                                'All Files': ['*']
                            }
                        });
                    }
                });
                break;
                
            default:
                vscode.window.showErrorMessage(message, 'Show Details').then(action => {
                    if (action === 'Show Details') {
                        this.outputChannel.show();
                    }
                });
        }
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}

/**
 * Singleton instance of the file handler
 */
let fileHandlerInstance: MarkdownFileHandler | undefined;

/**
 * Get the singleton file handler instance
 */
export function getFileHandler(): MarkdownFileHandler {
    if (!fileHandlerInstance) {
        fileHandlerInstance = new MarkdownFileHandler();
    }
    return fileHandlerInstance;
}

/**
 * Dispose the file handler instance
 */
export function disposeFileHandler(): void {
    if (fileHandlerInstance) {
        fileHandlerInstance.dispose();
        fileHandlerInstance = undefined;
    }
}