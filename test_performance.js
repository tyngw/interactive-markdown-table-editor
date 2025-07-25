#!/usr/bin/env node

/**
 * Simple test script to verify that the initialization performance fixes work
 * This script simulates the module loading and initialization process
 */

const fs = require('fs');
const path = require('path');

// Mock DOM and browser globals
global.document = {
    querySelectorAll: () => [],
    createElement: () => ({ setAttribute: () => {}, appendChild: () => {} }),
    addEventListener: () => {},
    getElementById: () => ({ innerHTML: '', appendChild: () => {} }),
    head: { appendChild: () => {} }
};

global.window = global;
global.console = console;

// Track console output
let logCount = 0;
let duplicateInitCount = 0;

const originalConsoleLog = console.log;
console.log = function(...args) {
    const message = args.join(' ');
    logCount++;
    
    // Track specific patterns that indicate duplicate initialization
    if (message.includes('DragDropManager: Setting up drag and drop...')) {
        duplicateInitCount++;
    }
    
    originalConsoleLog.apply(console, args);
};

// Mock acquireVsCodeApi
global.acquireVsCodeApi = () => ({
    postMessage: () => {}
});

// Load and execute JavaScript modules
function loadModule(modulePath) {
    const fullPath = path.join(__dirname, modulePath);
    if (fs.existsSync(fullPath)) {
        const moduleCode = fs.readFileSync(fullPath, 'utf8');
        
        // Remove some problematic window assignment patterns, but keep the important ones
        const cleanCode = moduleCode.replace(/window\.acquireVsCodeApi\s*=.*$/gm, '');
        
        try {
            eval(cleanCode);
            console.log(`✓ Successfully loaded module: ${modulePath}`);
            
            // Check if this module added any global objects
            const moduleGlobals = Object.keys(global).filter(key => 
                key.includes('Manager') || key === 'TableEditor' || key === 'TableRenderer' || key === 'CSVExporter'
            );
            if (moduleGlobals.length > 0) {
                console.log(`  Added globals: ${moduleGlobals.join(', ')}`);
            }
            
            return true;
        } catch (error) {
            console.error(`✗ Failed to load module: ${modulePath}`, error.message);
            return false;
        }
    } else {
        console.error(`✗ Module not found: ${fullPath}`);
        return false;
    }
}

function runTest() {
    console.log('🧪 Starting initialization performance test...\n');
    
    const modules = [
        'webview/js/core.js',
        'webview/js/table-renderer.js',
        'webview/js/drag-drop.js',
        'webview/js/selection.js',
        'webview/js/cell-editor.js',
        'webview/js/sorting.js',
        'webview/js/keyboard-navigation.js',
        'webview/js/clipboard.js',
        'webview/js/column-resize.js',
        'webview/js/context-menu.js',
        'webview/js/status-bar.js',
        'webview/js/csv-exporter.js'
    ];
    
    let loadedModules = 0;
    
    console.log('📦 Loading modules...');
    for (const modulePath of modules) {
        if (loadModule(modulePath)) {
            loadedModules++;
        }
    }
    
    console.log(`\n📊 Loaded ${loadedModules}/${modules.length} modules`);
    
    // Test initialization
    if (global.TableEditor) {
        console.log('\n🔧 Testing TableEditor initialization...');
        
        // Reset counters
        const startLogCount = logCount;
        duplicateInitCount = 0;
        
        // Initialize TableEditor
        global.TableEditor.init();
        
        console.log('\n🔄 Testing multiple module registrations (should be ignored)...');
        
        // Try to register modules multiple times (should be prevented)
        if (global.DragDropManager) {
            for (let i = 0; i < 10; i++) {
                global.DragDropManager.init();
            }
        }
        
        const endLogCount = logCount;
        const totalLogs = endLogCount - startLogCount;
        
        console.log('\n📈 Test Results:');
        console.log(`   Total log messages: ${totalLogs}`);
        console.log(`   DragDropManager setup calls: ${duplicateInitCount}`);
        
        if (duplicateInitCount <= 1) {
            console.log('✅ SUCCESS: Duplicate initialization prevention is working!');
            console.log('   DragDropManager was only initialized once, as expected.');
        } else {
            console.log('❌ FAILURE: Duplicate initializations detected!');
            console.log(`   DragDropManager was initialized ${duplicateInitCount} times.`);
        }
        
        // Test module availability
        console.log('\n🔍 Checking registered modules:');
        const registeredModules = Object.keys(global.TableEditor.modules || {});
        console.log(`   Registered modules: ${registeredModules.join(', ')}`);
        
        if (registeredModules.length > 0) {
            console.log('✅ SUCCESS: Modules are properly registered!');
        } else {
            console.log('❌ FAILURE: No modules were registered!');
        }
        
    } else {
        console.log('❌ TableEditor not found in global scope');
        console.log('🔍 Available global objects:', Object.keys(global).filter(key => key.includes('Manager') || key === 'TableEditor' || key.includes('Table')));
        
        // Try to test individual modules
        if (global.DragDropManager) {
            console.log('\n🔧 Testing DragDropManager directly...');
            
            duplicateInitCount = 0;
            
            // Try multiple initializations
            for (let i = 0; i < 5; i++) {
                console.log(`Attempt ${i + 1}:`);
                global.DragDropManager.init();
            }
            
            console.log('\n📈 DragDropManager Test Results:');
            console.log(`   Setup calls detected: ${duplicateInitCount}`);
            
            if (duplicateInitCount <= 1) {
                console.log('✅ SUCCESS: DragDropManager duplicate initialization prevention is working!');
            } else {
                console.log('❌ FAILURE: DragDropManager was initialized multiple times!');
            }
        }
    }
    
    console.log('\n🏁 Test completed.');
}

// Run the test
runTest();