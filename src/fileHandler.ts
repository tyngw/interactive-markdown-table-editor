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
    // cache for lazily-required utilities to avoid repeated require calls
    private fileUtils?: any;

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

    // Lazily require and cache helper utilities (avoids repeated require() calls)
    private getFileUtils(): any {
        if (!this.fileUtils) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            this.fileUtils = require('./fileUtils');
        }
        return this.fileUtils;
    }

    /**
     * Read the content of a Markdown file
     */
    async readMarkdownFile(uri: vscode.Uri): Promise<string> {
        try {
            this.outputChannel.appendLine(`Reading file: ${uri.fsPath}`);
            // If the document is already open in VS Code, prefer the in-memory content (includes unsaved changes)
            const openDocument = vscode.workspace.textDocuments.find(doc => doc.uri.fsPath === uri.fsPath);
            if (openDocument) {
                const content = openDocument.getText();
                this.outputChannel.appendLine(`Read content from open document (unsaved changes included): ${uri.fsPath} (${content.length} characters)`);
                return content;
            }

            // Ensure file is readable on disk (will throw if missing or not accessible)
            try {
                await fs.promises.access(uri.fsPath, fs.constants.R_OK);
            } catch (error) {
                throw new FileSystemError(
                    `File does not exist or is not readable: ${uri.fsPath}`,
                    'read',
                    uri,
                    error as Error
                );
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
            // Ensure directory exists (mkdir with recursive handles existing dirs)
            const dir = path.dirname(uri.fsPath);
            await fs.promises.mkdir(dir, { recursive: true });

            // If the file exists, verify it is writable; if it doesn't exist, we'll create it.
            try {
                await fs.promises.access(uri.fsPath, fs.constants.W_OK);
            } catch (error: any) {
                // If ENOENT (file missing), it's fine — we'll create the file. Otherwise surface error.
                if (error && error.code !== 'ENOENT') {
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
            await this.notifyFileChange(uri);
            
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
            // Use withOpenDocument to open the live document and ensure consistent error handling
            return await this.withOpenDocument<boolean>(uri, 'update', async (document) => {
                const current = document.getText();
                const tokens = this.parser.parse(current, {});
                const currentTables = this.extractTablePositionsFromTokens(tokens, current);

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
                const applied = await this.updateTableInDocument(document, targetTable.startLine, targetTable.endLine, newTableContent, current);
                return this.handleApplyResult(
                    uri,
                    'update',
                    applied,
                    `Successfully updated table ${tableIndex} in file: ${uri.fsPath}`,
                    `No changes applied for table ${tableIndex} in file: ${uri.fsPath}`
                );
            });
            
            

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

    /**
     * Open a document and run an async callback with unified error wrapping.
     * This centralizes the `openTextDocument` call and FileSystemError construction for failures.
     */
    private async withOpenDocument<T>(uri: vscode.Uri, operation: string, fn: (document: vscode.TextDocument) => Promise<T>): Promise<T> {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            return await fn(document);
        } catch (error) {
            if (error instanceof FileSystemError) {
                throw error;
            }
            const fileError = new FileSystemError(
                `Failed to ${operation} document: ${uri.fsPath}`,
                operation,
                uri,
                error as Error
            );
            this.outputChannel.appendLine(`Error during ${operation}: ${fileError.message}`);
            this.showErrorNotification(fileError);
            throw fileError;
        }
    }

    /**
     * Centralize handling of apply/save results.
     * Logs success or no-op messages and returns the `applied` value for convenience.
     */
    private handleApplyResult(uri: vscode.Uri, operation: string, applied: boolean, successMsg?: string, noChangeMsg?: string): boolean {
        if (applied) {
            this.outputChannel.appendLine(successMsg ?? `Successfully ${operation} for file: ${uri.fsPath}`);
        } else {
            this.outputChannel.appendLine(noChangeMsg ?? `No changes applied for file: ${uri.fsPath}`);
        }
        return applied;
    }
    async updateTableInFile(
        uri: vscode.Uri, 
        startLine: number, 
        endLine: number, 
        newTableContent: string
    ): Promise<boolean> {
        try {
            this.outputChannel.appendLine(`Updating table in file: ${uri.fsPath} (lines ${startLine}-${endLine})`);
            return await this.withOpenDocument<boolean>(uri, 'update', async (document) => {
                const applied = await this.updateTableInDocument(document, startLine, endLine, newTableContent);
                return this.handleApplyResult(
                    uri,
                    'update',
                    applied,
                    `Successfully updated table in file: ${uri.fsPath}`,
                    `No changes applied for file: ${uri.fsPath}`
                );
            });

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
            return await this.withOpenDocument<boolean>(uri, 'update', async (document) => {
                const applied = await this.updateMultipleTablesInDocument(document, updates);
                return this.handleApplyResult(
                    uri,
                    'update',
                    applied,
                    `Successfully updated ${updates.length} tables in file: ${uri.fsPath}`,
                    `No changes applied for file: ${uri.fsPath}`
                );
            });

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
        const { normalizeTableLines } = this.getFileUtils();
        return normalizeTableLines(content);
    }

    /**
     * Apply multiple range replacements using a single WorkspaceEdit.
     * Replacements must be specified using 0-based inclusive line numbers.
     * They will be sorted in descending order by startLine before being
     * added to the WorkspaceEdit so that earlier edits do not shift later ranges.
     */
    private async applyWorkspaceEditsForReplacements(
        document: vscode.TextDocument,
        replacements: Array<{
            startLine: number;
            endLine: number;
            replacementText: string;
        }>,
        operation: string
    ): Promise<boolean> {
        if (replacements.length === 0) {
            return false;
        }

        const eol = this.getEolString(document);

        // Sort descending by startLine so that applying edits won't invalidate
        // the ranges of earlier (lower-line) edits.
        const sorted = [...replacements].sort((a, b) => b.startLine - a.startLine);

        // Build list of edits that actually change content by comparing current range text
        const editsToApply: Array<{range: vscode.Range; text: string}> = [];
        for (const r of sorted) {
            const startPos = new vscode.Position(r.startLine, 0);
            // endLine is inclusive, so use the end of that line
            const endLineIndex = Math.max(r.endLine, r.startLine);
            const endPos = document.lineAt(endLineIndex).range.end;
            const range = new vscode.Range(startPos, endPos);

            // Normalize replacement line endings to document EOL
            const normalizedText = r.replacementText.split(/\r\n|\n|\r/).join(eol);

            const currentText = document.getText(range);
            if (currentText !== normalizedText) {
                editsToApply.push({ range, text: normalizedText });
            }
        }

        if (editsToApply.length === 0) {
            this.outputChannel.appendLine(`No changes detected for: ${document.uri.fsPath} (skipping apply/save)`);
            return false;
        }

        const uri = document.uri;
        const edit = new vscode.WorkspaceEdit();
        for (const e of editsToApply) {
            edit.replace(uri, e.range, e.text);
        }

        const applied = await vscode.workspace.applyEdit(edit);
        if (!applied) {
            throw new FileSystemError('Failed to apply document edit', operation, uri);
        }

        const saved = await document.save();
        if (!saved) {
            throw new FileSystemError('Failed to save document after update', operation, uri);
        }

        await this.notifyFileChange(uri);
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
        const replacementLines = this.normalizeTableLines(newTableContent);
        const replacementText = replacementLines.join(eol);

        const applied = await this.applyWorkspaceEditsForReplacements(
            document,
            [{ startLine, endLine, replacementText }],
            'update'
        );

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
        const sortedUpdates = [...updates].sort((a, b) => b.startLine - a.startLine);

        const replacements = sortedUpdates.map(u => ({
            startLine: u.startLine,
            endLine: u.endLine,
            replacementText: this.normalizeTableLines(u.newContent).join(eol)
        }));

        const applied = await this.applyWorkspaceEditsForReplacements(document, replacements, 'update');
        return applied;
    }

    /**
     * Notify VSCode about file changes
     */
    private async notifyFileChange(uri: vscode.Uri): Promise<void> {
        // Use async/await style and avoid no-op workspace edits. This method is best-effort.
        try {
            await vscode.workspace.fs.stat(uri);
            this.outputChannel.appendLine(`File change notification sent for: ${uri.fsPath}`);
        } catch (error: any) {
            this.outputChannel.appendLine(`Warning: Could not notify file change: ${error?.message ?? error}`);
            return;
        }

        // Additionally, log any visible editors for the file (no manual refresh required)
        const openEditors = vscode.window.visibleTextEditors.filter(
            editor => editor.document.uri.fsPath === uri.fsPath
        );
        if (openEditors.length > 0) {
            this.outputChannel.appendLine(`Found ${openEditors.length} open editor(s) for file: ${uri.fsPath}`);
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
