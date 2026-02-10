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

    it('空配列の場合はコピーパターンを返す', () => {
      const pattern = detectPattern([])
      expect(pattern.type).toBe('copy')
    })

    it('全パターン不一致の場合はデフォルトのコピーパターンを返す', () => {
      const pattern = detectPattern(['abc', 'xyz'])
      expect(pattern.type).toBe('copy')
      expect(pattern.startValue).toBe('xyz')
    })

    it('差分が一定でない数値列はnullを返す', () => {
      // 1, 3, 10 → 差分が2, 7で一定でない → 数値パターン不成立 → コピーにフォールバック
      const pattern = detectPattern(['1', '3', '10'])
      expect(pattern.type).toBe('copy')
    })

    it('日本語日付の形式が不正な場合はnullを返す', () => {
      // 最初の値は日本語形式だが、2番目の値がフォーマット不一致
      const pattern = detectPattern(['2025年1月1日', '2025-01-02', '2025年1月3日'])
      expect(pattern.type).not.toBe('date')
    })

    it('日付の差分が一定でない場合はnullを返す', () => {
      const pattern = detectPattern(['2024/01/01', '2024/01/03', '2024/01/10'])
      expect(pattern.type).not.toBe('date')
    })

    it('曜日パターンの差分が一定でない場合はnullを返す', () => {
      // 月→水→土: 差分が2, 3で一定でない
      const pattern = detectPattern(['月', '水', '土'])
      expect(pattern.type).not.toBe('weekday')
    })

    it('同じ曜日が繰り返される場合（差分0）はnullを返す', () => {
      const pattern = detectPattern(['月', '月', '月'])
      expect(pattern.type).not.toBe('weekday')
    })

    it('月パターンの差分が一定でない場合はnullを返す', () => {
      const pattern = detectPattern(['1月', '3月', '8月'])
      expect(pattern.type).not.toBe('month')
    })

    it('同じ月が繰り返される場合（差分0）はnullを返す', () => {
      const pattern = detectPattern(['1月', '1月', '1月'])
      expect(pattern.type).not.toBe('month')
    })

    it('テキスト内の数値のprefix/suffixが一致しない場合はコピーを返す', () => {
      const pattern = detectPattern(['Item 1', 'Thing 2', 'Item 3'])
      expect(pattern.type).toBe('copy')
    })

    it('テキストに数値が含まれない場合はコピーを返す', () => {
      const pattern = detectPattern(['abc', 'def', 'ghi'])
      expect(pattern.type).toBe('copy')
    })

    it('テキスト内の数値の差分が一定でない場合はコピーを返す', () => {
      const pattern = detectPattern(['Item 1', 'Item 3', 'Item 10'])
      expect(pattern.type).toBe('copy')
    })

    it('テキスト内の小数パターンを検出する', () => {
      const pattern = detectPattern(['v1.0', 'v1.5', 'v2.0'])
      expect(pattern.type).toBe('text-with-number')
      expect(pattern.increment).toBeCloseTo(0.5)
      expect(pattern.isDecimal).toBe(true)
      expect(pattern.decimalPlaces).toBe(1)
    })

    it('英語の短縮曜日パターンを検出する', () => {
      const pattern = detectPattern(['Mon', 'Tue', 'Wed'])
      expect(pattern.type).toBe('weekday')
      expect(pattern.increment).toBe(1)
    })

    it('英語のフル曜日パターンを検出する', () => {
      const pattern = detectPattern(['Monday', 'Tuesday', 'Wednesday'])
      expect(pattern.type).toBe('weekday')
      expect(pattern.increment).toBe(1)
    })

    it('英語の短縮月パターンを検出する', () => {
      const pattern = detectPattern(['Jan', 'Feb', 'Mar'])
      expect(pattern.type).toBe('month')
      expect(pattern.increment).toBe(1)
    })

    it('英語のフル月パターンを検出する', () => {
      const pattern = detectPattern(['January', 'February', 'March'])
      expect(pattern.type).toBe('month')
      expect(pattern.increment).toBe(1)
    })

    it('ハイフン区切りの日付パターンを検出する', () => {
      const pattern = detectPattern(['2024-01-01', '2024-01-02', '2024-01-03'])
      expect(pattern.type).toBe('date')
      expect(pattern.increment).toBe(1)
    })

    it('年あり形式で無効な日付の場合は日付パターンとして検出しない', () => {
      const pattern = detectPattern(['2024/99/99', '2024/99/98', '2024/99/97'])
      expect(pattern.type).not.toBe('date')
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

    it('seriesでincrement/startValueがundefinedの場合はcurrentValueを返す', () => {
      const pattern = { type: 'series' as const }
      const result = generateNextValue(pattern, '5', 1)
      expect(result).toBe('5')
    })

    it('dateでincrement/startValueがundefinedの場合はcurrentValueを返す', () => {
      const pattern = { type: 'date' as const }
      const result = generateNextValue(pattern, '2024/01/01', 1)
      expect(result).toBe('2024/01/01')
    })

    it('weekdayでincrement/startValueがundefinedの場合はcurrentValueを返す', () => {
      const pattern = { type: 'weekday' as const }
      const result = generateNextValue(pattern, '月', 1)
      expect(result).toBe('月')
    })

    it('monthでincrement/startValueがundefinedの場合はcurrentValueを返す', () => {
      const pattern = { type: 'month' as const }
      const result = generateNextValue(pattern, '1月', 1)
      expect(result).toBe('1月')
    })

    it('text-with-numberでincrement/startValue/textPatternがundefinedの場合はcurrentValueを返す', () => {
      const pattern = { type: 'text-with-number' as const }
      const result = generateNextValue(pattern, 'Item 1', 1)
      expect(result).toBe('Item 1')
    })

    it('テキスト内の小数を生成する', () => {
      const pattern = { 
        type: 'text-with-number' as const, 
        increment: 0.5, 
        startValue: 2.0,
        textPattern: 'v{number}',
        isDecimal: true,
        decimalPlaces: 1
      }
      const result = generateNextValue(pattern, 'v2.0', 1)
      expect(result).toBe('v2.5')
    })

    it('日付を生成する（ハイフン区切り）', () => {
      const startDate = new Date(2024, 0, 1) // 2024年1月1日
      const pattern = { 
        type: 'date' as const, 
        increment: 1, 
        startValue: startDate,
        dateFormat: '2024-01-01'
      }
      const result = generateNextValue(pattern, '2024-01-01', 1)
      expect(result).toBe('2024-01-02')
    })

    it('日付を生成する（dateFormatなし）', () => {
      const startDate = new Date(2024, 0, 1) // 2024年1月1日
      const pattern = { 
        type: 'date' as const, 
        increment: 1, 
        startValue: startDate
      }
      const result = generateNextValue(pattern, '2024/01/01', 1)
      expect(result).toBe('2024/01/02')
    })
  })
})
