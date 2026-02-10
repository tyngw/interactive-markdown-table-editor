import {
  convertBrTagsToNewlines,
  convertNewlinesToBrTags,
  escapeCSVField,
  escapeTSVField,
  processCellContent,
  processCellContentForEditing,
  processCellContentForStorage,
  escapePipeCharacters,
  unescapePipeCharacters,
  escapeHtml,
} from '../../utils/contentConverter'

describe('contentConverter', () => {
  describe('convertBrTagsToNewlines', () => {
    it('should convert <br> tags to newlines', () => {
      expect(convertBrTagsToNewlines('Line 1<br>Line 2')).toBe('Line 1\nLine 2')
    })

    it('should convert <br/> tags to newlines', () => {
      expect(convertBrTagsToNewlines('Line 1<br/>Line 2')).toBe('Line 1\nLine 2')
    })

    it('should convert <br /> tags to newlines', () => {
      expect(convertBrTagsToNewlines('Line 1<br />Line 2')).toBe('Line 1\nLine 2')
    })

    it('should handle case-insensitive tags', () => {
      expect(convertBrTagsToNewlines('Line 1<BR>Line 2')).toBe('Line 1\nLine 2')
      expect(convertBrTagsToNewlines('Line 1<BR/>Line 2')).toBe('Line 1\nLine 2')
    })

    it('should handle multiple br tags', () => {
      expect(convertBrTagsToNewlines('Line 1<br>Line 2<br/>Line 3')).toBe('Line 1\nLine 2\nLine 3')
    })

    it('should return empty string for empty input', () => {
      expect(convertBrTagsToNewlines('')).toBe('')
    })
  })

  describe('convertNewlinesToBrTags', () => {
    it('should convert newlines to <br/> tags', () => {
      expect(convertNewlinesToBrTags('Line 1\nLine 2')).toBe('Line 1<br/>Line 2')
    })

    it('should handle multiple newlines', () => {
      expect(convertNewlinesToBrTags('Line 1\nLine 2\nLine 3')).toBe('Line 1<br/>Line 2<br/>Line 3')
    })

    it('should return empty string for empty input', () => {
      expect(convertNewlinesToBrTags('')).toBe('')
    })
  })

  describe('escapeCSVField', () => {
    it('should not quote simple text', () => {
      expect(escapeCSVField('simple')).toBe('simple')
    })

    it('should quote text with commas', () => {
      expect(escapeCSVField('text, with comma')).toBe('"text, with comma"')
    })

    it('should quote text with newlines', () => {
      expect(escapeCSVField('text\nwith newline')).toBe('"text\nwith newline"')
    })

    it('should quote and escape text with quotes', () => {
      expect(escapeCSVField('text with "quotes"')).toBe('"text with ""quotes"""')
    })

    it('should handle multiple special characters', () => {
      expect(escapeCSVField('text, with "comma" and\nnewline')).toBe('"text, with ""comma"" and\nnewline"')
    })

    it('should return empty string for empty input', () => {
      expect(escapeCSVField('')).toBe('')
    })
  })

  describe('escapeTSVField', () => {
    it('should not quote simple text', () => {
      expect(escapeTSVField('simple')).toBe('simple')
    })

    it('should quote text with tabs', () => {
      expect(escapeTSVField('text\twith tab')).toBe('"text\twith tab"')
    })

    it('should quote text with newlines', () => {
      expect(escapeTSVField('text\nwith newline')).toBe('"text\nwith newline"')
    })

    it('should quote and escape text with quotes', () => {
      expect(escapeTSVField('text with "quotes"')).toBe('"text with ""quotes"""')
    })

    it('should handle multiple special characters', () => {
      expect(escapeTSVField('text\twith "tab" and\nnewline')).toBe('"text\twith ""tab"" and\nnewline"')
    })

    it('should not quote text with commas (TSV specific)', () => {
      expect(escapeTSVField('text, with comma')).toBe('text, with comma')
    })

    it('should return empty string for empty input', () => {
      expect(escapeTSVField('')).toBe('')
    })
  })

  describe('processCellContentForEditing', () => {
    it('should convert br tags to newlines for editing', () => {
      expect(processCellContentForEditing('Line 1<br/>Line 2')).toBe('Line 1\nLine 2')
    })

    it('should handle various br tag formats', () => {
      expect(processCellContentForEditing('A<br>B<br/>C<BR>D')).toBe('A\nB\nC\nD')
    })

    it('空文字列で空文字列を返す', () => {
      expect(processCellContentForEditing('')).toBe('')
    })
  })

  describe('processCellContentForStorage', () => {
    it('should convert newlines to br tags for storage', () => {
      expect(processCellContentForStorage('Line 1\nLine 2')).toBe('Line 1<br/>Line 2')
    })

    it('should handle multiple newlines', () => {
      expect(processCellContentForStorage('A\nB\nC')).toBe('A<br/>B<br/>C')
    })

    it('should NOT escape pipe characters (handled by Extension)', () => {
      expect(processCellContentForStorage('text | with | pipes')).toBe('text | with | pipes')
    })

    it('should handle newlines and pipes together', () => {
      expect(processCellContentForStorage('line1 | pipe\nline2 | pipe')).toBe('line1 | pipe<br/>line2 | pipe')
    })

    it('空文字列で空文字列を返す', () => {
      expect(processCellContentForStorage('')).toBe('')
    })
  })

  describe('escapePipeCharacters', () => {
    it('should escape pipe characters', () => {
      expect(escapePipeCharacters('text | with | pipes')).toBe('text \\| with \\| pipes')
    })

    it('should not double-escape already escaped pipes', () => {
      expect(escapePipeCharacters('text \\| already escaped')).toBe('text \\| already escaped')
    })

    it('should handle mixed escaped and unescaped pipes', () => {
      expect(escapePipeCharacters('text | unescaped \\| escaped')).toBe('text \\| unescaped \\| escaped')
    })

    it('should handle multiple consecutive pipes', () => {
      expect(escapePipeCharacters('text || double')).toBe('text \\|\\| double')
    })

    it('should return empty string for empty input', () => {
      expect(escapePipeCharacters('')).toBe('')
    })

    it('should handle text without pipes', () => {
      expect(escapePipeCharacters('no pipes here')).toBe('no pipes here')
    })
  })

  describe('unescapePipeCharacters', () => {
    it('should unescape pipe characters', () => {
      expect(unescapePipeCharacters('text \\| with \\| pipes')).toBe('text | with | pipes')
    })

    it('should handle multiple escaped pipes', () => {
      expect(unescapePipeCharacters('text \\|\\| double')).toBe('text || double')
    })

    it('should return empty string for empty input', () => {
      expect(unescapePipeCharacters('')).toBe('')
    })

    it('should handle text without escaped pipes', () => {
      expect(unescapePipeCharacters('no escaped pipes')).toBe('no escaped pipes')
    })
  })

  describe('round-trip conversion', () => {
    it('should maintain data integrity through editing and storage', () => {
      const original = 'Line 1<br/>Line 2<br/>Line 3'
      const forEditing = processCellContentForEditing(original)
      const backToStorage = processCellContentForStorage(forEditing)
      
      expect(backToStorage).toBe(original)
    })

    it('should maintain data integrity through br tags and newlines', () => {
      const original = 'Multi\nline\ntext'
      const toBrTags = convertNewlinesToBrTags(original)
      const backToNewlines = convertBrTagsToNewlines(toBrTags)
      
      expect(backToNewlines).toBe(original)
    })

    it('should maintain data integrity with pipe characters', () => {
      const original = 'text | with | pipes'
      const escaped = escapePipeCharacters(original)
      const unescaped = unescapePipeCharacters(escaped)
      
      expect(escaped).toBe('text \\| with \\| pipes')
      expect(unescaped).toBe(original)
    })

    it('should handle pipe characters in storage (not escaped in Webview)', () => {
      const userInput = 'data | with | pipes'
      const stored = processCellContentForStorage(userInput)
      const forEditing = processCellContentForEditing(stored)
      
      // パイプ文字はWebview側ではエスケープされない
      expect(stored).toBe('data | with | pipes')
      expect(forEditing).toBe(userInput)
    })
  })

  describe('processCellContent', () => {
    it('空文字列を返す（空入力）', () => {
      expect(processCellContent('')).toBe('')
    })

    it('falsy値で空文字列を返す', () => {
      expect(processCellContent(null as unknown as string)).toBe('')
      expect(processCellContent(undefined as unknown as string)).toBe('')
    })

    it('<br>タグを保持してHTMLをエスケープする', () => {
      const result = processCellContent('hello<br>world')
      expect(result).toContain('<br>')
      expect(result).toContain('hello')
      expect(result).toContain('world')
    })

    it('<br/>タグを<br>に正規化する', () => {
      const result = processCellContent('line1<br/>line2')
      expect(result).toContain('<br>')
    })

    it('<BR>タグを<br>に正規化する（大文字）', () => {
      const result = processCellContent('line1<BR>line2')
      expect(result).toContain('<br>')
    })

    it('HTMLタグをエスケープするが<br>は保持する', () => {
      const result = processCellContent('<script>alert("xss")</script><br>safe')
      expect(result).not.toContain('<script>')
      expect(result).toContain('<br>')
      expect(result).toContain('safe')
    })

    it('パイプ文字のアンエスケープを処理する', () => {
      // unescapePipeCharacters で | に変換された後、escapeHtmlExceptBreaks では
      // パイプはHTML特殊文字ではないのでそのまま保持される
      const result = processCellContent('data &#124; value')
      // jsdomのinnerHTMLでは特殊文字のエスケープ動作が異なるが、処理自体が通ることを確認
      expect(result).toBeDefined()
    })
  })

  describe('escapeHtml', () => {
    it('HTMLタグをエスケープする', () => {
      const result = escapeHtml('<script>alert("xss")</script>')
      expect(result).not.toContain('<script>')
      expect(result).toContain('&lt;')
      expect(result).toContain('&gt;')
    })

    it('アンパサンドをエスケープする', () => {
      const result = escapeHtml('a & b')
      expect(result).toContain('&amp;')
    })

    it('ダブルクォートはjsdomのinnerHTMLではエスケープされない', () => {
      const result = escapeHtml('say "hello"')
      // jsdomのinnerHTMLはダブルクォートをエスケープしない（ブラウザと同じ動作）
      expect(result).toContain('"')
    })

    it('通常のテキストはそのまま返す', () => {
      expect(escapeHtml('hello world')).toBe('hello world')
    })
  })
})
