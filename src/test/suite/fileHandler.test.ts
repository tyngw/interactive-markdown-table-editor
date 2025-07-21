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

        test('should create backup before updating', async () => {
            // Clean up any existing backup files first
            const existingBackups = fs.readdirSync(testDir).filter(file => 
                file.startsWith('test.md.backup-')
            );
            existingBackups.forEach(backup => {
                fs.unlinkSync(path.join(testDir, backup));
            });
            
            const originalContent = '# Test\n\n| A | B |\n|---|---|\n| 1 | 2 |';
            fs.writeFileSync(testFile.fsPath, originalContent, 'utf8');
            
            await fileHandler.updateTableInFile(testFile, 2, 4, '| X | Y |\n|---|---|\n| 3 | 4 |');
            
            // Check if backup file was created
            const backupFiles = fs.readdirSync(testDir).filter(file => 
                file.startsWith('test.md.backup-')
            );
            assert.ok(backupFiles.length > 0, 'Backup file should be created');
            
            // Verify backup content - should match the original content before update
            const backupPath = path.join(testDir, backupFiles[0]);
            const backupContent = fs.readFileSync(backupPath, 'utf8');
            assert.strictEqual(backupContent, originalContent);
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

    suite('createBackup', () => {
        test('should create backup with timestamp', async () => {
            const content = '# Test Content';
            fs.writeFileSync(testFile.fsPath, content, 'utf8');
            
            const backupPath = await fileHandler.createBackup(testFile);
            
            assert.ok(backupPath.includes('.backup-'));
            assert.ok(fs.existsSync(backupPath));
            
            const backupContent = fs.readFileSync(backupPath, 'utf8');
            assert.strictEqual(backupContent, content);
        });

        test('should return empty string if backup fails', async () => {
            const nonExistentFile = vscode.Uri.file(path.join(testDir, 'nonexistent.md'));
            
            const backupPath = await fileHandler.createBackup(nonExistentFile);
            assert.strictEqual(backupPath, '');
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
});