/**
 * ContentConverter - Markdown装飾変換をテスト
 */
import { convertMarkdownToHtml, escapeHtml, processCellContent } from '../utils/contentConverter'

describe('Markdown decoration conversion', () => {
  describe('convertMarkdownToHtml', () => {
    test('should convert **bold** to <strong> tags', () => {
      const input = escapeHtml('This is **bold** text')
      const result = convertMarkdownToHtml(input)
      expect(result).toContain('<strong>bold</strong>')
    })

    test('should convert *italic* to <em> tags', () => {
      const input = escapeHtml('This is *italic* text')
      const result = convertMarkdownToHtml(input)
      expect(result).toContain('<em>italic</em>')
    })

    test('should convert ~~strikethrough~~ to <del> tags', () => {
      const input = escapeHtml('This is ~~strikethrough~~ text')
      const result = convertMarkdownToHtml(input)
      expect(result).toContain('<del>strikethrough</del>')
    })

    test('should convert __bold__ (double underscore) to <strong> tags', () => {
      const input = escapeHtml('This is __bold__ text')
      const result = convertMarkdownToHtml(input)
      expect(result).toContain('<strong>bold</strong>')
    })

    test('should convert _italic_ (single underscore) to <em> tags', () => {
      const input = escapeHtml('This is _italic_ text')
      const result = convertMarkdownToHtml(input)
      expect(result).toContain('<em>italic</em>')
    })

    test('should preserve <br/> tags', () => {
      // Note: <br/> tags are already in the HTML, so we don't escape them
      // In actual usage, <br/> tags come from markdown storage format
      const input = 'Line 1<br/>Line 2'
      const result = convertMarkdownToHtml(input)
      expect(result).toContain('<br/>')
    })

    test('should handle multiple decorations in one text', () => {
      const input = escapeHtml('**bold** and *italic* and ~~strikethrough~~')
      const result = convertMarkdownToHtml(input)
      expect(result).toContain('<strong>bold</strong>')
      expect(result).toContain('<em>italic</em>')
      expect(result).toContain('<del>strikethrough</del>')
    })

    test('should escape HTML special characters', () => {
      const input = '<script>alert("xss")</script>'
      const escaped = escapeHtml(input)
      const result = convertMarkdownToHtml(escaped)
      expect(result).not.toContain('<script>')
      expect(result).toContain('&lt;script&gt;')
    })

    test('should return empty string for empty input', () => {
      expect(convertMarkdownToHtml('')).toBe('')
    })
  })

  describe('processCellContent', () => {
    test('should process cell content with markdown decoration', () => {
      // processCellContent は既にHTMLエスケープとMarkdown変換を行う
      const result = processCellContent('This is **bold** text')
      expect(result).toContain('<strong>bold</strong>')
    })

    test('should preserve <br> tags in cell content', () => {
      // processCellContent normalizes <br/> to <br>
      const result = processCellContent('Line 1<br/>Line 2')
      expect(result).toContain('<br>')
    })

    test('should handle empty content', () => {
      const result = processCellContent('')
      expect(result).toBe('')
    })

    test('should convert escape pipe characters', () => {
      const result = processCellContent('test \\| pipe')
      expect(result).toContain('test | pipe')
    })
  })

  describe('escapeHtml', () => {
    test('should escape HTML tags', () => {
      const result = escapeHtml('<div>test</div>')
      expect(result).not.toContain('<div>')
      expect(result).toContain('&lt;div&gt;')
    })

    test('should escape ampersand', () => {
      const result = escapeHtml('A & B')
      expect(result).toContain('&amp;')
    })

    test('should preserve plain text', () => {
      const result = escapeHtml('plain text')
      expect(result).toBe('plain text')
    })
  })
})
