const MarkdownIt = require('markdown-it');
import * as vscode from 'vscode';

/**
 * Error types for markdown parsing operations
 */
export class MarkdownParsingError extends Error {
    constructor(
        message: string,
        public readonly operation: string,
        public readonly position?: { line: number; column: number },
        public readonly originalError?: Error
    ) {
        super(message);
        this.name = 'MarkdownParsingError';
    }
}

export class TableValidationError extends Error {
    constructor(
        message: string,
        public readonly tableIndex: number,
        public readonly issues: string[],
        public readonly position?: { startLine: number; endLine: number }
    ) {
        super(message);
        this.name = 'TableValidationError';
    }
}

export interface TableNode {
    startLine: number;
    endLine: number;
    headers: string[];
    rows: string[][];
    alignment: ('left' | 'center' | 'right')[];
}

export interface MarkdownAST {
    tokens: any[];
    content: string;
}

export class MarkdownParser {
    private md: any;

    constructor() {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true
        });
    }

    /**
     * Parse markdown document and return AST
     */
    parseDocument(content: string): MarkdownAST {
        try {
            if (!content || typeof content !== 'string') {
                throw new MarkdownParsingError(
                    'Invalid content provided for parsing',
                    'parseDocument'
                );
            }

            const tokens = this.md.parse(content, {});
            
            // Validate tokens
            if (!tokens || !Array.isArray(tokens)) {
                throw new MarkdownParsingError(
                    'Failed to parse document tokens',
                    'parseDocument'
                );
            }

            return {
                tokens,
                content
            };
        } catch (error) {
            if (error instanceof MarkdownParsingError) {
                throw error;
            }
            throw new MarkdownParsingError(
                `Failed to parse markdown document: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'parseDocument',
                undefined,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Find all tables in the document
     */
    findTablesInDocument(ast: MarkdownAST): TableNode[] {
        try {
            if (!ast || !ast.tokens || !Array.isArray(ast.tokens)) {
                throw new MarkdownParsingError(
                    'Invalid AST provided for table extraction',
                    'findTablesInDocument'
                );
            }

            const tables: TableNode[] = [];
            const tokens = ast.tokens;

            for (let i = 0; i < tokens.length; i++) {
                try {
                    const token = tokens[i];

                    if (token?.type === 'table_open') {
                        const tableNode = this.parseTableToken(tokens, i, ast.content);
                        if (tableNode) {
                            // Validate the parsed table
                            const validation = this.validateTableStructure(tableNode);
                            if (!validation.isValid) {
                                console.warn(`Table at line ${tableNode.startLine} has validation issues:`, validation.issues);
                                // Still include the table but log warnings
                            }
                            tables.push(tableNode);
                        }
                    }
                } catch (error) {
                    console.error(`Error parsing table at token ${i}:`, error);
                    // Continue parsing other tables even if one fails
                    continue;
                }
            }

            return tables;
        } catch (error) {
            if (error instanceof MarkdownParsingError) {
                throw error;
            }
            throw new MarkdownParsingError(
                `Failed to find tables in document: ${error instanceof Error ? error.message : 'Unknown error'}`,
                'findTablesInDocument',
                undefined,
                error instanceof Error ? error : undefined
            );
        }
    }

    /**
     * Find table at specific position
     */
    findTableAtPosition(ast: MarkdownAST, position: vscode.Position): TableNode | null {
        const tables = this.findTablesInDocument(ast);

        for (const table of tables) {
            if (position.line >= table.startLine && position.line <= table.endLine) {
                return table;
            }
        }

        return null;
    }

    /**
     * Parse table token and extract table data
     */
    private parseTableToken(tokens: any[], startIndex: number, content: string): TableNode | null {
        try {
            if (!tokens || !Array.isArray(tokens) || startIndex < 0 || startIndex >= tokens.length) {
                throw new MarkdownParsingError(
                    'Invalid tokens or start index for table parsing',
                    'parseTableToken',
                    { line: startIndex, column: 0 }
                );
            }

            let currentIndex = startIndex;
            let headers: string[] = [];
            let rows: string[][] = [];
            let alignment: ('left' | 'center' | 'right')[] = [];
            let startLine = 0;
            let endLine = 0;

            // Find table boundaries
            if (tokens[startIndex]?.map) {
                startLine = tokens[startIndex].map[0];
                endLine = tokens[startIndex].map[1];
            }

            // Parse table structure
            const maxIterations = tokens.length; // Prevent infinite loops
            let iterations = 0;
            
            while (currentIndex < tokens.length && iterations < maxIterations) {
                iterations++;
                const token = tokens[currentIndex];

                if (!token) {
                    console.warn(`Encountered null token at index ${currentIndex}`);
                    currentIndex++;
                    continue;
                }

                if (token.type === 'table_close') {
                    break;
                }

                if (token.type === 'thead_open') {
                    try {
                        const headerData = this.parseTableHead(tokens, currentIndex);
                        headers = headerData.headers;
                        alignment = headerData.alignment;
                        currentIndex = headerData.nextIndex;
                        continue;
                    } catch (error) {
                        console.error('Error parsing table head:', error);
                        currentIndex++;
                        continue;
                    }
                }

                if (token.type === 'tbody_open') {
                    try {
                        const bodyData = this.parseTableBody(tokens, currentIndex);
                        rows = bodyData.rows;
                        currentIndex = bodyData.nextIndex;
                        continue;
                    } catch (error) {
                        console.error('Error parsing table body:', error);
                        currentIndex++;
                        continue;
                    }
                }

                currentIndex++;
            }

            // Update end line if we have better information
            if (tokens[currentIndex]?.map) {
                endLine = tokens[currentIndex].map[1];
            }

            // Validate minimum table structure
            if (headers.length === 0) {
                console.warn('Table has no headers, skipping');
                return null;
            }

            const tableNode: TableNode = {
                startLine,
                endLine,
                headers,
                rows,
                alignment
            };

            return tableNode;
        } catch (error) {
            if (error instanceof MarkdownParsingError) {
                throw error;
            }
            console.error(`Failed to parse table token at index ${startIndex}:`, error);
            return null; // Return null instead of throwing to allow parsing of other tables
        }
    }

    /**
     * Parse table header
     */
    private parseTableHead(tokens: any[], startIndex: number): {
        headers: string[];
        alignment: ('left' | 'center' | 'right')[];
        nextIndex: number;
    } {
        let currentIndex = startIndex;
        const headers: string[] = [];
        const alignment: ('left' | 'center' | 'right')[] = [];

        while (currentIndex < tokens.length) {
            const token = tokens[currentIndex];

            if (token.type === 'thead_close') {
                currentIndex++;
                break;
            }

            if (token.type === 'tr_open') {
                currentIndex++;
                continue;
            }

            if (token.type === 'th_open') {
                // Extract alignment from token attributes
                const align = this.extractAlignment(token);
                alignment.push(align);

                // Find the content of this header cell
                const headerContent = this.extractCellContent(tokens, currentIndex);
                headers.push(headerContent.content);
                currentIndex = headerContent.nextIndex;
                continue;
            }

            currentIndex++;
        }

        return { headers, alignment, nextIndex: currentIndex };
    }

    /**
     * Parse table body
     */
    private parseTableBody(tokens: any[], startIndex: number): {
        rows: string[][];
        nextIndex: number;
    } {
        let currentIndex = startIndex;
        const rows: string[][] = [];
        let currentRow: string[] = [];

        while (currentIndex < tokens.length) {
            const token = tokens[currentIndex];

            if (token.type === 'tbody_close') {
                if (currentRow.length > 0) {
                    rows.push(currentRow);
                }
                currentIndex++;
                break;
            }

            if (token.type === 'tr_open') {
                currentRow = [];
                currentIndex++;
                continue;
            }

            if (token.type === 'tr_close') {
                if (currentRow.length > 0) {
                    rows.push(currentRow);
                    currentRow = [];
                }
                currentIndex++;
                continue;
            }

            if (token.type === 'td_open') {
                const cellContent = this.extractCellContent(tokens, currentIndex);
                currentRow.push(cellContent.content);
                currentIndex = cellContent.nextIndex;
                continue;
            }

            currentIndex++;
        }

        return { rows, nextIndex: currentIndex };
    }

    /**
     * Extract cell content from tokens
     */
    private extractCellContent(tokens: any[], startIndex: number): {
        content: string;
        nextIndex: number;
    } {
        let currentIndex = startIndex + 1; // Skip the opening tag
        let content = '';

        while (currentIndex < tokens.length) {
            const token = tokens[currentIndex];

            if (token.type === 'th_close' || token.type === 'td_close') {
                currentIndex++;
                break;
            }

            if (token.type === 'inline') {
                content += token.content || '';
            }

            currentIndex++;
        }

        return { content: content.trim(), nextIndex: currentIndex };
    }

    /**
     * Extract alignment from token attributes
     */
    private extractAlignment(token: any): 'left' | 'center' | 'right' {
        if (token.attrGet && token.attrGet('style')) {
            const style = token.attrGet('style');
            if (style.includes('text-align: center')) {
                return 'center';
            }
            if (style.includes('text-align: right')) {
                return 'right';
            }
        }
        return 'left';
    }

    /**
     * Validate table structure and detect issues
     */
    validateTableStructure(table: TableNode): {
        isValid: boolean;
        issues: string[];
    } {
        const issues: string[] = [];

        // Check if headers exist
        if (!table.headers || table.headers.length === 0) {
            issues.push('Table has no headers');
        }

        // Check if all rows have consistent column count
        const expectedColumns = table.headers.length;
        for (let i = 0; i < table.rows.length; i++) {
            if (table.rows[i].length !== expectedColumns) {
                issues.push(`Row ${i + 1} has ${table.rows[i].length} columns, expected ${expectedColumns}`);
            }
        }

        // Check alignment array length
        if (table.alignment.length !== expectedColumns) {
            issues.push(`Alignment array length (${table.alignment.length}) doesn't match column count (${expectedColumns})`);
        }

        return {
            isValid: issues.length === 0,
            issues
        };
    }

    /**
     * Find table that contains the specified line
     */
    findTableContainingLine(ast: MarkdownAST, lineNumber: number): TableNode | null {
        const tables = this.findTablesInDocument(ast);

        for (const table of tables) {
            if (lineNumber >= table.startLine && lineNumber <= table.endLine) {
                return table;
            }
        }

        return null;
    }

    /**
     * Get table boundaries more accurately by analyzing content
     */
    getTableBoundaries(content: string, tableNode: TableNode): {
        startLine: number;
        endLine: number;
        actualContent: string[];
    } {
        const lines = content.split('\n');
        let actualStartLine = tableNode.startLine;
        let actualEndLine = tableNode.endLine;

        // Find actual table start by looking for table pattern
        for (let i = Math.max(0, tableNode.startLine - 2); i < Math.min(lines.length, tableNode.startLine + 2); i++) {
            if (this.isTableLine(lines[i])) {
                actualStartLine = i;
                break;
            }
        }

        // Find actual table end
        for (let i = actualStartLine; i < lines.length; i++) {
            if (!this.isTableLine(lines[i]) && !this.isTableSeparatorLine(lines[i])) {
                actualEndLine = i - 1;
                break;
            }
            actualEndLine = i;
        }

        return {
            startLine: actualStartLine,
            endLine: actualEndLine,
            actualContent: lines.slice(actualStartLine, actualEndLine + 1)
        };
    }

    /**
     * Check if a line looks like a table row
     */
    private isTableLine(line: string): boolean {
        const trimmed = line.trim();
        return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|');
    }

    /**
     * Check if a line looks like a table separator (e.g., |---|---|)
     */
    private isTableSeparatorLine(line: string): boolean {
        const trimmed = line.trim();
        if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) {
            return false;
        }

        // Remove outer pipes and split by inner pipes
        const parts = trimmed.slice(1, -1).split('|');

        // Each part should contain only dashes, colons, and spaces
        return parts.every(part => /^[\s\-:]+$/.test(part.trim()));
    }

    /**
     * Get detailed table information including metadata
     */
    getTableMetadata(ast: MarkdownAST, tableNode: TableNode): {
        table: TableNode;
        validation: { isValid: boolean; issues: string[] };
        boundaries: { startLine: number; endLine: number; actualContent: string[] };
        columnInfo: { index: number; header: string; alignment: string; width: number }[];
    } {
        const validation = this.validateTableStructure(tableNode);
        const boundaries = this.getTableBoundaries(ast.content, tableNode);

        // Calculate column information
        const columnInfo = tableNode.headers.map((header, index) => ({
            index,
            header,
            alignment: tableNode.alignment[index] || 'left',
            width: this.calculateColumnWidth(tableNode, index)
        }));

        return {
            table: tableNode,
            validation,
            boundaries,
            columnInfo
        };
    }

    /**
     * Calculate the maximum width of content in a column
     */
    private calculateColumnWidth(table: TableNode, columnIndex: number): number {
        let maxWidth = table.headers[columnIndex]?.length || 0;

        for (const row of table.rows) {
            if (row[columnIndex]) {
                maxWidth = Math.max(maxWidth, row[columnIndex].length);
            }
        }

        return maxWidth;
    }

    /**
     * Find all tables and return them with enhanced metadata
     */
    findTablesWithMetadata(ast: MarkdownAST): Array<{
        table: TableNode;
        validation: { isValid: boolean; issues: string[] };
        boundaries: { startLine: number; endLine: number; actualContent: string[] };
        columnInfo: { index: number; header: string; alignment: string; width: number }[];
    }> {
        const tables = this.findTablesInDocument(ast);
        return tables.map(table => this.getTableMetadata(ast, table));
    }

    /**
     * Table manager for handling multiple tables in a document
     */
    createTableManager(ast: MarkdownAST): TableManager {
        return new TableManager(ast, this);
    }
}

