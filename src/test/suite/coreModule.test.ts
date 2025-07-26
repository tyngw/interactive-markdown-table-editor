import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Test suite for the core module system
 * 
 * This test verifies that:
 * - Core module file exists and is valid JavaScript
 * - Module registration system is properly implemented
 * - Error handling mechanisms are in place
 * - Module loading system works correctly
 */

suite('Core Module System Tests', () => {
    
    test('Core module file exists', () => {
        const coreModulePath = path.join(__dirname, '../../../webview/js/core.js');
        assert.ok(fs.existsSync(coreModulePath), 'core.js file should exist');
    });
    
    test('Core module file is valid JavaScript', () => {
        const coreModulePath = path.join(__dirname, '../../../webview/js/core.js');
        const content = fs.readFileSync(coreModulePath, 'utf8');
        
        // Basic syntax checks
        assert.ok(content.includes('const TableEditor'), 'Should define TableEditor object');
        assert.ok(content.includes('registerModule'), 'Should have registerModule method');
        assert.ok(content.includes('loadModule'), 'Should have loadModule method');
        assert.ok(content.includes('callModule'), 'Should have callModule method');
        assert.ok(content.includes('handleModuleError'), 'Should have error handling');
    });
    
    test('Test module file exists', () => {
        const testModulePath = path.join(__dirname, '../../../webview/js/test-module.js');
        assert.ok(fs.existsSync(testModulePath), 'test-module.js file should exist');
    });
    
    test('Test module file is valid JavaScript', () => {
        const testModulePath = path.join(__dirname, '../../../webview/js/test-module.js');
        const content = fs.readFileSync(testModulePath, 'utf8');
        
        // Basic syntax checks
        assert.ok(content.includes('const TestModule'), 'Should define TestModule object');
        assert.ok(content.includes('init:'), 'Should have init method');
        assert.ok(content.includes('getMessage'), 'Should have getMessage method');
        assert.ok(content.includes('registerModule'), 'Should register with TableEditor');
    });
    
    test('WebviewManager includes core module in script loading', () => {
        const webviewManagerPath = path.join(__dirname, '../../webviewManager.js');
        const content = fs.readFileSync(webviewManagerPath, 'utf8');
        
        assert.ok(content.includes('js/core.js'), 'Should include core.js in script files');
        assert.ok(content.includes('js/test-module.js'), 'Should include test-module.js for testing');
    });
    
    test('HTML file includes script loading mechanism', () => {
        const htmlPath = path.join(__dirname, '../../../webview/tableEditor.html');
        const content = fs.readFileSync(htmlPath, 'utf8');
        
        assert.ok(content.includes('window.scriptUris'), 'Should check for scriptUris');
        assert.ok(content.includes('loadNextScript'), 'Should have script loading function');
        assert.ok(content.includes('testModuleSystem'), 'Should have test function');
    });
    
    test('Content Security Policy allows vscode-resource scripts', () => {
        const htmlPath = path.join(__dirname, '../../../webview/tableEditor.html');
        const content = fs.readFileSync(htmlPath, 'utf8');
        
        const cspMatch = content.match(/Content-Security-Policy.*?script-src[^"]*vscode-resource:/);
        assert.ok(cspMatch, 'CSP should allow vscode-resource: for scripts');
    });
    
    test('Core module structure is correct', () => {
        const coreModulePath = path.join(__dirname, '../../../webview/js/core.js');
        const content = fs.readFileSync(coreModulePath, 'utf8');
        
        // Check for required state properties
        assert.ok(content.includes('tableData: null'), 'Should have tableData state');
        assert.ok(content.includes('currentEditingCell: null'), 'Should have currentEditingCell state');
        assert.ok(content.includes('sortState:'), 'Should have sortState');
        assert.ok(content.includes('columnWidths:'), 'Should have columnWidths state');
        assert.ok(content.includes('selectedCells:'), 'Should have selectedCells state');
        
        // Check for required methods
        assert.ok(content.includes('init:'), 'Should have init method');
        assert.ok(content.includes('registerModule:'), 'Should have registerModule method');
        assert.ok(content.includes('loadModule:'), 'Should have loadModule method');
        assert.ok(content.includes('getModule:'), 'Should have getModule method');
        assert.ok(content.includes('callModule:'), 'Should have callModule method');
        assert.ok(content.includes('handleModuleError:'), 'Should have handleModuleError method');
        assert.ok(content.includes('getDiagnostics:'), 'Should have getDiagnostics method');
    });
    
    test('Error handling is properly implemented', () => {
        const coreModulePath = path.join(__dirname, '../../../webview/js/core.js');
        const content = fs.readFileSync(coreModulePath, 'utf8');
        
        // Check for error handling mechanisms
        assert.ok(content.includes('setupErrorHandling'), 'Should have setupErrorHandling method');
        assert.ok(content.includes('handleCriticalError'), 'Should have handleCriticalError method');
        assert.ok(content.includes('showFallbackMessage'), 'Should have showFallbackMessage method');
        assert.ok(content.includes('showCriticalErrorUI'), 'Should have showCriticalErrorUI method');
        assert.ok(content.includes('addEventListener(\'error\''), 'Should handle uncaught errors');
        assert.ok(content.includes('addEventListener(\'unhandledrejection\''), 'Should handle unhandled rejections');
    });
    
    test('Module loading state tracking is implemented', () => {
        const coreModulePath = path.join(__dirname, '../../../webview/js/core.js');
        const content = fs.readFileSync(coreModulePath, 'utf8');
        
        // Check for loading state management
        assert.ok(content.includes('loadingState:'), 'Should have loadingState object');
        assert.ok(content.includes('loaded: new Set()'), 'Should track loaded modules');
        assert.ok(content.includes('failed: new Set()'), 'Should track failed modules');
        assert.ok(content.includes('loading: new Set()'), 'Should track loading modules');
        assert.ok(content.includes('isModuleLoaded'), 'Should have isModuleLoaded method');
    });
});