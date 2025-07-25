const fs = require('fs');
const path = require('path');

console.log('=== Core Module System Verification ===\n');

// Test 1: Check if core module file exists
const coreModulePath = path.join(__dirname, 'webview/js/core.js');
console.log('1. Core module file exists:', fs.existsSync(coreModulePath) ? '✓' : '✗');

if (fs.existsSync(coreModulePath)) {
    const coreContent = fs.readFileSync(coreModulePath, 'utf8');
    
    // Test 2: Check core module structure
    const checks = [
        ['TableEditor object defined', coreContent.includes('const TableEditor')],
        ['State management', coreContent.includes('state:')],
        ['Module registry', coreContent.includes('modules:')],
        ['registerModule method', coreContent.includes('registerModule:')],
        ['loadModule method', coreContent.includes('loadModule:')],
        ['callModule method', coreContent.includes('callModule:')],
        ['Error handling', coreContent.includes('handleModuleError')],
        ['VSCode API initialization', coreContent.includes('acquireVsCodeApi') && coreContent.includes('typeof acquireVsCodeApi')],
        ['Global error handling', coreContent.includes('setupErrorHandling')],
        ['Diagnostics method', coreContent.includes('getDiagnostics')],
        ['Environment detection', coreContent.includes('isVSCodeEnvironment')],
        ['Mock VSCode API fallback', coreContent.includes('Mock VSCode API')]
    ];
    
    console.log('\n2. Core module structure:');
    checks.forEach(([name, passed]) => {
        console.log(`   ${name}: ${passed ? '✓' : '✗'}`);
    });
}

// Test 3: Check if test module file exists
const testModulePath = path.join(__dirname, 'webview/js/test-module.js');
console.log('\n3. Test module file exists:', fs.existsSync(testModulePath) ? '✓' : '✗');

if (fs.existsSync(testModulePath)) {
    const testContent = fs.readFileSync(testModulePath, 'utf8');
    
    const testChecks = [
        ['TestModule object defined', testContent.includes('const TestModule')],
        ['Init method', testContent.includes('init:')],
        ['getMessage method', testContent.includes('getMessage')],
        ['Module registration', testContent.includes('registerModule')]
    ];
    
    console.log('\n4. Test module structure:');
    testChecks.forEach(([name, passed]) => {
        console.log(`   ${name}: ${passed ? '✓' : '✗'}`);
    });
}

// Test 4: Check webviewManager.ts
const webviewManagerPath = path.join(__dirname, 'src/webviewManager.ts');
console.log('\n5. WebviewManager updated:', fs.existsSync(webviewManagerPath) ? '✓' : '✗');

if (fs.existsSync(webviewManagerPath)) {
    const managerContent = fs.readFileSync(webviewManagerPath, 'utf8');
    
    const managerChecks = [
        ['Includes core.js', managerContent.includes('js/core.js')],
        ['Includes test-module.js', managerContent.includes('js/test-module.js')],
        ['Script URI generation', managerContent.includes('scriptUris')],
        ['Local resource roots', managerContent.includes('localResourceRoots') && managerContent.includes('webview')]
    ];
    
    console.log('\n6. WebviewManager configuration:');
    managerChecks.forEach(([name, passed]) => {
        console.log(`   ${name}: ${passed ? '✓' : '✗'}`);
    });
}

// Test 5: Check HTML file
const htmlPath = path.join(__dirname, 'webview/tableEditor.html');
console.log('\n7. HTML file updated:', fs.existsSync(htmlPath) ? '✓' : '✗');

if (fs.existsSync(htmlPath)) {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    const htmlChecks = [
        ['Script loading mechanism', htmlContent.includes('window.scriptUris')],
        ['Sequential loading', htmlContent.includes('loadNextScript')],
        ['Test UI', htmlContent.includes('testModuleSystem')],
        ['CSP allows vscode-resource', htmlContent.includes('script-src') && htmlContent.includes('vscode-resource:')]
    ];
    
    console.log('\n8. HTML file configuration:');
    htmlChecks.forEach(([name, passed]) => {
        console.log(`   ${name}: ${passed ? '✓' : '✗'}`);
    });
}

console.log('\n=== Verification Complete ===');
console.log('\nTo test the module system:');
console.log('1. Open a markdown file with a table in VSCode');
console.log('2. Run "Markdown Table Editor: Edit Table" command');
console.log('3. Click the "Test Modules" button in the top-right corner');
console.log('4. Check the test results in the module test panel');