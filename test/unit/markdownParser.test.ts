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