import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MarkdownFileHandler, FileSystemError, getFileHandler } from '../../fileHandler';

suite('FileHandler Test Suite', () => {
    let fileHandler: MarkdownFileHandler;
    let testDir: string;
    let testFile: vscode.Uri;

    suiteSetup(async () => {
        // Create temporary directory for tests
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-table-editor-test-'));
        testFile = vscode.Uri.file(path.join(testDir, 'test.md'));
        fileHandler = new MarkdownFileHandler();
    });

    suiteTeardown(async () => {
        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        fileHandler.dispose();
    });

    suite('readMarkdownFile', () => {
        test('should read existing file successfully', async () => {
            const content = '# Test\n\n| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |';
            fs.writeFileSync(testFile.fsPath, content, 'utf8');

            const result = await fileHandler.readMarkdownFile(testFile);
            assert.strictEqual(result, content);
        });

        test('should throw FileSystemError for non-existent file', async () => {
            const nonExistentFile = vscode.Uri.file(path.join(testDir, 'nonexistent.md'));
            
            try {
                await fileHandler.readMarkdownFile(nonExistentFile);
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.strictEqual(error.operation, 'read');
                assert.strictEqual(error.uri, nonExistentFile);
            }
        });

        test('should handle empty file', async () => {
            fs.writeFileSync(testFile.fsPath, '', 'utf8');

            const result = await fileHandler.readMarkdownFile(testFile);
            assert.strictEqual(result, '');
        });
    });

    suite('writeMarkdownFile', () => {
        test('should write file successfully', async () => {
            const content = '# New Content\n\n| A | B |\n|---|---|\n| 1 | 2 |';
            
            await fileHandler.writeMarkdownFile(testFile, content);
            
            const writtenContent = fs.readFileSync(testFile.fsPath, 'utf8');
            assert.strictEqual(writtenContent, content);
        });

        test('should create directory if it does not exist', async () => {
            const newDir = path.join(testDir, 'subdir');
            const newFile = vscode.Uri.file(path.join(newDir, 'new.md'));
            const content = '# New File';
            
            await fileHandler.writeMarkdownFile(newFile, content);
            
            assert.ok(fs.existsSync(newDir));
            assert.ok(fs.existsSync(newFile.fsPath));
            const writtenContent = fs.readFileSync(newFile.fsPath, 'utf8');
            assert.strictEqual(writtenContent, content);
        });

        test('should overwrite existing file', async () => {
            const initialContent = '# Initial';
            const newContent = '# Updated';
            
            fs.writeFileSync(testFile.fsPath, initialContent, 'utf8');
            await fileHandler.writeMarkdownFile(testFile, newContent);
            
            const writtenContent = fs.readFileSync(testFile.fsPath, 'utf8');
            assert.strictEqual(writtenContent, newContent);
        });
    });

    suite('updateTableInFile', () => {
        test('should update table section successfully', async () => {
            const originalContent = [
                '# Document Title',
                '',
                '| Old Header 1 | Old Header 2 |',
                '|--------------|--------------|',
                '| Old Cell 1   | Old Cell 2   |',
                '| Old Cell 3   | Old Cell 4   |',
                '',
                'Some text after table'
            ].join('\n');
            
            const newTableContent = [
                '| New Header 1 | New Header 2 | New Header 3 |',
                '|--------------|--------------|--------------|',
                '| New Cell 1   | New Cell 2   | New Cell 3   |'
            ].join('\n');
            
            fs.writeFileSync(testFile.fsPath, originalContent, 'utf8');
            
            await fileHandler.updateTableInFile(testFile, 2, 5, newTableContent);
            
            const updatedContent = fs.readFileSync(testFile.fsPath, 'utf8');
            const expectedContent = [
                '# Document Title',
                '',
                '| New Header 1 | New Header 2 | New Header 3 |',
                '|--------------|--------------|--------------|',
                '| New Cell 1   | New Cell 2   | New Cell 3   |',
                '',
                'Some text after table'
            ].join('\n');
            
            assert.strictEqual(updatedContent, expectedContent);
        });

        test('should throw error for invalid line range', async () => {
            const content = 'Line 1\nLine 2\nLine 3';
            fs.writeFileSync(testFile.fsPath, content, 'utf8');
            
            try {
                await fileHandler.updateTableInFile(testFile, 5, 10, 'New content');
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.strictEqual(error.operation, 'update');
            }
        });


    });

    suite('updateMultipleTablesInFile', () => {
        test('should update multiple tables successfully', async () => {
            const originalContent = [
                '# Document Title',
                '',
                '| Table 1 Header 1 | Table 1 Header 2 |',
                '|------------------|------------------|',
                '| Table 1 Cell 1   | Table 1 Cell 2   |',
                '',
                'Some text between tables',
                '',
                '| Table 2 Header 1 | Table 2 Header 2 |',
                '|------------------|------------------|',
                '| Table 2 Cell 1   | Table 2 Cell 2   |',
                '',
                'Text after tables'
            ].join('\n');
            
            const updates = [
                {
                    startLine: 2,
                    endLine: 4,
                    newContent: '| New Table 1 H1 | New Table 1 H2 |\n|----------------|----------------|\n| New T1 Cell 1  | New T1 Cell 2  |'
                },
                {
                    startLine: 8,
                    endLine: 10,
                    newContent: '| New Table 2 H1 | New Table 2 H2 |\n|----------------|----------------|\n| New T2 Cell 1  | New T2 Cell 2  |'
                }
            ];
            
            fs.writeFileSync(testFile.fsPath, originalContent, 'utf8');
            
            await fileHandler.updateMultipleTablesInFile(testFile, updates);
            
            const updatedContent = fs.readFileSync(testFile.fsPath, 'utf8');
            const expectedContent = [
                '# Document Title',
                '',
                '| New Table 1 H1 | New Table 1 H2 |',
                '|----------------|----------------|',
                '| New T1 Cell 1  | New T1 Cell 2  |',
                '',
                'Some text between tables',
                '',
                '| New Table 2 H1 | New Table 2 H2 |',
                '|----------------|----------------|',
                '| New T2 Cell 1  | New T2 Cell 2  |',
                '',
                'Text after tables'
            ].join('\n');
            
            assert.strictEqual(updatedContent, expectedContent);
        });

        test('should handle empty updates array', async () => {
            const originalContent = '# Test\n\nSome content';
            fs.writeFileSync(testFile.fsPath, originalContent, 'utf8');
            
            await fileHandler.updateMultipleTablesInFile(testFile, []);
            
            const updatedContent = fs.readFileSync(testFile.fsPath, 'utf8');
            assert.strictEqual(updatedContent, originalContent);
        });

        test('should throw error for invalid line ranges in batch update', async () => {
            const content = 'Line 1\nLine 2\nLine 3';
            fs.writeFileSync(testFile.fsPath, content, 'utf8');
            
            const updates = [
                { startLine: 0, endLine: 1, newContent: 'Valid update' },
                { startLine: 5, endLine: 10, newContent: 'Invalid update' }
            ];
            
            try {
                await fileHandler.updateMultipleTablesInFile(testFile, updates);
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.strictEqual(error.operation, 'update');
            }
        });
    });

    suite('getFileHandler singleton', () => {
        test('should return same instance', () => {
            const handler1 = getFileHandler();
            const handler2 = getFileHandler();
            
            assert.strictEqual(handler1, handler2);
        });
    });

    suite('FileSystemError', () => {
        test('should create error with correct properties', () => {
            const uri = vscode.Uri.file('/test/file.md');
            const originalError = new Error('Original error');
            const error = new FileSystemError('Test message', 'read', uri, originalError);
            
            assert.strictEqual(error.message, 'Test message');
            assert.strictEqual(error.operation, 'read');
            assert.strictEqual(error.uri, uri);
            assert.strictEqual(error.originalError, originalError);
            assert.strictEqual(error.name, 'FileSystemError');
        });
    });

    suite('updateTableByIndex', () => {
        test('should update specific table by index in multi-table document', async () => {
            const originalContent = `# Multi-Table Document

First table:
| Name | Age |
|------|-----|
| John | 25 |
| Jane | 30 |

Text between tables.

Second table:
| Product | Price |
|---------|-------|
| Laptop | $999 |
| Book | $15 |

Final content.`;

            fs.writeFileSync(testFile.fsPath, originalContent, 'utf8');

            const newTableContent = `| Product | Price |
|---------|-------|
| Desktop | $1299 |
| Tablet | $599 |
| Phone | $799 |`;

            await fileHandler.updateTableByIndex(testFile, 1, newTableContent);

            const updatedContent = await fileHandler.readMarkdownFile(testFile);
            
            // Should contain the updated second table
            assert.ok(updatedContent.includes('Desktop'));
            assert.ok(updatedContent.includes('$1299'));
            assert.ok(updatedContent.includes('Tablet'));
            
            // Should preserve the first table
            assert.ok(updatedContent.includes('Name'));
            assert.ok(updatedContent.includes('John'));
            
            // Should preserve non-table content
            assert.ok(updatedContent.includes('Multi-Table Document'));
            assert.ok(updatedContent.includes('Text between tables'));
            assert.ok(updatedContent.includes('Final content'));
        });

        test('should handle invalid table index', async () => {
            const content = `# Single Table Document

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;

            fs.writeFileSync(testFile.fsPath, content, 'utf8');

            const newTableContent = `| Header 1 | Header 2 |
|----------|----------|
| New 1    | New 2    |`;

            try {
                await fileHandler.updateTableByIndex(testFile, 5, newTableContent);
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.ok(error.message.includes('out of range'));
            }
        });

        test('should update first table in multi-table document', async () => {
            const originalContent = `# Document with Multiple Tables

| A | B |
|---|---|
| 1 | 2 |

Some text.

| X | Y | Z |
|---|---|---|
| 7 | 8 | 9 |`;

            fs.writeFileSync(testFile.fsPath, originalContent, 'utf8');

            const newTableContent = `| A | B |
|---|---|
| Updated | Values |
| New | Row |`;

            await fileHandler.updateTableByIndex(testFile, 0, newTableContent);

            const updatedContent = await fileHandler.readMarkdownFile(testFile);
            
            // Should contain the updated first table
            assert.ok(updatedContent.includes('Updated'));
            assert.ok(updatedContent.includes('Values'));
            assert.ok(updatedContent.includes('New'));
            
            // Should preserve the second table
            assert.ok(updatedContent.includes('X'));
            assert.ok(updatedContent.includes('Y'));
            assert.ok(updatedContent.includes('Z'));
            assert.ok(updatedContent.includes('7'));
            
            // Should preserve non-table content
            assert.ok(updatedContent.includes('Some text'));
        });

        test('should handle document with mixed content', async () => {
            const originalContent = `# Mixed Content Document

## Introduction
Some introductory text.

\`\`\`javascript
const code = "example";
\`\`\`

### Table Section
| Column | Value |
|--------|-------|
| A      | 1     |
| B      | 2     |

- List item 1
- List item 2

> Block quote

Another table:
| X | Y |
|---|---|
| 3 | 4 |

Final paragraph.`;

            fs.writeFileSync(testFile.fsPath, originalContent, 'utf8');

            const newTableContent = `| Column | Value |
|--------|-------|
| Updated | 999 |
| Column  | 888 |`;

            await fileHandler.updateTableByIndex(testFile, 0, newTableContent);

            const updatedContent = await fileHandler.readMarkdownFile(testFile);
            
            // Should contain the updated first table
            assert.ok(updatedContent.includes('Updated'));
            assert.ok(updatedContent.includes('999'));
            
            // Should preserve all other content
            assert.ok(updatedContent.includes('Introduction'));
            assert.ok(updatedContent.includes('const code'));
            assert.ok(updatedContent.includes('List item 1'));
            assert.ok(updatedContent.includes('Block quote'));
            assert.ok(updatedContent.includes('Final paragraph'));
            
            // Should preserve the second table
            assert.ok(updatedContent.includes('3') && updatedContent.includes('4'));
        });
    });
});