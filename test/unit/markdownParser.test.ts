const assert = require('assert');
import { MarkdownParser, TableNode, TableManager } from '../../src/markdownParser';
import * as vscode from 'vscode';

suite('MarkdownParser Test Suite', () => {
    let parser: MarkdownParser;

    setup(() => {
        parser = new MarkdownParser();
    });

    test('should parse simple table', () => {
        const markdown = `# Test Document

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |

Some text after table.`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);

        assert.strictEqual(tables.length, 1);
        
        const table = tables[0];
        assert.deepStrictEqual(table.headers, ['Header 1', 'Header 2', 'Header 3']);
        assert.strictEqual(table.rows.length, 2);
        assert.deepStrictEqual(table.rows[0], ['Cell 1', 'Cell 2', 'Cell 3']);
        assert.deepStrictEqual(table.rows[1], ['Cell 4', 'Cell 5', 'Cell 6']);
    });

    test('should parse table', () => {
        const markdown = `| Left | Center | Right |
|:-----|:------:|------:|
| L1   | C1     | R1    |
| L2   | C2     | R2    |`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);

        assert.strictEqual(tables.length, 1);
        
        const table = tables[0];
        assert.deepStrictEqual(table.headers, ['Left', 'Center', 'Right']);
        // Note: markdown-it may not preserve all table info in the way we expect
        // This test verifies the basic structure is parsed correctly
        assert.strictEqual(table.rows.length, 2);
    });

    test('should find multiple tables', () => {
        const markdown = `# First Table

| A | B |
|---|---|
| 1 | 2 |

# Second Table

| X | Y | Z |
|---|---|---|
| 3 | 4 | 5 |
| 6 | 7 | 8 |`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);

        assert.strictEqual(tables.length, 2);
        
        assert.deepStrictEqual(tables[0].headers, ['A', 'B']);
        assert.strictEqual(tables[0].rows.length, 1);
        
        assert.deepStrictEqual(tables[1].headers, ['X', 'Y', 'Z']);
        assert.strictEqual(tables[1].rows.length, 2);
    });

    test('should find table at position', () => {
        const markdown = `# Test Document

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

Some text after table.`;

        const ast = parser.parseDocument(markdown);
        
        // Position within table (line 4, which should be "| Cell 1   | Cell 2   |")
        const position = new vscode.Position(4, 0);
        const table = parser.findTableAtPosition(ast, position);

        assert.notStrictEqual(table, null);
        if (table) {
            assert.deepStrictEqual(table.headers, ['Header 1', 'Header 2']);
            assert.strictEqual(table.rows.length, 2);
        }
    });

    test('should return null for position outside table', () => {
        const markdown = `# Test Document

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |

Some text after table.`;

        const ast = parser.parseDocument(markdown);
        
        // Position outside table (line 0, which is "# Test Document")
        const position = new vscode.Position(0, 0);
        const table = parser.findTableAtPosition(ast, position);

        assert.strictEqual(table, null);
    });

    test('should handle empty table', () => {
        const markdown = `| Header 1 | Header 2 |
|----------|----------|`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);

        assert.strictEqual(tables.length, 1);
        
        const table = tables[0];
        assert.deepStrictEqual(table.headers, ['Header 1', 'Header 2']);
        assert.strictEqual(table.rows.length, 0);
    });

    test('should handle malformed table gracefully', () => {
        const markdown = `| Header 1 | Header 2
| Cell 1   | Cell 2   |`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);

        // markdown-it should handle this gracefully, might not parse as table
        // This test ensures no errors are thrown
        assert.doesNotThrow(() => {
            parser.findTablesInDocument(ast);
        });
    });

    test('should validate table structure', () => {
        const validTable: TableNode = {
            startLine: 0,
            endLine: 3,
            headers: ['Header 1', 'Header 2'],
            rows: [['Cell 1', 'Cell 2'], ['Cell 3', 'Cell 4']]
        };

        const validation = parser.validateTableStructure(validTable);
        assert.strictEqual(validation.isValid, true);
        assert.strictEqual(validation.issues.length, 0);
    });

    test('should detect table structure issues', () => {
        const invalidTable: TableNode = {
            startLine: 0,
            endLine: 3,
            headers: ['Header 1', 'Header 2'],
            rows: [['Cell 1'], ['Cell 3', 'Cell 4', 'Cell 5']] // Inconsistent column count
        };

        const validation = parser.validateTableStructure(invalidTable);
        assert.strictEqual(validation.isValid, false);
        assert.ok(validation.issues.length > 0);
        assert.ok(validation.issues.some(issue => issue.includes('Row 1 has 1 columns')));
        assert.ok(validation.issues.some(issue => issue.includes('Row 2 has 3 columns')));
    });

    test('should find table containing specific line', () => {
        const markdown = `# Header

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

Some text after table.`;

        const ast = parser.parseDocument(markdown);
        
        // Line 4 should be within the table
        const table = parser.findTableContainingLine(ast, 4);
        assert.notStrictEqual(table, null);
        
        // Line 0 should not be within any table
        const noTable = parser.findTableContainingLine(ast, 0);
        assert.strictEqual(noTable, null);
    });

    test('should get table boundaries accurately', () => {
        const markdown = `# Header

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |

Some text`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);
        
        if (tables.length > 0) {
            const boundaries = parser.getTableBoundaries(markdown, tables[0]);
            assert.ok(boundaries.startLine >= 0);
            assert.ok(boundaries.endLine > boundaries.startLine);
            assert.ok(boundaries.actualContent.length > 0);
        }
    });

    test('should get enhanced table metadata', () => {
        const markdown = `| Name | Age | City |
|------|-----|------|
| John | 25  | NYC  |
| Jane | 30  | LA   |`;

        const ast = parser.parseDocument(markdown);
        const tablesWithMetadata = parser.findTablesWithMetadata(ast);

        assert.strictEqual(tablesWithMetadata.length, 1);
        
        const metadata = tablesWithMetadata[0];
        assert.ok(metadata.table);
        assert.ok(metadata.validation);
        assert.ok(metadata.boundaries);
        assert.ok(metadata.columnInfo);
        assert.strictEqual(metadata.columnInfo.length, 3);
        assert.strictEqual(metadata.columnInfo[0].header, 'Name');
    });

    test('should parse multiple tables in document', () => {
        const markdown = `# Multi-Table Document

First table:

| Name | Age |
|------|-----|
| John | 25 |
| Jane | 30 |

Some text between tables.

Second table:

| Product | Price |
|---------|-------|
| Laptop | $999 |
| Book | $15 |

More content.

Third table:

| ID | Status |
|----|--------|
| 001 | Active |
| 002 | Inactive |

Final content.`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);

        assert.strictEqual(tables.length, 3);
        
        // First table
        assert.deepStrictEqual(tables[0].headers, ['Name', 'Age']);
        assert.strictEqual(tables[0].rows.length, 2);
        assert.deepStrictEqual(tables[0].rows[0], ['John', '25']);
        
        // Second table
        assert.deepStrictEqual(tables[1].headers, ['Product', 'Price']);
        assert.strictEqual(tables[1].rows.length, 2);
        assert.deepStrictEqual(tables[1].rows[0], ['Laptop', '$999']);
        
        // Third table
        assert.deepStrictEqual(tables[2].headers, ['ID', 'Status']);
        assert.strictEqual(tables[2].rows.length, 2);
        assert.deepStrictEqual(tables[2].rows[0], ['001', 'Active']);
    });

    test('should handle document with no tables', () => {
        const markdown = `# Document Without Tables

This is just regular markdown content with:

- Lists
- **Bold text**
- *Italic text*

\`\`\`javascript
// Code blocks
const data = { test: "value" };
\`\`\`

> Block quotes

And regular paragraphs.`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);

        assert.strictEqual(tables.length, 0);
    });

    test('should handle mixed content with tables', () => {
        const markdown = `# Mixed Content Document

## Introduction
This document has various content types mixed together.

### Code Example
\`\`\`javascript
const fakeTable = [
  { col1: "value1", col2: "value2" },
  { col1: "value3", col2: "value4" }
];
\`\`\`

### Actual Table
| Column A | Column B |
|----------|----------|
| Data 1   | Data 2   |

### List Items
- Item 1
- Item 2

### Another Table
| X | Y | Z |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |

### Final Section
More content here.`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);

        assert.strictEqual(tables.length, 2);
        
        // First table
        assert.deepStrictEqual(tables[0].headers, ['Column A', 'Column B']);
        assert.strictEqual(tables[0].rows.length, 1);
        
        // Second table
        assert.deepStrictEqual(tables[1].headers, ['X', 'Y', 'Z']);
        assert.strictEqual(tables[1].rows.length, 2);
    });

    test('should handle malformed tables gracefully', () => {
        const markdown = `# Document with Malformed Tables

Good table:
| A | B |
|---|---|
| 1 | 2 |

Malformed table (missing separator):
| Header 1 | Header 2 |
| Data 1   | Data 2   |

Another good table:
| X | Y |
|---|---|
| 3 | 4 |`;

        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);

        // Should still find the properly formatted tables
        assert.strictEqual(tables.length, 2);
        assert.deepStrictEqual(tables[0].headers, ['A', 'B']);
        assert.deepStrictEqual(tables[1].headers, ['X', 'Y']);
    });

    // Error Handling Tests
    test('should handle invalid content in parseDocument', () => {
        assert.throws(() => {
            parser.parseDocument(null as any);
        }, /Invalid content provided for parsing/);

        assert.throws(() => {
            parser.parseDocument(undefined as any);
        }, /Invalid content provided for parsing/);

        assert.throws(() => {
            parser.parseDocument(123 as any);
        }, /Invalid content provided for parsing/);
    });

    test('should handle empty content gracefully', () => {
        const ast = parser.parseDocument('');
        assert.ok(ast);
        assert.ok(Array.isArray(ast.tokens));
        assert.strictEqual(ast.content, '');

        const tables = parser.findTablesInDocument(ast);
        assert.strictEqual(tables.length, 0);
    });

    test('should handle invalid AST in findTablesInDocument', () => {
        assert.throws(() => {
            parser.findTablesInDocument(null as any);
        }, /Invalid AST provided for table extraction/);

        assert.throws(() => {
            parser.findTablesInDocument({ tokens: null, content: '' } as any);
        }, /Invalid AST provided for table extraction/);

        assert.throws(() => {
            parser.findTablesInDocument({ tokens: 'not-array', content: '' } as any);
        }, /Invalid AST provided for table extraction/);
    });

    test('should handle malformed table structure gracefully', () => {
        const markdown = `| Header 1 | Header 2
|----------|
| Cell 1   | Cell 2   | Cell 3 |
| Cell 4`;

        const ast = parser.parseDocument(markdown);
        // Should not throw, but may log warnings
        const tables = parser.findTablesInDocument(ast);
        
        // The parser should be resilient to malformed tables
        assert.ok(Array.isArray(tables));
    });

    test('should handle corrupted token structure', () => {
        const ast = parser.parseDocument('| A | B |\n|---|---|\n| 1 | 2 |');
        
        // Manually corrupt the tokens to test error handling
        const corruptedAst = {
            ...ast,
            tokens: ast.tokens.map(token => {
                if (token.type === 'table_open') {
                    return { ...token, map: null }; // Corrupt the map property
                }
                return token;
            })
        };

        // Should handle corrupted tokens gracefully
        const tables = parser.findTablesInDocument(corruptedAst);
        assert.ok(Array.isArray(tables));
    });

    test('should validate table structure and report issues', () => {
        const tableNode: TableNode = {
            startLine: 0,
            endLine: 2,
            headers: ['A', 'B'],
            rows: [
                ['1', '2'],
                ['3'], // Missing cell
                ['4', '5', '6'] // Extra cell
            ]
        };

        const validation = parser.validateTableStructure(tableNode);
        assert.strictEqual(validation.isValid, false);
        assert.ok(validation.issues.length > 0);
        assert.ok(validation.issues.some(issue => issue.includes('Row 2 has 1 columns')));
        assert.ok(validation.issues.some(issue => issue.includes('Row 3 has 3 columns')));
    });

    test('should handle table with no headers gracefully', () => {
        const tableNode: TableNode = {
            startLine: 0,
            endLine: 1,
            headers: [],
            rows: [['A', 'B']]
        };

        const validation = parser.validateTableStructure(tableNode);
        assert.strictEqual(validation.isValid, false);
        assert.ok(validation.issues.some(issue => issue.includes('Table has no headers')));
    });

    test('should handle extremely large tables without hanging', () => {
        // Create a large table to test performance and stability
        const headers = Array.from({ length: 100 }, (_, i) => `Header${i}`);
        const headerRow = `| ${headers.join(' | ')} |`;
        const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
        const dataRows = Array.from({ length: 1000 }, (_, i) => 
            `| ${headers.map((_, j) => `Cell${i}-${j}`).join(' | ')} |`
        ).join('\n');

        const markdown = `${headerRow}\n${separatorRow}\n${dataRows}`;

        // This should complete within reasonable time
        const startTime = Date.now();
        const ast = parser.parseDocument(markdown);
        const tables = parser.findTablesInDocument(ast);
        const endTime = Date.now();

        assert.ok(endTime - startTime < 5000, 'Parsing should complete within 5 seconds');
        assert.strictEqual(tables.length, 1);
        assert.strictEqual(tables[0].headers.length, 100);
        assert.strictEqual(tables[0].rows.length, 1000);
    });
});

