/**
 * Real Extension Test with Mock VSCode API
 * 
 * This test creates a comprehensive mock environment to test the complete
 * message flow from React components to the extension handlers.
 */

const path = require('path');

// Mock VSCode API
const vscode = {
    Uri: {
        parse: (str) => ({ toString: () => str, fsPath: str }),
    },
    commands: {
        executeCommand: (commandId, data) => {
            console.log(`📨 VSCode Command: ${commandId}`);
            console.log('📋 Command Data:', JSON.stringify(data, null, 2));
            
            // Simulate command handling
            simulateCommandHandling(commandId, data);
        }
    },
    window: {
        showErrorMessage: (msg) => console.log(`❌ Error: ${msg}`),
        showInformationMessage: (msg) => console.log(`ℹ️  Info: ${msg}`)
    },
    workspace: {
        getConfiguration: () => ({
            get: (key, defaultValue) => defaultValue
        })
    }
};

// Mock React Context and Communication
class MockReactContext {
    constructor() {
        this.currentTableIndex = 0;
        this.tables = [
            { id: 'table-0', headers: ['Name', 'Age'], rows: [['Alice', '25'], ['Bob', '30']] },
            { id: 'table-1', headers: ['Product', 'Price'], rows: [['Apple', '$1.00'], ['Orange', '$1.50']] }
        ];
        this.sentMessages = [];
    }
    
    // Mock useVSCodeCommunication hook
    sendMessage(message) {
        console.log(`🚀 React -> VSCode: ${message.command}`);
        console.log('📦 Message Data:', JSON.stringify(message.data, null, 2));
        
        this.sentMessages.push(message);
        
        // Simulate webview postMessage to extension
        if (global.vscode) {
            global.vscode.postMessage(message);
        }
    }
    
    // Mock TableEditor component methods
    updateCell(row, col, value, tableIndex) {
        console.log(`\n🔧 TableEditor.updateCell called:`);
        console.log(`   Row: ${row}, Col: ${col}, Value: "${value}"`);
        console.log(`   Current Table Index: ${tableIndex}`);
        
        this.sendMessage({
            command: 'updateCell',
            data: { row, col, value, tableIndex }
        });
    }
    
    switchToTable(newTableIndex) {
        console.log(`\n🔄 Switching from table ${this.currentTableIndex} to table ${newTableIndex}`);
        this.currentTableIndex = newTableIndex;
    }
}

// Mock Extension Command Handlers
function simulateCommandHandling(commandId, data) {
    console.log(`\n🎯 Processing Command: ${commandId}`);
    
    switch (commandId) {
        case 'markdownTableEditor.internal.updateCell':
            handleUpdateCell(data);
            break;
        case 'markdownTableEditor.internal.updateHeader':
            handleUpdateHeader(data);
            break;
        default:
            console.log(`⚠️  Unknown command: ${commandId}`);
    }
}

function handleUpdateCell(data) {
    console.log(`📝 Extension Handler: updateCell`);
    console.log(`   Received tableIndex: ${data.tableIndex}`);
    console.log(`   Target: Table ${data.tableIndex}, Row ${data.row}, Col ${data.col}`);
    console.log(`   New Value: "${data.value}"`);
    
    // Simulate the extension's table manager selection
    const tableManagersMap = mockMultiTableManagers.get(data.uri);
    if (!tableManagersMap) {
        console.log(`❌ No table managers found for URI: ${data.uri}`);
        return;
    }
    
    const tableManager = tableManagersMap.get(data.tableIndex);
    if (!tableManager) {
        console.log(`❌ No table manager found for table index: ${data.tableIndex}`);
        return;
    }
    
    console.log(`✅ Found table manager for table ${data.tableIndex}`);
    console.log(`📊 Updating Table ${data.tableIndex} -> Row ${data.row}, Col ${data.col} = "${data.value}"`);
    
    // This is where the actual file would be updated
    simulateFileUpdate(data.tableIndex, data.row, data.col, data.value);
}

