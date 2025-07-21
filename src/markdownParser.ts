import * as MarkdownIt from 'markdown-it';

export interface MarkdownAST {
    tokens: any[];
    content: string;
}

export interface Position {
    line: number;
    character: number;
}

export interface TableNode {
    startLine: number;
    endLine: number;
    headers: string[];
    rows: string[][];
    alignment: ('left' | 'center' | 'right')[];
}

export class MarkdownParser {
    private md: MarkdownIt;

    constructor() {
        this.md = new MarkdownIt({
            html: true,
            linkify: true,
            typographer: true
        });
    }

    parseDocument(content: string): MarkdownAST {
        const tokens = this.md.parse(content, {});
        return {
            tokens,
            content
        };
    }

    findTablesInDocument(ast: MarkdownAST): TableNode[] {
        const tables: TableNode[] = [];
        const tokens = ast.tokens;
        const lines = ast.content.split('\n');

        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            if (token.type === 'table_open') {
                const tableNode = this.parseTableToken(tokens, i, lines);
                if (tableNode) {
                    tables.push(tableNode);
                }
            }
        }

        return tables;
    }    fin
dTableAtPosition(ast: MarkdownAST, position: Position): TableNode | null {
        const tables = this.findTablesInDocument(ast);
        
        for (const table of tables) {
            if (position.line >= table.startLine && position.line <= table.endLine) {
                return table;
            }
        }
        
        return null;
    }

    private parseTableToken(tokens: any[], startIndex: number, lines: string[]): TableNode | null {
        let i = startIndex;
        let headers: string[] = [];
        let rows: string[][] = [];
        let alignment: ('left' | 'center' | 'right')[] = [];
        let startLine = -1;
        let endLine = -1;

        // Find table boundaries
        while (i < tokens.length && tokens[i].type !== 'table_close') {
            const token = tokens[i];
            
            if (token.map && startLine === -1) {
                startLine = token.map[0];
            }
            
            if (token.type === 'thead_open') {
                i++;
                // Parse header row
                while (i < tokens.length && tokens[i].type !== 'thead_close') {
                    if (tokens[i].type === 'tr_open') {
                        i++;
                        const headerRow: string[] = [];
                        while (i < tokens.length && tokens[i].type !== 'tr_close') {
                            if (tokens[i].type === 'th_open') {
                                // Get alignment from style attribute
                                const style = tokens[i].attrGet?.('style') || '';
                                if (style.includes('text-align:center')) {
                                    alignment.push('center');
                                } else if (style.includes('text-align:right')) {
                                    alignment.push('right');
                                } else {
                                    alignment.push('left');
                                }
                                i++;
                                // Get header content
                                if (i < tokens.length && tokens[i].type === 'inline') {
                                    headerRow.push(tokens[i].content || '');
                                }
                            }
                            i++;
                        }
                        headers = headerRow;
                    }
                    i++;
                }
            } else if (token.type === 'tbody_open') {
                i++;
                // Parse body rows
                while (i < tokens.length && tokens[i].type !== 'tbody_close') {
                    if (tokens[i].type === 'tr_open') {
                        i++;
                        const row: string[] = [];
                        while (i < tokens.length && tokens[i].type !== 'tr_close') {
                            if (tokens[i].type === 'td_open') {
                                i++;
                                // Get cell content
                                if (i < tokens.length && tokens[i].type === 'inline') {
                                    row.push(tokens[i].content || '');
                                }
                            }
                            i++;
                        }
                        if (row.length > 0) {
                            rows.push(row);
                        }
                    }
                    i++;
                }
            }
            
            if (token.map) {
                endLine = token.map[1] - 1;
            }
            
            i++;
        }

        // If we couldn't get line numbers from tokens, try to find them in the content
        if (startLine === -1 || endLine === -1) {
            const tableLines = this.findTableLinesInContent(lines, headers, rows);
            if (tableLines) {
                startLine = tableLines.start;
                endLine = tableLines.end;
            }
        }

        if (headers.length === 0 || startLine === -1) {
            return null;
        }

        // Ensure alignment array matches header count
        while (alignment.length < headers.length) {
            alignment.push('left');
        }

        return {
            startLine,
            endLine: endLine === -1 ? startLine + rows.length + 1 : endLine,
            headers,
            rows,
            alignment
        };
    }

    private findTableLinesInContent(lines: string[], headers: string[], rows: string[][]): { start: number; end: number } | null {
        // Look for table pattern in content
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Check if this looks like a table header
            if (line.includes('|') && headers.length > 0) {
                const lineCells = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);
                
                // Simple heuristic: if the line contains similar content to our headers
                if (lineCells.length === headers.length) {
                    let matches = 0;
                    for (let j = 0; j < headers.length; j++) {
                        if (lineCells[j].includes(headers[j]) || headers[j].includes(lineCells[j])) {
                            matches++;
                        }
                    }
                    
                    if (matches >= headers.length / 2) {
                        // Found likely start, now find end
                        let endLine = i;
                        for (let k = i + 1; k < lines.length; k++) {
                            if (lines[k].trim().includes('|')) {
                                endLine = k;
                            } else if (lines[k].trim() === '') {
                                break;
                            } else {
                                break;
                            }
                        }
                        
                        return { start: i, end: endLine };
                    }
                }
            }
        }
        
        return null;
    }
}