/**
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