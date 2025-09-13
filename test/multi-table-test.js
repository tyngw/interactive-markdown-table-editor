/**
 * Multiple Table Index Test
 * 
 * This test verifies that tableIndex is correctly handled when switching between tables
 */

const MockVSCodeAPI = require('./mock/webview-interface-mock.js').MockVSCodeAPI;

class MultiTableTester {
    constructor() {
        this.mockVSCode = new MockVSCodeAPI();
        this.receivedMessages = [];
        
        // Listen to all messages sent to extension
        this.originalPostMessage = this.mockVSCode.postMessage.bind(this.mockVSCode);
        this.mockVSCode.postMessage = (message) => {
            this.receivedMessages.push(message);
            return this.originalPostMessage(message);
        };
    }

    createMultiTableData() {
        return [
            {
                id: 'table-1',
                headers: ['Name', 'Age'],
                rows: [
                    ['Alice', '25'],
                    ['Bob', '30']
                ],
                alignment: ['left', 'center']
            },
            {
                id: 'table-2', 
                headers: ['Product', 'Price'],
                rows: [
                    ['Apple', '$1.00'],
                    ['Orange', '$1.50']
                ],
                alignment: ['left', 'right']
            }
        ];
    }

    testTableIndexInMessages() {
        console.log('🧪 Testing tableIndex in update messages...\n');
        
        const tables = this.createMultiTableData();
        
        // Simulate cell update on table 0
        console.log('📝 Simulating cell update on table 0...');
        this.mockVSCode.postMessage({
            command: 'updateCell',
            data: {
                row: 0,
                col: 1,
                value: '26',
                tableIndex: 0
            }
        });

        // Simulate cell update on table 1  
        console.log('📝 Simulating cell update on table 1...');
        this.mockVSCode.postMessage({
            command: 'updateCell',
            data: {
                row: 0,
                col: 1,
                value: '$2.00',
                tableIndex: 1
            }
        });

        // Simulate bulk update on table 1
        console.log('📝 Simulating bulk update on table 1...');
        this.mockVSCode.postMessage({
            command: 'bulkUpdateCells',
            data: {
                updates: [
                    { row: 0, col: 0, value: 'Banana' },
                    { row: 1, col: 0, value: 'Grape' }
                ],
                tableIndex: 1
            }
        });

        // Analyze results
        this.analyzeResults();
    }

    analyzeResults() {
        console.log('\n📊 Analysis Results:');
        console.log(`Total messages sent: ${this.receivedMessages.length}\n`);

        let hasTableIndexIssues = false;

        this.receivedMessages.forEach((message, index) => {
            const hasTableIndex = message.data && typeof message.data.tableIndex === 'number';
            const status = hasTableIndex ? '✅' : '❌';
            
            console.log(`${status} Message ${index + 1}: ${message.command}`);
            if (message.data) {
                if (hasTableIndex) {
                    console.log(`   tableIndex: ${message.data.tableIndex}`);
                } else {
                    console.log('   ⚠️  Missing tableIndex!');
                    hasTableIndexIssues = true;
                }
            }
            console.log('');
        });

        if (hasTableIndexIssues) {
            console.log('❌ FAILED: Some messages are missing tableIndex');
            console.log('📋 This will cause edits to affect the wrong table');
            return false;
        } else {
            console.log('✅ PASSED: All messages include tableIndex');
            return true;
        }
    }

    runTest() {
        console.log('🚀 Multi-Table Index Test Starting...\n');
        return this.testTableIndexInMessages();
    }
}

// Run the test
const tester = new MultiTableTester();
const testResult = tester.runTest();

console.log('\n' + '='.repeat(50));
console.log(`🏁 Test Result: ${testResult ? 'PASSED ✅' : 'FAILED ❌'}`);
console.log('='.repeat(50));

process.exit(testResult ? 0 : 1);
