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
  
  // Unescape pipe characters for display
  let processedContent = unescapePipeCharacters(content)
    .replace(/<br\s*\/?>/gi, '<br>')
    .replace(/<BR\s*\/?>/gi, '<br>')
  
  // Escape other HTML content while preserving our <br> tags
  return escapeHtmlExceptBreaks(processedContent)
}

// Convert HTML break tags to newlines for editing
export function processCellContentForEditing(content: string): string {
  if (!content) return ''
  
  // Convert <br> and <br/> tags to newlines for text editing
  // Also unescape pipe characters for editing
  return unescapePipeCharacters(
    content
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<BR\s*\/?>/gi, '\n')
  )
}

// Convert newlines back to <br/> tags for storage
export function processCellContentForStorage(content: string): string {
  if (!content) return ''
  
  // Convert newlines to <br/> tags for Markdown storage
  // Also escape pipe characters for Markdown table format
  return escapePipeCharacters(content.replace(/\n/g, '<br/>'))
}

/**
 * Convert <br> tags to newlines for clipboard/export operations
 * This is used for CSV export, clipboard copy, etc.
 */
export function convertBrTagsToNewlines(content: string): string {
  if (!content) return ''
  
  // Convert all variations of <br> tags to newlines
  return content.replace(/<br\s*\/?>/gi, '\n')
}

/**
 * Convert newlines to <br/> tags for import operations
 * This is used for CSV import, clipboard paste, etc.
 */
export function convertNewlinesToBrTags(content: string): string {
  if (!content) return ''
  
  // Convert newlines to <br/> tags
  return content.replace(/\n/g, '<br/>')
}

/**
 * Escape pipe characters for Markdown table cells
 * Pipes (|) are table separators in Markdown and must be escaped
 */
export function escapePipeCharacters(content: string): string {
  if (!content) return ''
  
  // エスケープ済みのパイプ文字は保護し、未エスケープのパイプ文字のみをエスケープ
  return content.replace(/(?<!\\)\|/g, '\\|')
}

/**
 * Unescape pipe characters for display and editing
 * Converts \| back to |
 */
export function unescapePipeCharacters(content: string): string {
  if (!content) return ''
  
  // エスケープされたパイプ文字を元に戻す
  return content.replace(/\\\|/g, '|')
}

/**
 * Escape CSV field with proper quoting
 * Handles commas, newlines, and quotes
 */
export function escapeCSVField(field: string): string {
  if (!field) return ''
  
  const cellStr = String(field)
  
  // カンマ、改行、ダブルクォートが含まれている場合はクォートで囲む
  if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
    return `"${cellStr.replace(/"/g, '""')}"`
  }
  
  return cellStr
}

/**
 * Escape TSV field with proper quoting
 * Handles tabs, newlines, and quotes
 */
export function escapeTSVField(field: string): string {
  if (!field) return ''
  
  const cellStr = String(field)
  
  // タブ、改行、ダブルクォートが含まれている場合はクォートで囲む
  if (cellStr.includes('\t') || cellStr.includes('\n') || cellStr.includes('"')) {
    return `"${cellStr.replace(/"/g, '""')}"`
  }
  
  return cellStr
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