/**
 * Manager class for handling multiple tables in a document
 */
export class TableManager {
    private tables: TableNode[];
    private ast: MarkdownAST;
    private parser: MarkdownParser;

    constructor(ast: MarkdownAST, parser: MarkdownParser) {
        this.ast = ast;
        this.parser = parser;
        this.tables = parser.findTablesInDocument(ast);
    }

    /**
     * Get all tables in the document
     */
    getAllTables(): TableNode[] {
        return [...this.tables];
    }

    /**
     * Get table by index
     */
    getTableByIndex(index: number): TableNode | null {
        return this.tables[index] || null;
    }

    /**
     * Find table at specific position
     */
    getTableAtPosition(position: vscode.Position): TableNode | null {
        return this.parser.findTableAtPosition(this.ast, position);
    }

    /**
     * Find table containing specific line
     */
    getTableAtLine(lineNumber: number): TableNode | null {
        return this.parser.findTableContainingLine(this.ast, lineNumber);
    }

    /**
     * Get table count
     */
    getTableCount(): number {
        return this.tables.length;
    }

    /**
     * Get tables with validation results
     */
    getTablesWithValidation(): Array<{
        index: number;
        table: TableNode;
        validation: { isValid: boolean; issues: string[] };
    }> {
        return this.tables.map((table, index) => ({
            index,
            table,
            validation: this.parser.validateTableStructure(table)
        }));
    }