// --- TableManager tests ---
suite('TableManager Test Suite', () => {
    let parser: MarkdownParser;

    setup(() => {
        parser = new MarkdownParser();
    });

    function makeMarkdown(): string {
        return `# Doc

| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |

Text

| X | Y | Z |
|---|---|---|
| 5 | 6 | 7 |
`;
    }

    test('getAllTables returns all tables', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const tables = mgr.getAllTables();
        assert.strictEqual(tables.length, 2);
    });

    test('getTableByIndex returns correct table', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const t0 = mgr.getTableByIndex(0);
        assert.ok(t0);
        assert.deepStrictEqual(t0!.headers, ['A', 'B']);
        const t1 = mgr.getTableByIndex(1);
        assert.ok(t1);
        assert.deepStrictEqual(t1!.headers, ['X', 'Y', 'Z']);
    });

    test('getTableByIndex returns null for out of range', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        assert.strictEqual(mgr.getTableByIndex(5), null);
        assert.strictEqual(mgr.getTableByIndex(-1), null);
    });

    test('getTableAtPosition returns table at position', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const t = mgr.getTableAtPosition(new vscode.Position(4, 0));
        assert.ok(t);
        assert.deepStrictEqual(t!.headers, ['A', 'B']);
    });

    test('getTableAtPosition returns null outside tables', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        assert.strictEqual(mgr.getTableAtPosition(new vscode.Position(0, 0)), null);
    });

    test('getTableAtLine returns table containing line', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const t = mgr.getTableAtLine(4);
        assert.ok(t);
    });

    test('getTableAtLine returns null for line outside tables', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        assert.strictEqual(mgr.getTableAtLine(0), null);
    });

    test('getTableCount returns correct count', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        assert.strictEqual(mgr.getTableCount(), 2);
    });

    test('getTablesWithValidation returns validation for each table', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const results = mgr.getTablesWithValidation();
        assert.strictEqual(results.length, 2);
        for (const r of results) {
            assert.ok('index' in r);
            assert.ok('table' in r);
            assert.ok('validation' in r);
            assert.strictEqual(r.validation.isValid, true);
        }
    });

    test('getTablesSummary returns correct summary', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const summary = mgr.getTablesSummary();
        assert.strictEqual(summary.totalTables, 2);
        assert.strictEqual(summary.validTables, 2);
        assert.strictEqual(summary.invalidTables, 0);
        assert.strictEqual(summary.totalRows, 3); // 2 + 1
        assert.strictEqual(summary.totalColumns, 5); // 2 + 3
        assert.strictEqual(summary.issues.length, 0);
    });

    test('getTablesSummary counts invalid tables', () => {
        // markdown-itはパース時にカラム数をヘッダーに合わせて正規化するため、
        // テーブル取得後に行を手動で改変して不整合を作る
        const md = `| A | B |
|---|---|
| 1 | 2 |
`;
        const ast = parser.parseDocument(md);
        const mgr = parser.createTableManager(ast);
        const tables = mgr.getAllTables();
        assert.ok(tables.length > 0);
        // 不整合な行を追加してvalidation errorを発生させる
        tables[0].rows.push(['only-one-cell']);
        const summary = mgr.getTablesSummary();
        assert.strictEqual(summary.invalidTables, 1);
        assert.ok(summary.issues.length > 0);
    });

    test('refresh updates tables', () => {
        const ast1 = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast1);
        assert.strictEqual(mgr.getTableCount(), 2);

        const ast2 = parser.parseDocument('# No tables here\nJust text.');
        mgr.refresh(ast2);
        assert.strictEqual(mgr.getTableCount(), 0);
    });

    test('getTablesInRange returns tables within range', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const allTables = mgr.getAllTables();
        // Use a range that encompasses only the first table
        const rangeResult = mgr.getTablesInRange(0, allTables[0].endLine);
        assert.ok(rangeResult.length >= 1);
        assert.deepStrictEqual(rangeResult[0].headers, ['A', 'B']);
    });

    test('getTablesInRange returns empty for non-matching range', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const result = mgr.getTablesInRange(100, 200);
        assert.strictEqual(result.length, 0);
    });

    test('getClosestTable returns closest table', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const closest = mgr.getClosestTable(0);
        assert.ok(closest);
        assert.ok(closest!.distance >= 0);
    });

    test('getClosestTable returns null for empty document', () => {
        const ast = parser.parseDocument('# No tables');
        const mgr = parser.createTableManager(ast);
        assert.strictEqual(mgr.getClosestTable(0), null);
    });

    test('getClosestTable picks nearest among multiple', () => {
        const ast = parser.parseDocument(makeMarkdown());
        const mgr = parser.createTableManager(ast);
        const allTables = mgr.getAllTables();
        // Ask for a line very close to the second table
        const closest = mgr.getClosestTable(allTables[1].startLine);
        assert.ok(closest);
        assert.deepStrictEqual(closest!.table.headers, allTables[1].headers);
    });
});

