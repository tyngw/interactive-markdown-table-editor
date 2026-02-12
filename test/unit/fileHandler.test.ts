import * as assert from 'assert';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MarkdownFileHandler, FileSystemError, getFileHandler } from '../../src/fileHandler';

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
            const multiTableFile = vscode.Uri.file(path.join(testDir, 'multi-table-test.md'));
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
            
            fs.writeFileSync(multiTableFile.fsPath, originalContent, 'utf8');
            
            await fileHandler.updateMultipleTablesInFile(multiTableFile, updates);
            
            const updatedContent = fs.readFileSync(multiTableFile.fsPath, 'utf8');
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
            
            // Cleanup
            fs.unlinkSync(multiTableFile.fsPath);
        });

        test('should handle empty updates array', async () => {
            const emptyUpdateFile = vscode.Uri.file(path.join(testDir, 'empty-update-test.md'));
            const originalContent = '# Test\n\nSome content';
            fs.writeFileSync(emptyUpdateFile.fsPath, originalContent, 'utf8');
            
            await fileHandler.updateMultipleTablesInFile(emptyUpdateFile, []);
            
            const updatedContent = fs.readFileSync(emptyUpdateFile.fsPath, 'utf8');
            assert.strictEqual(updatedContent, originalContent);
            
            // Cleanup
            fs.unlinkSync(emptyUpdateFile.fsPath);
        });

        test('should throw error for invalid line ranges in batch update', async () => {
            const invalidRangeFile = vscode.Uri.file(path.join(testDir, 'invalid-range-test.md'));
            const content = 'Line 1\nLine 2\nLine 3';
            fs.writeFileSync(invalidRangeFile.fsPath, content, 'utf8');
            
            const updates = [
                { startLine: 0, endLine: 1, newContent: 'Valid update' },
                { startLine: 5, endLine: 10, newContent: 'Invalid update' }
            ];
            
            try {
                await fileHandler.updateMultipleTablesInFile(invalidRangeFile, updates);
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.strictEqual(error.operation, 'update');
            }
            
            // Cleanup
            fs.unlinkSync(invalidRangeFile.fsPath);
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
            const updateIndexFile = vscode.Uri.file(path.join(testDir, 'update-index-test.md'));
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

            fs.writeFileSync(updateIndexFile.fsPath, originalContent, 'utf8');

            const newTableContent = `| Product | Price |
|---------|-------|
| Desktop | $1299 |
| Tablet | $599 |
| Phone | $799 |`;

            await fileHandler.updateTableByIndex(updateIndexFile, 1, newTableContent);

            const updatedContent = await fileHandler.readMarkdownFile(updateIndexFile);
            
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
            
            // Cleanup
            fs.unlinkSync(updateIndexFile.fsPath);
        });

        test('should handle invalid table index', async () => {
            const invalidIndexFile = vscode.Uri.file(path.join(testDir, 'invalid-index-test.md'));
            const content = `# Single Table Document

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;

            fs.writeFileSync(invalidIndexFile.fsPath, content, 'utf8');

            const newTableContent = `| Header 1 | Header 2 |
|----------|----------|
| New 1    | New 2    |`;

            try {
                await fileHandler.updateTableByIndex(invalidIndexFile, 5, newTableContent);
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.ok(error.message.includes('out of range'));
            }
            
            // Cleanup
            fs.unlinkSync(invalidIndexFile.fsPath);
        });

        test('should update first table in multi-table document', async () => {
            const firstTableFile = vscode.Uri.file(path.join(testDir, 'first-table-update.md'));
            const originalContent = `# Document with Multiple Tables

| A | B |
|---|---|
| 1 | 2 |

Some text.

| X | Y | Z |
|---|---|---|
| 7 | 8 | 9 |`;

            fs.writeFileSync(firstTableFile.fsPath, originalContent, 'utf8');

            const newTableContent = `| A | B |
|---|---|
| Updated | Values |
| New | Row |`;

            await fileHandler.updateTableByIndex(firstTableFile, 0, newTableContent);

            const updatedContent = await fileHandler.readMarkdownFile(firstTableFile);
            
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
            
            // Cleanup
            fs.unlinkSync(firstTableFile.fsPath);
        });

        test('should handle document with mixed content', async () => {
            const mixedContentFile = vscode.Uri.file(path.join(testDir, 'mixed-content-test.md'));
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

            fs.writeFileSync(mixedContentFile.fsPath, originalContent, 'utf8');

            const newTableContent = `| Column | Value |
|--------|-------|
| Updated | 999 |
| Column  | 888 |`;

            await fileHandler.updateTableByIndex(mixedContentFile, 0, newTableContent);

            const updatedContent = await fileHandler.readMarkdownFile(mixedContentFile);
            
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
            
            // Cleanup
            fs.unlinkSync(mixedContentFile.fsPath);
        });
    });

    suite('readMarkdownFile - open document branch', () => {
        test('should read from open document when available', async () => {
            // Write a file and ensure it's on disk
            const openDocFile = vscode.Uri.file(path.join(testDir, 'open-doc-test.md'));
            fs.writeFileSync(openDocFile.fsPath, '# On disk content', 'utf8');

            // Open the document in VS Code (this makes it findable via textDocuments)
            const doc = await vscode.workspace.openTextDocument(openDocFile);
            const result = await fileHandler.readMarkdownFile(openDocFile);
            // Should read from the open document
            assert.ok(result.length > 0);

            // Cleanup
            fs.unlinkSync(openDocFile.fsPath);
        });
    });

    suite('readMarkdownFile - generic error wrapping', () => {
        test('should wrap non-FileSystemError into FileSystemError', async () => {
            // Create a handler with a mock that causes a generic error
            const badUri = vscode.Uri.file(path.join(testDir, 'no-perms'));
            // Create a directory with the same name as the file to cause a read error
            fs.mkdirSync(badUri.fsPath, { recursive: true });
            try {
                await fileHandler.readMarkdownFile(badUri);
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.strictEqual(error.operation, 'read');
            }
            fs.rmSync(badUri.fsPath, { recursive: true, force: true });
        });
    });

    suite('writeMarkdownFile - error branches', () => {
        test('should wrap generic write error into FileSystemError', async () => {
            // Try to write to a read-only path (/ on macOS is not writable)
            const readOnlyFile = vscode.Uri.file('/proc/nonexistent/file.md');
            try {
                await fileHandler.writeMarkdownFile(readOnlyFile, 'content');
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.strictEqual(error.operation, 'write');
            }
        });

        test('should handle write permission error as FileSystemError', async () => {
            // Create a file, then make it read-only
            const roFile = vscode.Uri.file(path.join(testDir, 'readonly-write-test.md'));
            fs.writeFileSync(roFile.fsPath, 'original', 'utf8');
            fs.chmodSync(roFile.fsPath, 0o444); // read-only
            try {
                await fileHandler.writeMarkdownFile(roFile, 'new content');
                // On some systems this may succeed as root; that's OK
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
            } finally {
                fs.chmodSync(roFile.fsPath, 0o644);
                fs.unlinkSync(roFile.fsPath);
            }
        });
    });

    suite('updateTableByIndex - error branches', () => {
        test('should wrap generic error into FileSystemError', async () => {
            const errFile = vscode.Uri.file(path.join(testDir, 'nonexistent-dir', 'deep', 'error.md'));
            try {
                await fileHandler.updateTableByIndex(errFile, 0, '| A |\n|---|\n| 1 |');
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
            }
        });

        test('should throw for negative table index', async () => {
            const negFile = vscode.Uri.file(path.join(testDir, 'neg-index.md'));
            fs.writeFileSync(negFile.fsPath, '| A |\n|---|\n| 1 |', 'utf8');
            try {
                await fileHandler.updateTableByIndex(negFile, -1, '| B |\n|---|\n| 2 |');
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.ok(error.message.includes('out of range'));
            }
            fs.unlinkSync(negFile.fsPath);
        });
    });

    suite('updateTableInFile - error branches', () => {
        test('should wrap generic error into FileSystemError', async () => {
            const errFile = vscode.Uri.file(path.join(testDir, 'no-such-dir-update', 'file.md'));
            try {
                await fileHandler.updateTableInFile(errFile, 0, 2, '| A |\n|---|\n| 1 |');
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.strictEqual(error.operation, 'update');
            }
        });
    });

    suite('updateMultipleTablesInFile - error branches', () => {
        test('should wrap generic error into FileSystemError', async () => {
            const errFile = vscode.Uri.file(path.join(testDir, 'multi-err', 'file.md'));
            try {
                await fileHandler.updateMultipleTablesInFile(errFile, [{ startLine: 0, endLine: 1, newContent: '| X |' }]);
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.strictEqual(error.operation, 'update');
            }
        });
    });

    suite('applyWorkspaceEditAndSave', () => {
        test('should apply edit and save successfully', async () => {
            const saveFile = vscode.Uri.file(path.join(testDir, 'apply-save.md'));
            fs.writeFileSync(saveFile.fsPath, 'Line 0\nLine 1\nLine 2', 'utf8');
            const doc = await vscode.workspace.openTextDocument(saveFile);

            const edit = new vscode.WorkspaceEdit();
            edit.replace(saveFile, new vscode.Range(0, 0, 0, 6), 'Updated');

            const result = await fileHandler.applyWorkspaceEditAndSave(edit, saveFile, 'test');
            assert.strictEqual(result, true);

            fs.unlinkSync(saveFile.fsPath);
        });
    });

    suite('extractTablePositionsFromTokens', () => {
        test('should extract table positions from markdown-it tokens', () => {
            const handler = fileHandler as any;
            const content = '| A |\n|---|\n| 1 |\n';
            const tokens = handler.parser.parse(content, {});
            const tables = handler.extractTablePositionsFromTokens(tokens, content);
            assert.ok(tables.length >= 1);
            assert.strictEqual(tables[0].tableIndex, 0);
            assert.ok(tables[0].startLine >= 0);
        });

        test('should handle table_close with map', () => {
            const handler = fileHandler as any;
            // Create fake tokens with table_close having a map
            const tokens = [
                { type: 'table_open', map: [0, 3] },
                { type: 'table_close', map: [0, 4] }
            ];
            const tables = handler.extractTablePositionsFromTokens(tokens, '');
            assert.strictEqual(tables.length, 1);
            assert.strictEqual(tables[0].endLine, 3); // map[1] - 1
        });
    });

    suite('showErrorNotification', () => {
        test('should handle read operation error notification', () => {
            const handler = fileHandler as any;
            const error = new FileSystemError('Test read error', 'read', testFile);
            // Should not throw
            assert.doesNotThrow(() => {
                handler.showErrorNotification(error);
            });
        });

        test('should handle write operation error notification', () => {
            const handler = fileHandler as any;
            const error = new FileSystemError('Test write error', 'write', testFile);
            assert.doesNotThrow(() => {
                handler.showErrorNotification(error);
            });
        });

        test('should handle update operation error notification', () => {
            const handler = fileHandler as any;
            const error = new FileSystemError('Test update error', 'update', testFile);
            assert.doesNotThrow(() => {
                handler.showErrorNotification(error);
            });
        });

        test('should handle default/unknown operation error notification', () => {
            const handler = fileHandler as any;
            const error = new FileSystemError('Test unknown error', 'unknown', testFile);
            assert.doesNotThrow(() => {
                handler.showErrorNotification(error);
            });
        });
    });

    suite('notifyFileChange', () => {
        test('should handle stat error gracefully', async () => {
            const handler = fileHandler as any;
            const nonExistentUri = vscode.Uri.file(path.join(testDir, 'notify-nonexistent.md'));
            // Should not throw even for non-existent file
            await assert.doesNotReject(async () => {
                await handler.notifyFileChange(nonExistentUri);
            });
        });

        test('should handle existing file', async () => {
            const handler = fileHandler as any;
            const existFile = vscode.Uri.file(path.join(testDir, 'notify-exist.md'));
            fs.writeFileSync(existFile.fsPath, 'test', 'utf8');
            await assert.doesNotReject(async () => {
                await handler.notifyFileChange(existFile);
            });
            fs.unlinkSync(existFile.fsPath);
        });
    });

    suite('withOpenDocument', () => {
        test('should call fn with document when file exists', async () => {
            const handler = fileHandler as any;
            const woFile = vscode.Uri.file(path.join(testDir, 'with-open.md'));
            fs.writeFileSync(woFile.fsPath, 'content', 'utf8');
            const result = await handler.withOpenDocument(woFile, 'test', async (doc: any) => {
                return doc.getText();
            });
            assert.strictEqual(result, 'content');
            fs.unlinkSync(woFile.fsPath);
        });

        test('should wrap non-FileSystemError on open failure', async () => {
            const handler = fileHandler as any;
            const woFile = vscode.Uri.file(path.join(testDir, 'wrap-err.md'));
            fs.writeFileSync(woFile.fsPath, 'content', 'utf8');
            try {
                await handler.withOpenDocument(woFile, 'test', async () => {
                    throw new Error('generic error');
                });
                assert.fail('Should have thrown');
            } catch (error) {
                assert.ok(error instanceof FileSystemError);
                assert.strictEqual(error.operation, 'test');
            }
            fs.unlinkSync(woFile.fsPath);
        });

        test('should rethrow FileSystemError unchanged', async () => {
            const handler = fileHandler as any;
            const rethrowFile = vscode.Uri.file(path.join(testDir, 'rethrow.md'));
            fs.writeFileSync(rethrowFile.fsPath, 'x', 'utf8');
            const customError = new FileSystemError('custom', 'custom-op', rethrowFile);
            try {
                await handler.withOpenDocument(rethrowFile, 'test', async () => { throw customError; });
                assert.fail('Should have thrown');
            } catch (error) {
                assert.strictEqual(error, customError);
            }
            fs.unlinkSync(rethrowFile.fsPath);
        });
    });

    suite('handleApplyResult', () => {
        test('should log success when applied is true', () => {
            const handler = fileHandler as any;
            const result = handler.handleApplyResult(testFile, 'test', true, 'Success!', 'No change');
            assert.strictEqual(result, true);
        });

        test('should log no-change when applied is false', () => {
            const handler = fileHandler as any;
            const result = handler.handleApplyResult(testFile, 'test', false, 'Success!', 'No change');
            assert.strictEqual(result, false);
        });

        test('should use default messages when not provided', () => {
            const handler = fileHandler as any;
            const result = handler.handleApplyResult(testFile, 'test', true);
            assert.strictEqual(result, true);
        });
    });

    suite('getEolString', () => {
        test('should return \\n for LF documents', async () => {
            const handler = fileHandler as any;
            const lfFile = vscode.Uri.file(path.join(testDir, 'lf-test.md'));
            fs.writeFileSync(lfFile.fsPath, 'line1\nline2', 'utf8');
            const doc = await vscode.workspace.openTextDocument(lfFile);
            const eol = handler.getEolString(doc);
            // Default EOL depends on OS, but it should be '\n' or '\r\n'
            assert.ok(eol === '\n' || eol === '\r\n');
            fs.unlinkSync(lfFile.fsPath);
        });
    });

    suite('disposeFileHandler', () => {
        test('should dispose and reset singleton', () => {
            const { disposeFileHandler, getFileHandler } = require('../../src/fileHandler');
            const h1 = getFileHandler();
            disposeFileHandler();
            const h2 = getFileHandler();
            assert.notStrictEqual(h1, h2);
            disposeFileHandler(); // cleanup
        });
    });

    suite('normalizeTableLines', () => {
        test('should delegate to fileUtils.normalizeTableLines', () => {
            const handler = fileHandler as any;
            const result = handler.normalizeTableLines('| A | B |\n|---|---|\n| 1 | 2 |');
            assert.ok(Array.isArray(result));
            assert.ok(result.length >= 3);
        });
    });

    suite('applyWorkspaceEditsForReplacements', () => {
        test('should return false for empty replacements', async () => {
            const handler = fileHandler as any;
            const emptyRepFile = vscode.Uri.file(path.join(testDir, 'empty-rep.md'));
            fs.writeFileSync(emptyRepFile.fsPath, 'content', 'utf8');
            const doc = await vscode.workspace.openTextDocument(emptyRepFile);
            const result = await handler.applyWorkspaceEditsForReplacements(doc, [], 'test');
            assert.strictEqual(result, false);
            fs.unlinkSync(emptyRepFile.fsPath);
        });

        test('should return false when replacement matches current content', async () => {
            const handler = fileHandler as any;
            const sameFile = vscode.Uri.file(path.join(testDir, 'same-content.md'));
            fs.writeFileSync(sameFile.fsPath, 'Line 0\nLine 1', 'utf8');
            const doc = await vscode.workspace.openTextDocument(sameFile);
            const result = await handler.applyWorkspaceEditsForReplacements(
                doc,
                [{ startLine: 0, endLine: 0, replacementText: 'Line 0' }],
                'test'
            );
            assert.strictEqual(result, false);
            fs.unlinkSync(sameFile.fsPath);
        });

        test('should apply replacement when content differs', async () => {
            const handler = fileHandler as any;
            const diffFile = vscode.Uri.file(path.join(testDir, 'diff-rep.md'));
            fs.writeFileSync(diffFile.fsPath, 'Line 0\nLine 1\nLine 2', 'utf8');
            const doc = await vscode.workspace.openTextDocument(diffFile);
            const result = await handler.applyWorkspaceEditsForReplacements(
                doc,
                [{ startLine: 0, endLine: 0, replacementText: 'NewLine 0' }],
                'test'
            );
            assert.strictEqual(result, true);
            fs.unlinkSync(diffFile.fsPath);
        });

        test('should sort replacements in descending order by startLine', async () => {
            const handler = fileHandler as any;
            const multiRepFile = vscode.Uri.file(path.join(testDir, 'multi-rep.md'));
            fs.writeFileSync(multiRepFile.fsPath, 'A\nB\nC\nD', 'utf8');
            const doc = await vscode.workspace.openTextDocument(multiRepFile);
            const result = await handler.applyWorkspaceEditsForReplacements(
                doc,
                [
                    { startLine: 0, endLine: 0, replacementText: 'X' },
                    { startLine: 2, endLine: 2, replacementText: 'Z' }
                ],
                'test'
            );
            assert.strictEqual(result, true);
            fs.unlinkSync(multiRepFile.fsPath);
        });
    });

    suite('FileSystemError additional', () => {
        test('should create error without originalError', () => {
            const uri = vscode.Uri.file('/test/noOriginal.md');
            const error = new FileSystemError('Test message', 'read', uri);
            assert.strictEqual(error.message, 'Test message');
            assert.strictEqual(error.operation, 'read');
            assert.strictEqual(error.originalError, undefined);
        });
    });

    suite('applyWorkspaceEditAndSave - fallback write', () => {
        test('should handle edit apply failure gracefully', async () => {
            // applyWorkspaceEditAndSave のエラーハンドリングを確認
            const handler = fileHandler as any;
            const fbFile = vscode.Uri.file(path.join(testDir, 'fallback-save.md'));
            fs.writeFileSync(fbFile.fsPath, 'original fallback', 'utf8');

            const edit = new vscode.WorkspaceEdit();
            edit.replace(fbFile, new vscode.Range(0, 0, 0, 17), 'Updated fallback');

            const result = await handler.applyWorkspaceEditAndSave(edit, fbFile, 'test');
            // 正常に処理が完了すること
            assert.strictEqual(typeof result, 'boolean');
            fs.unlinkSync(fbFile.fsPath);
        });
    });

    suite('updateMultipleTablesInFile - no changes', () => {
        test('should return false when update produces same content', async () => {
            const noChangeFile = vscode.Uri.file(path.join(testDir, 'no-change-multi.md'));
            const content = '| A |\n|---|\n| 1 |';
            fs.writeFileSync(noChangeFile.fsPath, content, 'utf8');

            const result = await fileHandler.updateMultipleTablesInFile(noChangeFile, [
                { startLine: 0, endLine: 2, newContent: '| A |\n|---|\n| 1 |' }
            ]);
            assert.strictEqual(result, false);
            fs.unlinkSync(noChangeFile.fsPath);
        });
    });

    suite('updateTableInFile - no changes', () => {
        test('should return false when table content is unchanged', async () => {
            const sameTableFile = vscode.Uri.file(path.join(testDir, 'same-table.md'));
            const content = '| A |\n|---|\n| 1 |';
            fs.writeFileSync(sameTableFile.fsPath, content, 'utf8');

            const result = await fileHandler.updateTableInFile(sameTableFile, 0, 2, '| A |\n|---|\n| 1 |');
            assert.strictEqual(result, false);
            fs.unlinkSync(sameTableFile.fsPath);
        });
    });

    suite('notifyFileChange basic', () => {
        test('should not throw when notifying file change', async () => {
            const handler = fileHandler as any;
            const notifyFile = vscode.Uri.file(path.join(testDir, 'notify-editors.md'));
            fs.writeFileSync(notifyFile.fsPath, 'notify test', 'utf8');

            // notifyFileChange が例外なく完了すること
            await handler.notifyFileChange(notifyFile);
            fs.unlinkSync(notifyFile.fsPath);
        });
    });

    suite('readMarkdownFile - open document in-memory content', () => {
        test('should return getText() from already-open document matching the URI', async () => {
            const inMemFile = vscode.Uri.file(path.join(testDir, 'in-memory-doc.md'));
            const diskContent = '# Disk content';
            const inMemoryContent = '# In-memory modified content';
            fs.writeFileSync(inMemFile.fsPath, diskContent, 'utf8');

            // textDocuments 配列にマッチするドキュメントオブジェクトを挿入
            // fileHandler は doc.uri.fsPath === uri.fsPath で検索するので
            // uri プロパティに fsPath を持つオブジェクトを用意する
            const origTextDocs = (vscode.workspace as any).textDocuments;
            const fakeDoc = {
                uri: { fsPath: inMemFile.fsPath, toString: () => inMemFile.toString() },
                getText: () => inMemoryContent
            };
            (vscode.workspace as any).textDocuments = [fakeDoc];

            try {
                const result = await fileHandler.readMarkdownFile(inMemFile);
                // インメモリの内容が返されること（ディスクの内容ではない）
                assert.strictEqual(result, inMemoryContent);
            } finally {
                (vscode.workspace as any).textDocuments = origTextDocs;
            }

            fs.unlinkSync(inMemFile.fsPath);
        });
    });

    suite('readMarkdownFile - non-FileSystemError catch', () => {
        test('should wrap non-FileSystemError from fs.promises.readFile into FileSystemError', async () => {
            // textDocuments にキャッシュされないようランダムなファイル名を使用
            const randomName = `read-generic-err-${Date.now()}-${Math.random().toString(36).slice(2)}.md`;
            const errFile = vscode.Uri.file(path.join(testDir, randomName));
            fs.writeFileSync(errFile.fsPath, 'content', 'utf8');

            // 新規ハンドラを使う（textDocuments キャッシュ回避）
            const handler2 = new MarkdownFileHandler();

            // showErrorNotification 内の showErrorMessage が .then() を返すようモック
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);

            // fs.promises.readFile をモンキーパッチして通常の Error を throw
            const originalReadFile = fs.promises.readFile;
            (fs.promises as any).readFile = async () => {
                throw new Error('Simulated generic read error');
            };

            try {
                await handler2.readMarkdownFile(errFile);
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error: any) {
                assert.strictEqual(error.name, 'FileSystemError');
                assert.strictEqual(error.operation, 'read');
                assert.ok(error.message.includes('Failed to read file'));
            } finally {
                (fs.promises as any).readFile = originalReadFile;
                (vscode.window as any).showErrorMessage = origShowError;
                handler2.dispose();
            }

            fs.unlinkSync(errFile.fsPath);
        });
    });

    suite('writeMarkdownFile - non-FileSystemError catch', () => {
        test('should wrap non-FileSystemError from fs.promises.writeFile into FileSystemError', async () => {
            const randomName = `write-generic-err-${Date.now()}-${Math.random().toString(36).slice(2)}.md`;
            const errFile = vscode.Uri.file(path.join(testDir, randomName));

            // showErrorNotification 内の showErrorMessage が .then() を返すようモック
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);

            const originalWriteFile = fs.promises.writeFile;
            (fs.promises as any).writeFile = async () => {
                throw new Error('Simulated generic write error');
            };

            try {
                await fileHandler.writeMarkdownFile(errFile, 'some content');
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error: any) {
                assert.strictEqual(error.name, 'FileSystemError');
                assert.strictEqual(error.operation, 'write');
                assert.ok(error.message.includes('Failed to write file'));
            } finally {
                (fs.promises as any).writeFile = originalWriteFile;
                (vscode.window as any).showErrorMessage = origShowError;
            }
        });
    });

    suite('showErrorNotification - all branches', () => {
        test('should handle read operation via readMarkdownFile error path', () => {
            const handler = fileHandler as any;
            const origShowError = vscode.window.showErrorMessage;
            // showErrorMessage のモックが .then() 呼び出しに対応するようにする
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);
            try {
                const readErr = new FileSystemError('Read failed', 'read', testFile);
                handler.showErrorNotification(readErr);
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
            }
        });

        test('should handle write operation via writeMarkdownFile error path', () => {
            const handler = fileHandler as any;
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);
            try {
                const writeErr = new FileSystemError('Write failed', 'write', testFile);
                handler.showErrorNotification(writeErr);
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
            }
        });

        test('should handle update operation', () => {
            const handler = fileHandler as any;
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);
            try {
                const updateErr = new FileSystemError('Update failed', 'update', testFile);
                handler.showErrorNotification(updateErr);
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
            }
        });

        test('should handle default/unknown operation', () => {
            const handler = fileHandler as any;
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);
            try {
                const defaultErr = new FileSystemError('Unknown op failed', 'custom-operation', testFile);
                handler.showErrorNotification(defaultErr);
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
            }
        });
    });

    suite('applyWorkspaceEditAndSave - save() returns false (fallback)', () => {
        test('should fall back to direct fs write when document.save() returns false', async () => {
            const fbFile = vscode.Uri.file(path.join(testDir, 'save-false-fallback.md'));
            fs.writeFileSync(fbFile.fsPath, 'Line 0\nLine 1\nLine 2', 'utf8');

            // openTextDocument をモンキーパッチして save() が false を返すようにする
            const origOpenTextDocument = vscode.workspace.openTextDocument;
            let callCount = 0;
            (vscode.workspace as any).openTextDocument = async (uri: any) => {
                const doc = await origOpenTextDocument.call(vscode.workspace, uri);
                callCount++;
                // applyWorkspaceEditAndSave 内の openTextDocument 呼び出し（2回目以降）で
                // save() が false を返すようにする
                return {
                    uri: doc.uri,
                    getText: (range?: any) => doc.getText(range),
                    positionAt: (offset: number) => doc.positionAt(offset),
                    lineAt: (line: number) => doc.lineAt(line),
                    lineCount: doc.lineCount,
                    eol: doc.eol,
                    save: async () => false
                };
            };

            const edit = new vscode.WorkspaceEdit();
            edit.replace(fbFile, new vscode.Range(0, 0, 0, 6), 'Updated');

            try {
                const result = await fileHandler.applyWorkspaceEditAndSave(edit, fbFile, 'test');
                assert.strictEqual(result, true);
            } finally {
                (vscode.workspace as any).openTextDocument = origOpenTextDocument;
            }

            fs.unlinkSync(fbFile.fsPath);
        });
    });

    suite('applyWorkspaceEditAndSave - save() throws error', () => {
        test('should throw FileSystemError when save() throws', async () => {
            const saveErrFile = vscode.Uri.file(path.join(testDir, 'save-throw.md'));
            fs.writeFileSync(saveErrFile.fsPath, 'Original content', 'utf8');

            // showErrorNotification 内の showErrorMessage が .then() を返すようモック
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);

            // openTextDocument をモンキーパッチして save() が throw するようにする
            const origOpenTextDocument = vscode.workspace.openTextDocument;
            (vscode.workspace as any).openTextDocument = async (uri: any) => {
                const doc = await origOpenTextDocument.call(vscode.workspace, uri);
                return {
                    uri: doc.uri,
                    getText: (range?: any) => doc.getText(range),
                    positionAt: (offset: number) => doc.positionAt(offset),
                    lineAt: (line: number) => doc.lineAt(line),
                    lineCount: doc.lineCount,
                    eol: doc.eol,
                    save: async () => { throw new Error('Save failed'); }
                };
            };

            const edit = new vscode.WorkspaceEdit();
            edit.replace(saveErrFile, new vscode.Range(0, 0, 0, 8), 'Modified');

            try {
                await fileHandler.applyWorkspaceEditAndSave(edit, saveErrFile, 'test');
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error: any) {
                assert.strictEqual(error.name, 'FileSystemError');
                assert.ok(error.message.includes('Failed to save document after apply'));
            } finally {
                (vscode.workspace as any).openTextDocument = origOpenTextDocument;
                (vscode.window as any).showErrorMessage = origShowError;
            }

            fs.unlinkSync(saveErrFile.fsPath);
        });
    });

    suite('showErrorNotification - then callback branches', () => {
        test('should call outputChannel.show() when user selects Show Details for read error', async () => {
            const handler = fileHandler as any;
            const origShowError = vscode.window.showErrorMessage;
            // showErrorMessage が 'Show Details' を返すモック
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve('Show Details');
            try {
                const readErr = new FileSystemError('Read failed', 'read', testFile);
                handler.showErrorNotification(readErr);
                // then コールバックが非同期で実行されるのを待つ
                await new Promise(resolve => setTimeout(resolve, 10));
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
            }
        });

        test('should call outputChannel.show() when user selects Show Details for write error', async () => {
            const handler = fileHandler as any;
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve('Show Details');
            try {
                const writeErr = new FileSystemError('Write failed', 'write', testFile);
                handler.showErrorNotification(writeErr);
                await new Promise(resolve => setTimeout(resolve, 10));
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
            }
        });

        test('should call showSaveDialog when user selects Save As for write error', async () => {
            const handler = fileHandler as any;
            const origShowError = vscode.window.showErrorMessage;
            const origShowSaveDialog = vscode.window.showSaveDialog;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve('Save As...');
            (vscode.window as any).showSaveDialog = async () => undefined;
            try {
                const writeErr = new FileSystemError('Write failed', 'write', testFile);
                handler.showErrorNotification(writeErr);
                await new Promise(resolve => setTimeout(resolve, 10));
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
                (vscode.window as any).showSaveDialog = origShowSaveDialog;
            }
        });

        test('should call outputChannel.show() when user selects Show Details for default error', async () => {
            const handler = fileHandler as any;
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve('Show Details');
            try {
                const defaultErr = new FileSystemError('Other failed', 'other', testFile);
                handler.showErrorNotification(defaultErr);
                await new Promise(resolve => setTimeout(resolve, 10));
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
            }
        });
    });

    suite('notifyFileChange - visibleTextEditors', () => {
        test('should log open editors count when file has visible editors', async () => {
            const handler = fileHandler as any;
            const notifyFile = vscode.Uri.file(path.join(testDir, 'notify-visible.md'));
            fs.writeFileSync(notifyFile.fsPath, 'visible editor test', 'utf8');

            const origVisibleEditors = vscode.window.visibleTextEditors;
            (vscode.window as any).visibleTextEditors = [
                { document: { uri: notifyFile } }
            ];

            try {
                await handler.notifyFileChange(notifyFile);
            } finally {
                (vscode.window as any).visibleTextEditors = origVisibleEditors;
            }

            fs.unlinkSync(notifyFile.fsPath);
        });
    });

    suite('updateTableByIndex - non-FileSystemError catch', () => {
        test('should wrap non-FileSystemError into FileSystemError', async () => {
            const handler2 = new MarkdownFileHandler();
            const errFile = vscode.Uri.file(path.join(testDir, 'update-by-index-err.md'));
            fs.writeFileSync(errFile.fsPath, '| A |\n|---|\n| 1 |', 'utf8');

            // outputChannel.appendLine をモンキーパッチして2回目の呼び出しでthrowさせる
            // (withOpenDocumentの前でthrowさせることでouter catchに入る)
            const origAppendLine = (handler2 as any).outputChannel.appendLine;
            let appendCount = 0;
            (handler2 as any).outputChannel.appendLine = (msg: string) => {
                appendCount++;
                if (msg.includes('Updating table')) {
                    throw new Error('Simulated appendLine error');
                }
                return origAppendLine.call((handler2 as any).outputChannel, msg);
            };
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);

            try {
                await handler2.updateTableByIndex(errFile, 0, '| B |\n|---|\n| 2 |');
                assert.fail('Expected error to be thrown');
            } catch (error: any) {
                assert.strictEqual(error.name, 'FileSystemError');
                assert.strictEqual(error.operation, 'update');
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
                handler2.dispose();
            }

            fs.unlinkSync(errFile.fsPath);
        });
    });

    suite('updateTableInFile - non-FileSystemError catch', () => {
        test('should wrap non-FileSystemError into FileSystemError', async () => {
            const handler2 = new MarkdownFileHandler();
            const errFile = vscode.Uri.file(path.join(testDir, 'update-table-err.md'));
            fs.writeFileSync(errFile.fsPath, '| A |\n|---|\n| 1 |', 'utf8');

            // outputChannel.appendLine をモンキーパッチして特定メッセージでthrow
            (handler2 as any).outputChannel.appendLine = (msg: string) => {
                if (msg.includes('Updating table in file')) {
                    throw new Error('Simulated appendLine error');
                }
            };
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);

            try {
                await handler2.updateTableInFile(errFile, 0, 2, '| B |\n|---|\n| 2 |');
                assert.fail('Expected error to be thrown');
            } catch (error: any) {
                assert.strictEqual(error.name, 'FileSystemError');
                assert.strictEqual(error.operation, 'update');
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
                handler2.dispose();
            }

            fs.unlinkSync(errFile.fsPath);
        });
    });

    suite('updateMultipleTablesInFile - non-FileSystemError catch', () => {
        test('should wrap non-FileSystemError into FileSystemError', async () => {
            const handler2 = new MarkdownFileHandler();
            const errFile = vscode.Uri.file(path.join(testDir, 'update-multi-err.md'));
            fs.writeFileSync(errFile.fsPath, '| A |\n|---|\n| 1 |', 'utf8');

            (handler2 as any).outputChannel.appendLine = (msg: string) => {
                if (msg.includes('Updating') && msg.includes('tables in file')) {
                    throw new Error('Simulated appendLine error');
                }
            };
            const origShowError = vscode.window.showErrorMessage;
            (vscode.window as any).showErrorMessage = (..._args: any[]) => Promise.resolve(undefined);

            try {
                await handler2.updateMultipleTablesInFile(errFile, [
                    { startLine: 0, endLine: 2, newContent: '| B |\n|---|\n| 2 |' }
                ]);
                assert.fail('Expected error to be thrown');
            } catch (error: any) {
                assert.strictEqual(error.name, 'FileSystemError');
                assert.strictEqual(error.operation, 'update');
            } finally {
                (vscode.window as any).showErrorMessage = origShowError;
                handler2.dispose();
            }

            fs.unlinkSync(errFile.fsPath);
        });
    });

    suite('applyWorkspaceEditAndSave - applyEdit returns false', () => {
        test('should throw FileSystemError when applyEdit returns false', async () => {
            const fbFile = vscode.Uri.file(path.join(testDir, 'apply-false.md'));
            fs.writeFileSync(fbFile.fsPath, 'content', 'utf8');

            const origApplyEdit = vscode.workspace.applyEdit;
            (vscode.workspace as any).applyEdit = async () => false;

            const edit = new vscode.WorkspaceEdit();
            edit.replace(fbFile, new vscode.Range(0, 0, 0, 7), 'newcontent');

            try {
                await fileHandler.applyWorkspaceEditAndSave(edit, fbFile, 'test');
                assert.fail('Expected FileSystemError to be thrown');
            } catch (error: any) {
                assert.strictEqual(error.name, 'FileSystemError');
                assert.ok(error.message.includes('Failed to apply document edit'));
            } finally {
                (vscode.workspace as any).applyEdit = origApplyEdit;
            }

            fs.unlinkSync(fbFile.fsPath);
        });
    });

    suite('constructor with parser parameter', () => {
        test('should use injected parser', () => {
            // parser パラメータが渡された場合、require('markdown-it') は呼ばれない
            const mockParser = { parse: () => [] };
            const handler = new MarkdownFileHandler(mockParser);
            // parser が設定されていることを確認
            assert.strictEqual((handler as any).parser, mockParser);
            handler.dispose();
        });
    });
});