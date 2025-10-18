import {
  convertBrTagsToNewlines,
  convertNewlinesToBrTags,
  escapeCSVField,
  escapeTSVField,
  processCellContentForEditing,
  processCellContentForStorage
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
  })

  describe('processCellContentForStorage', () => {
    it('should convert newlines to br tags for storage', () => {
      expect(processCellContentForStorage('Line 1\nLine 2')).toBe('Line 1<br/>Line 2')
    })

    it('should handle multiple newlines', () => {
      expect(processCellContentForStorage('A\nB\nC')).toBe('A<br/>B<br/>C')
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
  })
})
