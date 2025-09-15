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