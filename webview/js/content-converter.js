/**
 * Content Converter Module for Markdown Table Editor
 * 
 * This module provides centralized content conversion utilities for:
 * - Converting <br> tags to newlines (\n)
 * - Converting newlines (\n) to <br> tags
 * - Consistent handling across all modules
 */

const ContentConverter = {
    // Initialization state
    isInitialized: false,
    
    /**
     * Initialize the content converter module
     */
    init: function() {
        // Prevent duplicate initialization
        if (this.isInitialized) {
            console.log('ContentConverter: Already initialized, skipping');
            return;
        }
        
        console.log('ContentConverter: Initializing content converter module...');
        
        this.isInitialized = true;
        console.log('ContentConverter: Module initialized');
    },
    
    /**
     * Convert <br> tags to newlines (\n)
     * Handles various formats: <br>, <br/>, <BR>, <br />, etc.
     * 
     * @param {string} content - Content with <br> tags
     * @returns {string} Content with newlines
     */
    brTagsToNewlines: function(content) {
        if (!content) return '';
        
        // Convert <br> tags to newlines (case-insensitive, with or without closing tag)
        return String(content).replace(/<br\s*\/?>/gi, '\n');
    },
    
    /**
     * Convert newlines (\n) to <br> tags
     * 
     * @param {string} content - Content with newlines
     * @returns {string} Content with <br/> tags
     */
    newlinesToBrTags: function(content) {
        if (!content) return '';
        
        // Convert newlines to <br/> tags for storage
        return String(content).replace(/\n/g, '<br/>');
    },
    
    /**
     * Process content for editing (convert <br> tags to newlines)
     * This is used when content needs to be displayed in text inputs/textareas
     * 
     * @param {string} content - Stored content with <br> tags
     * @returns {string} Content suitable for editing with newlines
     */
    processForEditing: function(content) {
        return this.brTagsToNewlines(content);
    },
    
    /**
     * Process content for storage (convert newlines to <br> tags)
     * This is used when content from text inputs needs to be stored
     * 
     * @param {string} content - Content from text input with newlines
     * @returns {string} Content suitable for storage with <br/> tags
     */
    processForStorage: function(content) {
        return this.newlinesToBrTags(content);
    },
    
    /**
     * Process content for clipboard export (convert <br> tags to newlines)
     * This is used for CSV export and clipboard operations
     * 
     * @param {string} content - Stored content with <br> tags
     * @returns {string} Content suitable for clipboard with newlines
     */
    processForClipboard: function(content) {
        return this.brTagsToNewlines(content);
    }
};

// Make ContentConverter globally available
window.ContentConverter = ContentConverter;

console.log('ContentConverter: Module script loaded');