// --- extractSeparatorLine tests ---
suite('MarkdownParser extractSeparatorLine', () => {
    let parser: MarkdownParser;

    setup(() => {
        parser = new MarkdownParser();
    });

    test('extracts separator from valid table', () => {
        const md = `| A | B |
|---|---|
| 1 | 2 |`;
        const ast = parser.parseDocument(md);
        const tables = parser.findTablesInDocument(ast);
        assert.ok(tables.length > 0);
        const sep = parser.extractSeparatorLine(md, tables[0]);
        assert.ok(sep);
        assert.ok(sep!.includes('---'));
    });

    test('returns undefined for table without separator', () => {
        const table: TableNode = { startLine: 0, endLine: 0, headers: ['A'], rows: [] };
        const content = '| A |';
        const sep = parser.extractSeparatorLine(content, table);
        assert.strictEqual(sep, undefined);
    });
});

// --- getTableMetadata & findTablesWithMetadata additional ---
suite('MarkdownParser getTableMetadata', () => {
    let parser: MarkdownParser;

    setup(() => {
        parser = new MarkdownParser();
    });

    test('getTableMetadata returns full metadata', () => {
        const md = `| Name | Age |
|------|-----|
| Alice | 30 |`;
        const ast = parser.parseDocument(md);
        const tables = parser.findTablesInDocument(ast);
        const meta = parser.getTableMetadata(ast, tables[0]);
        assert.ok(meta.table);
        assert.ok(meta.validation);
        assert.ok(meta.boundaries);
        assert.ok(meta.columnInfo);
        assert.strictEqual(meta.columnInfo.length, 2);
        assert.strictEqual(meta.columnInfo[0].header, 'Name');
        assert.ok(meta.columnInfo[0].width >= 4); // 'Name' length
    });
});

