import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test suite for the core module system
 * 
 * This test suite was deprecated as the project migrated to React-based webview.
 * The test cases below verify compatibility with the new architecture.
 */

suite('Core Module System Tests', () => {
    
    test('React webview build exists', () => {
        const webviewPath = path.join(__dirname, '../../webview');
        assert.ok(fs.existsSync(webviewPath), 'React webview build should exist at ' + webviewPath);
    });
    
    test('Webview index.html is valid', () => {
        const htmlPath = path.join(__dirname, '../../webview/index.html');
        assert.ok(fs.existsSync(htmlPath), 'index.html should exist at ' + htmlPath);
        
        const content = fs.readFileSync(htmlPath, 'utf8');
        assert.ok(content.includes('<!DOCTYPE html>'), 'Should be valid HTML');
        assert.ok(content.includes('<head>'), 'Should have head element');
        assert.ok(content.includes('<body>'), 'Should have body element');
    });
    
    test('Webview assets are built', () => {
        const assetsPath = path.join(__dirname, '../../webview/assets');
        assert.ok(fs.existsSync(assetsPath), 'Assets directory should exist at ' + assetsPath);
        
        // Check for main script
        const files = fs.readdirSync(assetsPath);
        assert.ok(files.some(f => f.startsWith('index') && f.endsWith('.js')), 'Should have main JS file');
    });
});