    /**
     * Get summary of all tables
     */
    getTablesSummary(): {
        totalTables: number;
        validTables: number;
        invalidTables: number;
        totalRows: number;
        totalColumns: number;
        issues: string[];
    } {
        const validationResults = this.getTablesWithValidation();
        const validTables = validationResults.filter(result => result.validation.isValid).length;
        const invalidTables = validationResults.length - validTables;

        const totalRows = this.tables.reduce((sum, table) => sum + table.rows.length, 0);
        const totalColumns = this.tables.reduce((sum, table) => sum + table.headers.length, 0);

        const allIssues = validationResults
            .filter(result => !result.validation.isValid)
            .flatMap(result => result.validation.issues.map(issue => `Table ${result.index + 1}: ${issue}`));

        return {
            totalTables: this.tables.length,
            validTables,
            invalidTables,
            totalRows,
            totalColumns,
            issues: allIssues
        };
    }

    /**
     * Refresh tables after document changes
     */
    refresh(newAst: MarkdownAST): void {
        this.ast = newAst;
        this.tables = this.parser.findTablesInDocument(newAst);
    }

    /**
     * Find tables within a specific line range
     */
    getTablesInRange(startLine: number, endLine: number): TableNode[] {
        return this.tables.filter(table =>
            table.startLine >= startLine && table.endLine <= endLine
        );
    }

    /**
     * Get the closest table to a given line
     */
    getClosestTable(lineNumber: number): { table: TableNode; distance: number } | null {
        if (this.tables.length === 0) {
            return null;
        }

        let closestTable = this.tables[0];
        let minDistance = Math.min(
            Math.abs(lineNumber - closestTable.startLine),
            Math.abs(lineNumber - closestTable.endLine)
        );

        for (const table of this.tables) {
            const distance = Math.min(
                Math.abs(lineNumber - table.startLine),
                Math.abs(lineNumber - table.endLine)
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestTable = table;
            }
        }

        return { table: closestTable, distance: minDistance };
    }
}