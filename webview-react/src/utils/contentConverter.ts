/**
 * Content Converter Utilities
 * 
 * Handles content conversion between different formats:
 * - Converting <br> tags to newlines (\n)
 * - Converting newlines (\n) to <br> tags
 * - Consistent handling across all components
 */

// Convert HTML break tags to newlines and properly format for display
export function processCellContent(content: string): string {
  if (!content) return ''
  
  // Convert <br> and <br/> tags to actual HTML <br> tags for display
  let processedContent = content
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(/<BR\s*\/?>/gi, '<br>')
  
  // Escape other HTML content while preserving our <br> tags
  return escapeHtmlExceptBreaks(processedContent)
}

// Convert HTML break tags to newlines for editing
export function processCellContentForEditing(content: string): string {
  if (!content) return ''
  
  // Convert <br> and <br/> tags to newlines for text editing
  return content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<BR\s*\/?>/gi, '\n')
}

// Convert newlines back to <br/> tags for storage
export function processCellContentForStorage(content: string): string {
  if (!content) return ''
  
  // Convert newlines to <br/> tags for Markdown storage
  return content.replace(/\n/g, '<br/>')
}

// Escape HTML content while preserving <br> tags
function escapeHtmlExceptBreaks(text: string): string {
  if (!text) return ''
  
  // First, temporarily replace <br> tags with a placeholder
  const placeholder = '###BR_PLACEHOLDER###'
  let processedText = text.replace(/<br>/gi, placeholder)
  
  // Escape the rest of the HTML
  const div = document.createElement('div')
  div.textContent = processedText
  let escaped = div.innerHTML
  
  // Restore <br> tags
  escaped = escaped.replace(new RegExp(placeholder, 'g'), '<br>')
  
  return escaped
}

// Utility function to escape HTML
export function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export class ContentConverter {
  /**
   * Convert <br> tags to newlines (\n)
   * Handles various formats: <br>, <br/>, <BR>, <br />, etc.
   */
  static brTagsToNewlines(content: string): string {
    return processCellContentForEditing(content)
  }
  
  /**
   * Convert newlines (\n) to <br> tags
   */
  static newlinesToBrTags(content: string): string {
    return processCellContentForStorage(content)
  }
  
  /**
   * Process content for editing (convert <br> tags to newlines)
   * This is used when content needs to be displayed in text inputs/textareas
   */
  static processForEditing(content: string): string {
    return processCellContentForEditing(content)
  }
  
  /**
   * Process content for storage (convert newlines to <br> tags)
   * This is used when content from text inputs needs to be stored
   */
  static processForStorage(content: string): string {
    return processCellContentForStorage(content)
  }
  
  /**
   * Process content for clipboard export (convert <br> tags to newlines)
   * This is used for CSV export and clipboard operations
   */
  static processForClipboard(content: string): string {
    return processCellContentForEditing(content)
  }
}