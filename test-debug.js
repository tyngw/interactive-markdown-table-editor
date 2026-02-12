const fh = require('./out/src/fileHandler');
const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function test() {
  const handler = new fh.MarkdownFileHandler();
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-test-'));
  const testFile = vscode.Uri.file(path.join(testDir, 'test.md'));
  fs.writeFileSync(testFile.fsPath, 'Line 1\nLine 2\nLine 3', 'utf8');
  
  try {
    await handler.updateTableInFile(testFile, 5, 10, 'New content');
    console.log('No error thrown!');
  } catch (error) {
    console.log('Error type:', typeof error);
    console.log('Error constructor:', error.constructor && error.constructor.name);
    console.log('Error name:', error.name);
    console.log('Error message:', error.message);
    console.log('instanceof FileSystemError:', error instanceof fh.FileSystemError);
    console.log('Same prototype?', Object.getPrototypeOf(error) === fh.FileSystemError.prototype);
    console.log('operation:', error.operation);
  }
  
  // Clean up
  fs.unlinkSync(testFile.fsPath);
  fs.rmdirSync(testDir);
}
test().catch(e => console.log('Outer error:', e));
