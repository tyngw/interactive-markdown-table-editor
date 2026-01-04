import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for file system operations related to Markdown files
 */
export interface FileHandler {
    readMarkdownFile(uri: vscode.Uri): Promise<string>;
    writeMarkdownFile(uri: vscode.Uri, content: string): Promise<void>;
    // Returns true when the document was changed and saved
    updateTableInFile(uri: vscode.Uri, startLine: number, endLine: number, newTableContent: string): Promise<boolean>;
    // Returns true when changes were applied
    updateMultipleTablesInFile(uri: vscode.Uri, updates: Array<{
        startLine: number;
        endLine: number;
        newContent: string;
    }>): Promise<boolean>;
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
    private readonly parser: any;

    constructor(parser?: any, outputChannel?: vscode.OutputChannel) {
        // Allow injection for testability; fall back to defaults when omitted
        this.outputChannel = outputChannel ?? vscode.window.createOutputChannel('Markdown Table Editor');
        if (parser) {
            this.parser = parser;
        } else {
            // lazy-require to avoid test-time side effects when mocked
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const MarkdownIt = require('markdown-it');
            this.parser = new MarkdownIt({ html: true, linkify: true, typographer: true });
        }
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

            // If the document is already open in VS Code, prefer the in-memory content (includes unsaved changes)
            const openDocument = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === uri.fsPath);
            if (openDocument) {
                const content = openDocument.getText();
                this.outputChannel.appendLine(`Read content from open document (unsaved changes included): ${uri.fsPath} (${content.length} characters)`);
                return content;
            }

            // Read file content from disk as fallback
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
    ): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`Updating table ${tableIndex} in file: ${uri.fsPath}`);

            // Open the document to ensure we operate on the latest in-memory content (including unsaved changes)
            const document = await vscode.workspace.openTextDocument(uri);
            const currentContent = document.getText();

            // Parse the content to get current table positions using injected parser
            const tokens = this.parser.parse(currentContent, {});
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
            
            // Update using the accurate line numbers on the live document
            const applied = await this.updateTableInDocument(document, targetTable.startLine, targetTable.endLine, newTableContent, currentContent);

            if (applied) {
                this.outputChannel.appendLine(`Successfully updated table ${tableIndex} in file: ${uri.fsPath}`);
            } else {
                this.outputChannel.appendLine(`No changes applied for table ${tableIndex} in file: ${uri.fsPath}`);
            }

            return applied;

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
    ): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`Updating table in file: ${uri.fsPath} (lines ${startLine}-${endLine})`);

            const document = await vscode.workspace.openTextDocument(uri);
            const applied = await this.updateTableInDocument(document, startLine, endLine, newTableContent);

            if (applied) {
                this.outputChannel.appendLine(`Successfully updated table in file: ${uri.fsPath}`);
            } else {
                this.outputChannel.appendLine(`No changes applied for file: ${uri.fsPath}`);
            }

            return applied;

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
    ): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`Updating ${updates.length} tables in file: ${uri.fsPath}`);

            const document = await vscode.workspace.openTextDocument(uri);
            const applied = await this.updateMultipleTablesInDocument(document, updates);
            if (applied) {
                this.outputChannel.appendLine(`Successfully updated ${updates.length} tables in file: ${uri.fsPath}`);
            } else {
                this.outputChannel.appendLine(`No changes applied for file: ${uri.fsPath}`);
            }
            return applied;

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

    private getEolString(document: vscode.TextDocument): string {
        return document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n';
    }

    // Delegate pure content helpers to fileUtils for testability
    private normalizeTableLines(content: string): string[] {
        // lazy-load to avoid circular imports during some test runners
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { normalizeTableLines } = require('./fileUtils');
        return normalizeTableLines(content);
    }

    private contentEndsWithLineBreak(content: string, eol: string): boolean {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { contentEndsWithLineBreak } = require('./fileUtils');
        return contentEndsWithLineBreak(content, eol);
    }

    private buildUpdatedContent(
        uri: vscode.Uri,
        operation: string,
        originalContent: string,
        startLine: number,
        endLine: number,
        replacementLines: string[],
        eol: string
    ): string {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { buildUpdatedContent } = require('./fileUtils');
        return buildUpdatedContent(originalContent, startLine, endLine, replacementLines, eol);
    }

    private async applyFullDocumentUpdate(
        document: vscode.TextDocument,
        originalContent: string,
        updatedContent: string,
        operation: string
    ): Promise<boolean> {
        // If there are no changes between original and updated content,
        // avoid calling VSCode APIs which trigger saves and file-system events.
        if (originalContent === updatedContent) {
            this.outputChannel.appendLine(`No changes detected for: ${document.uri.fsPath} (skipping apply/save)`);
            return false;
        }
        const uri = document.uri;
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(originalContent.length)
        );

        edit.replace(uri, fullRange, updatedContent);

        const applied = await vscode.workspace.applyEdit(edit);
        if (!applied) {
            throw new FileSystemError('Failed to apply document edit', operation, uri);
        }

        const saved = await document.save();
        if (!saved) {
            throw new FileSystemError('Failed to save document after update', operation, uri);
        }

        this.notifyFileChange(uri);
        return true;
    }

    private async updateTableInDocument(
        document: vscode.TextDocument,
        startLine: number,
        endLine: number,
        newTableContent: string,
        originalContent?: string
    ): Promise<boolean> {
        const eol = this.getEolString(document);
        const baseContent = originalContent ?? document.getText();
        const replacementLines = this.normalizeTableLines(newTableContent);
        const updatedContent = this.buildUpdatedContent(
            document.uri,
            'update',
            baseContent,
            startLine,
            endLine,
            replacementLines,
            eol
        );

        const applied = await this.applyFullDocumentUpdate(document, baseContent, updatedContent, 'update');
        return applied;
    }

    private async updateMultipleTablesInDocument(
        document: vscode.TextDocument,
        updates: Array<{
            startLine: number;
            endLine: number;
            newContent: string;
        }>
    ): Promise<boolean> {
        const eol = this.getEolString(document);
        const originalContent = document.getText();
        const sortedUpdates = [...updates].sort((a, b) => b.startLine - a.startLine);

        let workingContent = originalContent;
        for (const update of sortedUpdates) {
            const replacementLines = this.normalizeTableLines(update.newContent);
            workingContent = this.buildUpdatedContent(
                document.uri,
                'update',
                workingContent,
                update.startLine,
                update.endLine,
                replacementLines,
                eol
            );
        }
        const applied = await this.applyFullDocumentUpdate(document, originalContent, workingContent, 'update');
        return applied;
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
