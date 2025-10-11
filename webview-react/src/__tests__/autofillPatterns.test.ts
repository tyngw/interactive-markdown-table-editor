import { detectPattern, generateNextValue } from '../utils/autofillPatterns'

describe('autofillPatterns', () => {
  describe('detectPattern', () => {
    it('数値の連続パターンを検出する', () => {
      const pattern = detectPattern(['1', '2', '3'])
      expect(pattern.type).toBe('series')
      expect(pattern.increment).toBe(1)
    })

    it('小数の連続パターンを検出する', () => {
      const pattern = detectPattern(['1.5', '2.0', '2.5'])
      expect(pattern.type).toBe('series')
      expect(pattern.increment).toBeCloseTo(0.5)
    })

    it('単一セルの場合はコピーパターンを返す', () => {
      const pattern = detectPattern(['テスト'])
      expect(pattern.type).toBe('copy')
    })

    it('曜日パターンを検出する', () => {
      const pattern = detectPattern(['月', '火', '水'])
      expect(pattern.type).toBe('weekday')
    })

    it('月パターンを検出する', () => {
      const pattern = detectPattern(['1月', '2月', '3月'])
      expect(pattern.type).toBe('month')
    })

    it('テキスト内の数値パターンを検出する（末尾）', () => {
      const pattern = detectPattern(['Item 1', 'Item 2', 'Item 3'])
      expect(pattern.type).toBe('text-with-number')
      expect(pattern.increment).toBe(1)
    })

    it('テキスト内の数値パターンを検出する（複数の数値）', () => {
      const pattern = detectPattern(['Test-2-A-5', 'Test-2-A-6', 'Test-2-A-7'])
      expect(pattern.type).toBe('text-with-number')
      expect(pattern.increment).toBe(1)
      expect(pattern.textPattern).toBe('Test-2-A-{number}')
    })

    it('テキスト内の数値パターンを検出する（ゼロパディング）', () => {
      const pattern = detectPattern(['File001', 'File002', 'File003'])
      expect(pattern.type).toBe('text-with-number')
      expect(pattern.increment).toBe(1)
      expect(pattern.zeroPadding).toBe(3)
    })

    it('テキスト内の数値パターンを検出する（複雑なケース）', () => {
      const pattern = detectPattern(['R-B-Web-013-001', 'R-B-Web-013-002', 'R-B-Web-013-003'])
      expect(pattern.type).toBe('text-with-number')
      expect(pattern.increment).toBe(1)
      expect(pattern.textPattern).toBe('R-B-Web-013-{number}')
      expect(pattern.zeroPadding).toBe(3)
    })

    it('日付パターンを検出する（年なし）', () => {
      const pattern = detectPattern(['1/29', '1/30', '1/31'])
      expect(pattern.type).toBe('date')
      expect(pattern.increment).toBe(1)
      expect(pattern.dateFormat).toBe('1/29')
    })

    it('日付パターンを検出する（年あり）', () => {
      const pattern = detectPattern(['2024/01/29', '2024/01/30', '2024/01/31'])
      expect(pattern.type).toBe('date')
      expect(pattern.increment).toBe(1)
      expect(pattern.dateFormat).toBe('2024/01/29')
    })

    it('日付パターンを検出する（日本語形式）', () => {
      const pattern = detectPattern(['2025年1月1日', '2025年1月2日', '2025年1月3日'])
      expect(pattern.type).toBe('date')
      expect(pattern.increment).toBe(1)
      expect(pattern.dateFormat).toBe('2025年1月1日')
    })

    it('日付パターンを検出する（日本語形式、ゼロパディング）', () => {
      const pattern = detectPattern(['2025年01月01日', '2025年01月02日', '2025年01月03日'])
      expect(pattern.type).toBe('date')
      expect(pattern.increment).toBe(1)
      expect(pattern.dateFormat).toBe('2025年01月01日')
    })
  })

  describe('generateNextValue', () => {
    it('数値の連続を生成する', () => {
      const pattern = { type: 'series' as const, increment: 1, startValue: 3 }
      const result = generateNextValue(pattern, '3', 1)
      expect(result).toBe('4')
    })

    it('小数の連続を生成する', () => {
      const pattern = { type: 'series' as const, increment: 0.5, startValue: 2.5 }
      const result = generateNextValue(pattern, '2.5', 1)
      expect(result).toBe('3.0')
    })

    it('コピーパターンで同じ値を返す', () => {
      const pattern = { type: 'copy' as const }
      const result = generateNextValue(pattern, 'テスト', 1)
      expect(result).toBe('テスト')
    })

    it('曜日パターンを生成する', () => {
      // startValue=2は「火」、step=1で次は「水」
      const pattern = { type: 'weekday' as const, increment: 1, startValue: 2 }
      const result = generateNextValue(pattern, '火', 1)
      expect(result).toBe('水')
    })

    it('月パターンを生成する', () => {
      // startValue=2は「3月」（0-indexed）、step=1で次は「4月」
      const pattern = { type: 'month' as const, increment: 1, startValue: 2 }
      const result = generateNextValue(pattern, '3月', 1)
      expect(result).toBe('4月')
    })

    it('テキスト内の数値を生成する', () => {
      const pattern = { 
        type: 'text-with-number' as const, 
        increment: 1, 
        startValue: 3,
        textPattern: 'Item {number}'
      }
      const result = generateNextValue(pattern, 'Item 3', 1)
      expect(result).toBe('Item 4')
    })

    it('テキスト内の数値を生成する（ゼロパディング）', () => {
      const pattern = { 
        type: 'text-with-number' as const, 
        increment: 1, 
        startValue: 3,
        textPattern: 'File{number}',
        zeroPadding: 3
      }
      const result = generateNextValue(pattern, 'File003', 1)
      expect(result).toBe('File004')
    })

    it('テキスト内の数値を生成する（複数の数値）', () => {
      const pattern = { 
        type: 'text-with-number' as const, 
        increment: 1, 
        startValue: 7,
        textPattern: 'Test-2-A-{number}'
      }
      const result = generateNextValue(pattern, 'Test-2-A-7', 1)
      expect(result).toBe('Test-2-A-8')
    })

    it('テキスト内の数値を生成する（デクリメント）', () => {
      const pattern = { 
        type: 'text-with-number' as const, 
        increment: -1, 
        startValue: 5,
        textPattern: 'Item {number}'
      }
      const result = generateNextValue(pattern, 'Item 5', 1)
      expect(result).toBe('Item 4')
    })

    it('テキスト内の数値を生成する（複雑なケース）', () => {
      const pattern = { 
        type: 'text-with-number' as const, 
        increment: 1, 
        startValue: 3,
        textPattern: 'R-B-Web-013-{number}',
        zeroPadding: 3
      }
      const result = generateNextValue(pattern, 'R-B-Web-013-003', 1)
      expect(result).toBe('R-B-Web-013-004')
    })

    it('テキスト内の数値を生成する（ゼロパディング桁上がり）', () => {
      const pattern = { 
        type: 'text-with-number' as const, 
        increment: 1, 
        startValue: 99,
        textPattern: 'File{number}',
        zeroPadding: 2
      }
      const result = generateNextValue(pattern, 'File99', 1)
      expect(result).toBe('File100')
    })

    it('日付を生成する（年なし形式）', () => {
      const currentYear = new Date().getFullYear()
      const startDate = new Date(currentYear, 0, 29) // 1月29日
      const pattern = { 
        type: 'date' as const, 
        increment: 1, 
        startValue: startDate,
        dateFormat: '1/29'
      }
      const result = generateNextValue(pattern, '1/29', 1)
      expect(result).toBe('1/30')
    })

    it('日付を生成する（年なし形式、月をまたぐ）', () => {
      const currentYear = new Date().getFullYear()
      const startDate = new Date(currentYear, 0, 31) // 1月31日
      const pattern = { 
        type: 'date' as const, 
        increment: 1, 
        startValue: startDate,
        dateFormat: '1/31'
      }
      const result = generateNextValue(pattern, '1/31', 1)
      expect(result).toBe('2/1')
    })

    it('日付を生成する（年あり形式）', () => {
      const startDate = new Date(2024, 0, 29) // 2024年1月29日
      const pattern = { 
        type: 'date' as const, 
        increment: 1, 
        startValue: startDate,
        dateFormat: '2024/01/29'
      }
      const result = generateNextValue(pattern, '2024/01/29', 1)
      expect(result).toBe('2024/01/30')
    })

    it('日付を生成する（日本語形式）', () => {
      const startDate = new Date(2025, 0, 1) // 2025年1月1日
      const pattern = { 
        type: 'date' as const, 
        increment: 1, 
        startValue: startDate,
        dateFormat: '2025年1月1日'
      }
      const result = generateNextValue(pattern, '2025年1月1日', 1)
      expect(result).toBe('2025年1月2日')
    })

    it('日付を生成する（日本語形式、月をまたぐ）', () => {
      const startDate = new Date(2025, 0, 31) // 2025年1月31日
      const pattern = { 
        type: 'date' as const, 
        increment: 1, 
        startValue: startDate,
        dateFormat: '2025年1月31日'
      }
      const result = generateNextValue(pattern, '2025年1月31日', 1)
      expect(result).toBe('2025年2月1日')
    })

    it('日付を生成する（日本語形式、ゼロパディング）', () => {
      const startDate = new Date(2025, 0, 1) // 2025年1月1日
      const pattern = { 
        type: 'date' as const, 
        increment: 1, 
        startValue: startDate,
        dateFormat: '2025年01月01日'
      }
      const result = generateNextValue(pattern, '2025年01月01日', 1)
      expect(result).toBe('2025年01月02日')
    })
  })
})
