/**
 * ⚠️ DEPRECATED: このLegacy WebviewのJSモジュールは廃止されました ⚠️
 * 
 * このファイルは後方互換性のためにのみ保持されています。
 * 新しい開発やメンテナンスは webview-react/src/__tests__/ で行われています。
 * React版への移行が完了次第、このファイルは削除予定です。
 * 
 * Test Module for Markdown Table Editor
 * 
 * This is a test module that demonstrates the module system functionality.
 * Used by automated tests to verify module registration and communication.
 */

const TestModule = {
    name: 'TestModule',
    version: '1.0.0',
    
    /**
     * Initialize the test module
     */
    init: function() {
        console.log('TestModule initialized');
        return true;
    },
    
    /**
     * Get a test message
     */
    getMessage: function() {
        return 'Hello from TestModule';
    },
    
    /**
     * Test method for validation
     */
    testMethod: function(data) {
        return {
            success: true,
            message: 'Test method executed successfully',
            data: data
        };
    },
    
    /**
     * Get module status
     */
    getStatus: function() {
        return {
            loaded: true,
            functional: true,
            lastTest: new Date().toISOString()
        };
    }
};

// Register this module with the TableEditor system
if (typeof TableEditor !== 'undefined' && TableEditor.registerModule) {
    TableEditor.registerModule('TestModule', TestModule);
} else {
    console.warn('TableEditor not available for TestModule registration');
}