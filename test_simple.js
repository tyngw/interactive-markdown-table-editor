#!/usr/bin/env node

/**
 * Simple test to verify isInitialized flag works
 */

// Mock DOM 
global.document = {
    querySelectorAll: () => [],
    getElementById: () => null
};

global.window = global;

// Simple console tracking
let logMessages = [];
const originalConsoleLog = console.log;
console.log = function(...args) {
    const message = args.join(' ');
    logMessages.push(message);
    originalConsoleLog.apply(console, args);
};

// Create a simple module to test
const TestModule = {
    isInitialized: false,
    
    init: function() {
        if (this.isInitialized) {
            console.log('TestModule: Already initialized, skipping');
            return;
        }
        
        console.log('TestModule: Initializing...');
        this.isInitialized = true;
        console.log('TestModule: Initialized');
    }
};

console.log('🧪 Testing isInitialized flag...\n');

// Test multiple calls
console.log('Calling init() 3 times:');
TestModule.init();
TestModule.init();
TestModule.init();

console.log('\n📊 Results:');
const initMessages = logMessages.filter(msg => msg.includes('Initializing'));
const skipMessages = logMessages.filter(msg => msg.includes('Already initialized'));

console.log(`Initialization messages: ${initMessages.length}`);
console.log(`Skip messages: ${skipMessages.length}`);

if (initMessages.length === 1 && skipMessages.length === 2) {
    console.log('✅ SUCCESS: isInitialized flag works correctly!');
} else {
    console.log('❌ FAILURE: isInitialized flag not working properly');
    console.log('All messages:', logMessages);
}

// Now test our actual DragDropManager
console.log('\n🔧 Testing actual DragDropManager...');

// Load the actual module
const fs = require('fs');
const path = require('path');

const dragDropCode = fs.readFileSync(path.join(__dirname, 'webview/js/drag-drop.js'), 'utf8');
eval(dragDropCode);

logMessages = [];
console.log('\nCalling DragDropManager.init() 3 times:');

try {
    global.DragDropManager.init();
} catch (e) {
    console.log('First call error:', e.message);
}

try {
    global.DragDropManager.init();
} catch (e) {
    console.log('Second call error:', e.message);
}

try {
    global.DragDropManager.init();
} catch (e) {
    console.log('Third call error:', e.message);
}

console.log('\n📊 DragDropManager Results:');
const dragInitMessages = logMessages.filter(msg => msg.includes('DragDropManager: Initializing'));
const dragSkipMessages = logMessages.filter(msg => msg.includes('Already initialized'));

console.log(`DragDropManager initialization messages: ${dragInitMessages.length}`);
console.log(`DragDropManager skip messages: ${dragSkipMessages.length}`);

if (dragInitMessages.length === 1 && dragSkipMessages.length === 2) {
    console.log('✅ SUCCESS: DragDropManager isInitialized flag works!');
} else {
    console.log('❌ FAILURE: DragDropManager isInitialized flag not working');
    console.log('Relevant messages:', logMessages.filter(msg => 
        msg.includes('DragDropManager') && (msg.includes('Initializing') || msg.includes('Already'))
    ));
}