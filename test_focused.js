#!/usr/bin/env node

/**
 * Focused test to verify duplicate initialization prevention
 */

const fs = require('fs');
const path = require('path');

// Track initialization attempts
let initializationAttempts = {
    DragDropManager: 0,
    TableRenderer: 0,
    total: 0
};

// Track specific log messages
let setupDragDropCalls = 0;

// Mock DOM APIs that are needed
global.document = {
    querySelectorAll: () => [],
    createElement: () => ({ 
        setAttribute: () => {}, 
        appendChild: () => {},
        addEventListener: () => {} 
    }),
    addEventListener: () => {},
    getElementById: () => ({ 
        innerHTML: '', 
        appendChild: () => {},
        scrollTop: 0,
        scrollHeight: 0
    }),
    head: { appendChild: () => {} }
};

global.window = global;

// Mock console.log to track specific patterns
const originalConsoleLog = console.log;
console.log = function(...args) {
    const message = args.join(' ');
    
    // Track initialization attempts
    if (message.includes('Initializing') && message.includes('module')) {
        initializationAttempts.total++;
        if (message.includes('DragDropManager')) {
            initializationAttempts.DragDropManager++;
        } else if (message.includes('TableRenderer')) {
            initializationAttempts.TableRenderer++;
        }
    }
    
    // Track setup calls
    if (message.includes('DragDropManager: Setting up drag and drop...')) {
        setupDragDropCalls++;
    }
    
    originalConsoleLog.apply(console, args);
};

// Mock VSCode API
global.acquireVsCodeApi = () => ({ postMessage: () => {} });

function loadModuleCode(modulePath) {
    const fullPath = path.join(__dirname, modulePath);
    if (fs.existsSync(fullPath)) {
        return fs.readFileSync(fullPath, 'utf8');
    }
    return null;
}

function runFocusedTest() {
    console.log('🎯 Running focused initialization test...\n');
    
    // Load core modules
    const coreCode = loadModuleCode('webview/js/core.js');
    const dragDropCode = loadModuleCode('webview/js/drag-drop.js');
    
    if (!coreCode || !dragDropCode) {
        console.log('❌ Failed to load required modules');
        return;
    }
    
    console.log('📦 Loading core modules...');
    
    // Execute core module
    eval(coreCode);
    console.log('✓ Core module loaded');
    
    // Execute drag-drop module  
    eval(dragDropCode);
    console.log('✓ DragDropManager module loaded');
    
    console.log('\n🔄 Testing multiple initialization attempts...');
    
    // Reset counters
    initializationAttempts = {
        DragDropManager: 0,
        TableRenderer: 0,
        total: 0
    };
    setupDragDropCalls = 0;
    
    // Try to initialize DragDropManager multiple times
    console.log('\nAttempting DragDropManager initialization 5 times:');
    for (let i = 1; i <= 5; i++) {
        console.log(`\n--- Attempt ${i} ---`);
        try {
            global.DragDropManager.init();
        } catch (error) {
            console.log(`Error on attempt ${i}: ${error.message}`);
        }
    }
    
    // Test results
    console.log('\n📊 Test Results:');
    console.log(`   DragDropManager initialization attempts: ${initializationAttempts.DragDropManager}`);
    console.log(`   "Setting up drag and drop" calls: ${setupDragDropCalls}`);
    
    // Validation
    if (initializationAttempts.DragDropManager === 1) {
        console.log('✅ SUCCESS: DragDropManager initialized only once!');
    } else {
        console.log(`❌ FAILURE: DragDropManager initialized ${initializationAttempts.DragDropManager} times!`);
    }
    
    if (setupDragDropCalls <= 1) {
        console.log('✅ SUCCESS: Setup function called only once!');
    } else {
        console.log(`❌ FAILURE: Setup function called ${setupDragDropCalls} times!`);
    }
    
    // Test with TableEditor registration
    if (global.TableEditor) {
        console.log('\n🔧 Testing TableEditor module registration...');
        
        // Reset
        const previousModules = Object.keys(global.TableEditor.modules || {}).length;
        
        // Try to register the same module multiple times
        console.log('\nAttempting to register DragDropManager 3 times:');
        for (let i = 1; i <= 3; i++) {
            console.log(`\nRegistration attempt ${i}:`);
            global.TableEditor.registerModule('DragDropManager', global.DragDropManager);
        }
        
        const currentModules = Object.keys(global.TableEditor.modules || {}).length;
        const dragDropRegistrations = global.TableEditor.modules.DragDropManager ? 1 : 0;
        
        console.log('\n📊 Registration Results:');
        console.log(`   Total registered modules: ${currentModules}`);
        console.log(`   DragDropManager registered: ${dragDropRegistrations ? 'Yes' : 'No'}`);
        
        if (dragDropRegistrations === 1) {
            console.log('✅ SUCCESS: Module registration prevented duplicates!');
        } else {
            console.log('❌ FAILURE: Module registration issues detected!');
        }
    }
    
    console.log('\n🏁 Focused test completed.');
    
    // Summary
    console.log('\n📋 Summary:');
    const allTestsPassed = 
        initializationAttempts.DragDropManager === 1 && 
        setupDragDropCalls <= 1;
    
    if (allTestsPassed) {
        console.log('🎉 ALL TESTS PASSED: Duplicate initialization prevention is working correctly!');
    } else {
        console.log('💥 SOME TESTS FAILED: Duplicate initialization prevention needs improvement.');
    }
}

runFocusedTest();