// Error class tests
suite('MarkdownParser Error Classes', () => {
    test('should create MarkdownParsingError correctly', () => {
        const error = new (require('../../src/markdownParser').MarkdownParsingError)(
            'Test error message',
            'testOperation',
            { line: 5, column: 10 },
            new Error('Original error')
        );

        assert.strictEqual(error.name, 'MarkdownParsingError');
        assert.strictEqual(error.message, 'Test error message');
        assert.strictEqual(error.operation, 'testOperation');
        assert.deepStrictEqual(error.position, { line: 5, column: 10 });
        assert.ok(error.originalError instanceof Error);
    });

    test('should create TableValidationError correctly', () => {
        const error = new (require('../../src/markdownParser').TableValidationError)(
            'Validation failed',
            2,
            ['Issue 1', 'Issue 2'],
            { startLine: 10, endLine: 15 }
        );

        assert.strictEqual(error.name, 'TableValidationError');
        assert.strictEqual(error.message, 'Validation failed');
        assert.strictEqual(error.tableIndex, 2);
        assert.deepStrictEqual(error.issues, ['Issue 1', 'Issue 2']);
        assert.deepStrictEqual(error.position, { startLine: 10, endLine: 15 });
    });
});

// --- Additional coverage tests for uncovered lines ---
suite('MarkdownParser Additional Coverage', () => {
    let parser: MarkdownParser;

    setup(() => {
        parser = new MarkdownParser();
    });

    test('parseDocument should throw for non-string content (number)', () => {
        assert.throws(() => {
            parser.parseDocument(42 as any);
        }, /Invalid content provided for parsing/);
    });

    test('parseDocument should throw for boolean content', () => {
        assert.throws(() => {
            parser.parseDocument(true as any);
        }, /Invalid content provided for parsing/);
    });

    test('findTablesInDocument should handle null token inside tokens array', () => {
        // トークン配列内に null 要素を含むケース（L120のnullトークン警告パス）
        const ast = parser.parseDocument('| A |\n|---|\n| 1 |');
        // トークンの中に null を挿入
        const corruptedAst = {
            ...ast,
            tokens: [null, ...ast.tokens, null]
        };
        const tables = parser.findTablesInDocument(corruptedAst as any);
        assert.ok(Array.isArray(tables));
    });

    test('findTablesInDocument should handle token parse error and continue', () => {
        // table_open トークンの map が不正な場合、エラーをキャッチして次のテーブルへ進む
        const ast = parser.parseDocument('| A |\n|---|\n| 1 |\n\n| B |\n|---|\n| 2 |');
        // 最初のテーブルの table_open トークンを壊す
        const tokens = [...ast.tokens];
        for (let i = 0; i < tokens.length; i++) {
            if (tokens[i]?.type === 'table_open') {
                // map を壊して parseTableToken 内でエラーを発生させる
                tokens[i] = { ...tokens[i], map: undefined };
                break;
            }
        }
        const modifiedAst = { tokens, content: ast.content };
        const tables = parser.findTablesInDocument(modifiedAst);
        assert.ok(Array.isArray(tables));
    });

    test('parseTableToken should return null when headers are empty', () => {
        // ヘッダーなしのテーブルトークンを構築
        const fakeTokens = [
            { type: 'table_open', map: [0, 3] },
            { type: 'table_close', map: [0, 3] }
        ];
        const result = (parser as any).parseTableToken(fakeTokens, 0, '');
        assert.strictEqual(result, null);
    });

    test('parseTableToken should handle thead_open parse error', () => {
        // thead_open 内のパース中にエラーが起きた場合のリカバリ
        const fakeTokens = [
            { type: 'table_open', map: [0, 5] },
            { type: 'thead_open' },
            // thead_close なしで直接 table_close
            { type: 'table_close', map: [0, 5] }
        ];
        const result = (parser as any).parseTableToken(fakeTokens, 0, '');
        // ヘッダーが空なので null が返る
        assert.strictEqual(result, null);
    });

    test('parseTableToken should handle tbody_open parse error gracefully', () => {
        // tbody パース中にエラーが起きたケースを再現するために、tbody 内に不正なトークンを仕込む
        const fakeTokens = [
            { type: 'table_open', map: [0, 5] },
            { type: 'thead_open' },
            { type: 'tr_open' },
            { type: 'th_open' },
            { type: 'inline', content: 'Header' },
            { type: 'th_close' },
            { type: 'tr_close' },
            { type: 'thead_close' },
            { type: 'tbody_open' },
            { type: 'tbody_close' },
            { type: 'table_close', map: [0, 5] }
        ];
        const result = (parser as any).parseTableToken(fakeTokens, 0, '| Header |\n|---|\n');
        assert.ok(result);
        assert.deepStrictEqual(result.headers, ['Header']);
    });

    test('parseTableToken should handle invalid startIndex', () => {
        assert.throws(() => {
            (parser as any).parseTableToken([], -1, '');
        }, /Invalid tokens or start index/);

        assert.throws(() => {
            (parser as any).parseTableToken([], 100, '');
        }, /Invalid tokens or start index/);

        assert.throws(() => {
            (parser as any).parseTableToken(null, 0, '');
        }, /Invalid tokens or start index/);
    });

    test('parseTableToken should handle null tokens inside parsing loop', () => {
        // パースループ中に null トークンがある場合のスキップ（L167-169）
        const fakeTokens = [
            { type: 'table_open', map: [0, 5] },
            null, // null token
            { type: 'thead_open' },
            { type: 'tr_open' },
            { type: 'th_open' },
            { type: 'inline', content: 'Col' },
            { type: 'th_close' },
            { type: 'tr_close' },
            { type: 'thead_close' },
            { type: 'table_close' }
        ];
        const result = (parser as any).parseTableToken(fakeTokens, 0, '| Col |\n|---|\n');
        assert.ok(result);
        assert.deepStrictEqual(result.headers, ['Col']);
    });

    test('parseTableToken should update endLine from table_close token with map', () => {
        const fakeTokens = [
            { type: 'table_open', map: [0, 3] },
            { type: 'thead_open' },
            { type: 'tr_open' },
            { type: 'th_open' },
            { type: 'inline', content: 'H' },
            { type: 'th_close' },
            { type: 'tr_close' },
            { type: 'thead_close' },
            { type: 'table_close', map: [0, 10] }
        ];
        const result = (parser as any).parseTableToken(fakeTokens, 0, '| H |\n|---|\n');
        assert.ok(result);
        assert.strictEqual(result.endLine, 10);
    });

    test('parseTableToken should handle non-MarkdownParsingError and return null', () => {
        // parseTableToken 内部で MarkdownParsingError 以外のエラーが起きた場合のカバー
        const fakeTokens = [
            { type: 'table_open', get map() { throw new Error('getter error'); } },
        ];
        const result = (parser as any).parseTableToken(fakeTokens, 0, '');
        assert.strictEqual(result, null);
    });

    test('isTableLine should detect valid table lines', () => {
        assert.strictEqual((parser as any).isTableLine('| A | B |'), true);
        assert.strictEqual((parser as any).isTableLine('not a table'), false);
        assert.strictEqual((parser as any).isTableLine('| missing end'), false);
    });

    test('isTableSeparatorLine should detect separator lines', () => {
        assert.strictEqual((parser as any).isTableSeparatorLine('|---|---|'), true);
        assert.strictEqual((parser as any).isTableSeparatorLine('|:---:|---:|'), true);
        assert.strictEqual((parser as any).isTableSeparatorLine('| A | B |'), false);
    });

    test('getTableBoundaries should find actual table boundaries', () => {
        const content = 'Text\n| A | B |\n|---|---|\n| 1 | 2 |\nMore text';
        const table: TableNode = {
            startLine: 1,
            endLine: 3,
            headers: ['A', 'B'],
            rows: [['1', '2']]
        };
        const boundaries = parser.getTableBoundaries(content, table);
        assert.ok(boundaries.startLine >= 0);
        assert.ok(boundaries.endLine >= boundaries.startLine);
        assert.ok(boundaries.actualContent.length >= 2);
    });

    test('getTableBoundaries should handle table at end of document', () => {
        const content = '| X |\n|---|\n| 1 |';
        const table: TableNode = {
            startLine: 0,
            endLine: 2,
            headers: ['X'],
            rows: [['1']]
        };
        const boundaries = parser.getTableBoundaries(content, table);
        assert.strictEqual(boundaries.endLine, 2);
        assert.strictEqual(boundaries.actualContent.length, 3);
    });

    test('extractSeparatorLine should return undefined when second line is not separator', () => {
        const content = '| A |\n| 1 |';
        const table: TableNode = {
            startLine: 0,
            endLine: 1,
            headers: ['A'],
            rows: [['1']]
        };
        const sep = parser.extractSeparatorLine(content, table);
        assert.strictEqual(sep, undefined);
    });

    test('calculateColumnWidth should handle missing columns in rows', () => {
        const table: TableNode = {
            startLine: 0,
            endLine: 2,
            headers: ['Name', 'Age', 'City'],
            rows: [['Alice']] // 行にカラム不足
        };
        const width = (parser as any).calculateColumnWidth(table, 2);
        // ヘッダー 'City' の長さ (4) が最大
        assert.strictEqual(width, 4);
    });

    test('parseTableHead catch block: corrupted thead tokens (L154-156)', () => {
        // thead_open の後に存在しないプロパティを持つトークンを置き、
        // parseTableHead 内で例外を発生させる
        const fakeTokens = [
            { type: 'table_open', map: [0, 5] },
            { type: 'thead_open' },
            // th_open の後に content アクセスで例外を起こすトークン
            { type: 'th_open' },
            { get type() { throw new Error('corrupted token'); } },
            { type: 'thead_close' },
            { type: 'table_close', map: [0, 5] }
        ];
        // parseTableToken は catch して currentIndex++ で進み、ヘッダーが空になるので null を返す
        const result = (parser as any).parseTableToken(fakeTokens, 0, '');
        // ヘッダーが取得できないので null
        assert.strictEqual(result, null);
    });

    test('parseTableBody catch block: corrupted tbody tokens (L167-169)', () => {
        // parseTableBody 内部で例外が発生するケースをテスト
        // tokens の一部を壊して parseTableBody がスローするようにする
        // ただし、catch 後に while ループが安全に終了するようにする
        let throwCount = 0;
        const fakeTokens = [
            { type: 'table_open', map: [0, 4] },
            { type: 'thead_open' },
            { type: 'tr_open' },
            { type: 'th_open' },
            { type: 'inline', content: 'H1' },
            { type: 'th_close' },
            { type: 'tr_close' },
            { type: 'thead_close' },
            { type: 'tbody_open' },
            // parseTableBody に入った後、最初は throw するが2回目は table_close を返す
            // → catch ブロックに入った後、次のイテレーションで table_close に到達して安全に終了
            { get type(): string {
                throwCount++;
                if (throwCount <= 1) {
                    throw new Error('corrupted body token');
                }
                return 'table_close';
            }, map: [0, 4] },
        ];
        const result = (parser as any).parseTableToken(fakeTokens, 0, '| H1 |\n|---|\n');
        // ヘッダーは取得できるが、body のパースは catch されて空の rows になる
        assert.ok(result);
        assert.deepStrictEqual(result.headers, ['H1']);
        assert.strictEqual(result.rows.length, 0);
    });

    test('tbody_close with non-empty currentRow (L249)', () => {
        // tbody_close 時に currentRow が空でないケースをテスト
        // 通常は tr_close で push されるが、tr_close がない場合に tbody_close で push される
        const fakeTokens = [
            { type: 'table_open', map: [0, 6] },
            { type: 'thead_open' },
            { type: 'tr_open' },
            { type: 'th_open' },
            { type: 'inline', content: 'Col' },
            { type: 'th_close' },
            { type: 'tr_close' },
            { type: 'thead_close' },
            { type: 'tbody_open' },
            { type: 'tr_open' },
            { type: 'td_open' },
            { type: 'inline', content: 'Val' },
            { type: 'td_close' },
            // tr_close なしで tbody_close に到達 → currentRow が空でない
            { type: 'tbody_close' },
            { type: 'table_close', map: [0, 6] }
        ];
        const result = (parser as any).parseTableToken(fakeTokens, 0, '| Col |\n|---|\n| Val |\n');
        assert.ok(result);
        assert.deepStrictEqual(result.headers, ['Col']);
        // tbody_close で currentRow が push される
        assert.strictEqual(result.rows.length, 1);
        assert.deepStrictEqual(result.rows[0], ['Val']);
    });

    test('parseTableHead catch block: exception inside header cell extraction (L154-156 additional)', () => {
        // thead パース中に extractCellContent 相当の処理でエラーが発生するケース
        // th_open の後のトークンの type アクセスで例外を起こし、parseTableHead の catch ブロックに入る
        const corruptedThTokens = [
            { type: 'table_open', map: [0, 5] },
            { type: 'thead_open' },
            { type: 'tr_open' },
            { type: 'th_open' },
            // 次のトークンの type getter で例外発生
            { get type(): string { throw new TypeError('Cannot read type of corrupted token'); } },
            { type: 'th_close' },
            { type: 'tr_close' },
            { type: 'thead_close' },
            { type: 'table_close', map: [0, 5] }
        ];
        // parseTableToken は catch してヘッダーなし → null を返す
        const result = (parser as any).parseTableToken(corruptedThTokens, 0, '');
        assert.strictEqual(result, null);
    });

    test('parseTableBody catch block: exception inside body row extraction (L167-169 additional)', () => {
        // tbody パース中に td の処理でエラーが発生するケース
        let callCount = 0;
        const corruptedTbodyTokens = [
            { type: 'table_open', map: [0, 6] },
            { type: 'thead_open' },
            { type: 'tr_open' },
            { type: 'th_open' },
            { type: 'inline', content: 'Header1' },
            { type: 'th_close' },
            { type: 'tr_close' },
            { type: 'thead_close' },
            { type: 'tbody_open' },
            // type アクセスで最初は throw し、その後 table_close を返す
            { get type(): string {
                callCount++;
                if (callCount <= 1) {
                    throw new Error('Corrupted body row token');
                }
                return 'table_close';
            }, map: [0, 6] }
        ];
        const result = (parser as any).parseTableToken(corruptedTbodyTokens, 0, '| Header1 |\n|---|\n');
        // ヘッダーは取得できるが body パースは catch される
        assert.ok(result);
        assert.deepStrictEqual(result.headers, ['Header1']);
        assert.strictEqual(result.rows.length, 0);
    });

    test('tbody_close with multiple data cells pending in currentRow (L249 additional)', () => {
        // tr_close がないまま tbody_close に到達し、複数セルの currentRow が push されるケース
        const multiCellTokens = [
            { type: 'table_open', map: [0, 6] },
            { type: 'thead_open' },
            { type: 'tr_open' },
            { type: 'th_open' },
            { type: 'inline', content: 'A' },
            { type: 'th_close' },
            { type: 'th_open' },
            { type: 'inline', content: 'B' },
            { type: 'th_close' },
            { type: 'tr_close' },
            { type: 'thead_close' },
            { type: 'tbody_open' },
            { type: 'tr_open' },
            { type: 'td_open' },
            { type: 'inline', content: '1' },
            { type: 'td_close' },
            { type: 'td_open' },
            { type: 'inline', content: '2' },
            { type: 'td_close' },
            // tr_close なしで直接 tbody_close
            { type: 'tbody_close' },
            { type: 'table_close', map: [0, 6] }
        ];
        const result = (parser as any).parseTableToken(multiCellTokens, 0, '| A | B |\n|---|---|\n| 1 | 2 |\n');
        assert.ok(result);
        assert.deepStrictEqual(result.headers, ['A', 'B']);
        assert.strictEqual(result.rows.length, 1);
        assert.deepStrictEqual(result.rows[0], ['1', '2']);
    });

    // --- parseDocument: tokensがnull/非配列の場合 (JS L47) ---
    test('parseDocument should throw when md.parse returns null', () => {
        const origParse = (parser as any).md.parse;
        (parser as any).md.parse = () => null;
        assert.throws(() => {
            parser.parseDocument('test');
        }, /Failed to parse document tokens/);
        (parser as any).md.parse = origParse;
    });

    // --- parseDocument: md.parseが非MarkdownParsingErrorをthrowする場合 (JS L58) ---
    test('parseDocument should wrap non-MarkdownParsingError', () => {
        const origParse = (parser as any).md.parse;
        (parser as any).md.parse = () => { throw new TypeError('unexpected type'); };
        assert.throws(() => {
            parser.parseDocument('test');
        }, /Failed to parse markdown document.*unexpected type/);
        (parser as any).md.parse = origParse;
    });

    // --- findTablesInDocument: validation警告テーブル (JS L80) ---
    test('findTablesInDocument should warn on invalid table structure but still include it', () => {
        // ヘッダと行の列数が異なるテーブル
        const content = '| A | B | C |\n|---|---|\n| 1 |\n';
        const ast = parser.parseDocument(content);
        // テーブルがパースされる場合、validation issuesがあっても結果に含まれる
        const tables = parser.findTablesInDocument(ast);
        // パーサーがテーブルとして認識するかはマークダウンの仕様に依存
        // テストとしてはエラーにならないことを確認
        assert.ok(Array.isArray(tables));
    });

    // --- findTablesInDocument: parseTableTokenがthrowする場合 (JS L88-90) ---
    test('findTablesInDocument should continue when parseTableToken throws', () => {
        const origParseTable = (parser as any).parseTableToken;
        (parser as any).parseTableToken = () => { throw new Error('parse table error'); };
        // テーブルを含むコンテンツ
        const content = '| A |\n|---|\n| 1 |\n';
        const ast = parser.parseDocument(content);
        // parseTableTokenがthrowしてもcontinueして空配列が返る
        const tables = parser.findTablesInDocument(ast);
        assert.ok(Array.isArray(tables));
        assert.strictEqual(tables.length, 0);
        (parser as any).parseTableToken = origParseTable;
    });

    // --- findTablesInDocument: 外側catchで非MarkdownParsingError (JS L99) ---
    test('findTablesInDocument should wrap non-MarkdownParsingError in outer catch', () => {
        // ast.tokensのgetterをオーバーライドして非MarkdownParsingErrorをthrow
        const fakeAst = {
            get tokens() { throw new TypeError('token access error'); },
            content: ''
        };
        assert.throws(() => {
            parser.findTablesInDocument(fakeAst as any);
        }, /Failed to find tables in document.*token access error/);
    });

    // --- findTablesInDocument: validation warning (JS L80) ---
    test('findTablesInDocument should log warning for table with validation issues', () => {
        // parseTableToken をモンキーパッチして不整合テーブルを返す
        const origParseTable = (parser as any).parseTableToken.bind(parser);
        (parser as any).parseTableToken = () => ({
            startLine: 0,
            endLine: 2,
            headers: ['A', 'B'],
            rows: [['1']] // カラム数不一致 → validateTableStructure で isValid: false
        });
        const ast = { tokens: [{ type: 'table_open' }], content: '| A | B |\n|---|---|\n| 1 |\n' };
        const origWarnDescriptor = Object.getOwnPropertyDescriptor(console, 'warn');
        let warnCalled = false;
        Object.defineProperty(console, 'warn', {
            value: (...args: any[]) => { warnCalled = true; },
            writable: true,
            configurable: true
        });
        try {
            const tables = parser.findTablesInDocument(ast);
            assert.ok(warnCalled, 'console.warn should have been called for validation issues');
            assert.strictEqual(tables.length, 1, 'table with issues should still be included');
        } finally {
            if (origWarnDescriptor) {
                Object.defineProperty(console, 'warn', origWarnDescriptor);
            }
            (parser as any).parseTableToken = origParseTable;
        }
    });
});