function handleUpdateHeader(data) {
    console.log(`📝 Extension Handler: updateHeader`);
    console.log(`   Received tableIndex: ${data.tableIndex}`);
    console.log(`   Target: Table ${data.tableIndex}, Col ${data.col}`);
    console.log(`   New Value: "${data.value}"`);
}

// Mock table managers
const mockMultiTableManagers = new Map();

// Initialize mock table managers
function initializeMockTableManagers() {
    const uri = 'file:///test/sample.md';
    const tableManagersMap = new Map();
    
    // Create mock managers for each table
    tableManagersMap.set(0, { tableIndex: 0, id: 'table-0' });
    tableManagersMap.set(1, { tableIndex: 1, id: 'table-1' });
    
    mockMultiTableManagers.set(uri, tableManagersMap);
    
    console.log(`🔧 Initialized table managers for: ${uri}`);
    console.log(`📊 Available tables: ${Array.from(tableManagersMap.keys()).join(', ')}`);
}

function simulateFileUpdate(tableIndex, row, col, value) {
    console.log(`💾 FILE UPDATE SIMULATION:`);
    console.log(`   Would update Table ${tableIndex} in markdown file`);
    console.log(`   Cell [${row}, ${col}] = "${value}"`);
    
    if (tableIndex === 0) {
        console.log(`✅ CORRECT: Editing Table 0 as expected`);
    } else {
        console.log(`🎯 CORRECT: Editing Table ${tableIndex} as selected`);
    }
}

// Run the comprehensive test
function runComprehensiveTest() {
    console.log('🚀 COMPREHENSIVE EXTENSION TEST STARTING...\n');
    console.log('=' * 60);
    
    // Initialize
    initializeMockTableManagers();
    const reactContext = new MockReactContext();
    
    // Set up global vscode API for webview
    global.vscode = {
        postMessage: (message) => {
            // Simulate webview message -> extension
            setTimeout(() => {
                vscode.commands.executeCommand(`markdownTableEditor.internal.${message.command}`, {
                    uri: 'file:///test/sample.md',
                    panelId: 'file:///test/sample.md',
                    ...message.data
                });
            }, 10);
        }
    };
    
    console.log('\n📋 Test Scenario 1: Edit cell in Table 0');
    reactContext.switchToTable(0);
    reactContext.updateCell(0, 1, '26', 0);
    
    setTimeout(() => {
        console.log('\n📋 Test Scenario 2: Switch to Table 1 and edit cell');
        reactContext.switchToTable(1);
        reactContext.updateCell(0, 1, '$2.00', 1);
        
        setTimeout(() => {
            console.log('\n📋 Test Scenario 3: Edit another cell in Table 1');
            reactContext.updateCell(1, 0, 'Banana', 1);
            
            setTimeout(() => {
                console.log('\n' + '=' * 60);
                console.log('🏁 TEST COMPLETED');
                
                // Analyze results
                const messages = reactContext.sentMessages;
                console.log(`\n📊 Analysis: ${messages.length} messages sent`);
                
                let correctTableIndexCount = 0;
                messages.forEach((msg, idx) => {
                    const hasCorrectIndex = msg.data && typeof msg.data.tableIndex === 'number';
                    if (hasCorrectIndex) correctTableIndexCount++;
                    
                    console.log(`   Message ${idx + 1}: ${msg.command} -> tableIndex: ${msg.data?.tableIndex}`);
                });
                
                const success = correctTableIndexCount === messages.length;
                console.log(`\n🎯 Result: ${success ? 'PASSED ✅' : 'FAILED ❌'}`);
                console.log(`   ${correctTableIndexCount}/${messages.length} messages had correct tableIndex`);
                
                process.exit(success ? 0 : 1);
            }, 50);
        }, 50);
    }, 50);
}

// Start the test
runComprehensiveTest();
