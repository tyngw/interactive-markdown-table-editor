// オートフィルのパターン認識と値生成のユーティリティ

export type FillPattern = 'copy' | 'series' | 'date' | 'weekday' | 'month' | 'text-with-number'

export interface PatternInfo {
  type: FillPattern
  increment?: number
  startValue?: any
  textPattern?: string // テキスト内の数値パターン用
  numberPosition?: { start: number; end: number } // 数値の位置
  zeroPadding?: number // ゼロパディングの桁数
  isDecimal?: boolean // 小数点があるか
  decimalPlaces?: number // 小数点以下の桁数
  dateFormat?: string // 元の日付形式
}

/**
 * 選択範囲からパターンを検出
 */
export function detectPattern(values: string[]): PatternInfo {
  if (values.length === 0) {
    return { type: 'copy' }
  }

  // 単一セルの場合はコピー
  if (values.length === 1) {
    return { type: 'copy', startValue: values[0] }
  }

  // 日付パターンを検出（最優先：数値パターンより前に判定）
  const datePattern = detectDatePattern(values)
  if (datePattern) {
    return datePattern
  }

  // 曜日パターンを検出（数値より優先）
  const weekdayPattern = detectWeekdayPattern(values)
  if (weekdayPattern) {
    return weekdayPattern
  }

  // 月パターンを検出（数値より優先）
  const monthPattern = detectMonthPattern(values)
  if (monthPattern) {
    return monthPattern
  }

  // 数値の連続パターンを検出
  const numericPattern = detectNumericSeries(values)
  if (numericPattern) {
    return numericPattern
  }

  // テキスト内の数値パターンを検出
  const textWithNumberPattern = detectTextWithNumber(values)
  if (textWithNumberPattern) {
    return textWithNumberPattern
  }

  // デフォルトはコピー
  return { type: 'copy', startValue: values[values.length - 1] }
}

/**
 * 数値の連続パターンを検出
 */
function detectNumericSeries(values: string[]): PatternInfo | null {
  const numbers = values.map(v => {
    const num = parseFloat(v.trim())
    return isNaN(num) ? null : num
  })

  // すべて数値でない場合は null
  if (numbers.some(n => n === null)) {
    return null
  }

  // 差分を計算
  const diffs = []
  for (let i = 1; i < numbers.length; i++) {
    diffs.push(numbers[i]! - numbers[i - 1]!)
  }

  // 差分が一定かチェック（小数点誤差を考慮）
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const isConstant = diffs.every(d => Math.abs(d - avgDiff) < 0.0001)

  if (isConstant) {
    return {
      type: 'series',
      increment: avgDiff,
      startValue: numbers[numbers.length - 1]
    }
  }

  return null
}

/**
 * 日付パターンを検出（YYYY/MM/DD, YYYY-MM-DD, M/D, YYYY年M月D日 など）
 */
function detectDatePattern(values: string[]): PatternInfo | null {
  // 元の形式を判定
  const firstValue = values[0].trim()
  
  // 日本語形式: YYYY年M月D日 または YYYY年MM月DD日
  const japaneseFormat = /^(\d{4})年(\d{1,2})月(\d{1,2})日$/.test(firstValue)
  
  // 年あり形式: YYYY/MM/DD または YYYY-MM-DD
  const hasYear = /^\d{4}[/-]/.test(firstValue)
  
  const dates = values.map(v => {
    const trimmed = v.trim()
    let d: Date
    
    if (japaneseFormat) {
      // 日本語形式: YYYY年M月D日
      const match = trimmed.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/)
      if (match) {
        const year = parseInt(match[1], 10)
        const month = parseInt(match[2], 10)
        const day = parseInt(match[3], 10)
        d = new Date(year, month - 1, day)
      } else {
        return null
      }
    } else if (hasYear) {
      // 年あり形式: YYYY/MM/DD または YYYY-MM-DD
      d = new Date(trimmed)
    } else {
      // 年なし形式: M/D または MM/DD
      // 現在の年を使用
      const currentYear = new Date().getFullYear()
      const parts = trimmed.split(/[/-]/)
      if (parts.length === 2) {
        const month = parseInt(parts[0], 10)
        const day = parseInt(parts[1], 10)
        d = new Date(currentYear, month - 1, day)
      } else {
        return null
      }
    }
    
    return isNaN(d.getTime()) ? null : d
  })

  if (dates.some(d => d === null)) {
    return null
  }

  // 日数の差分を計算
  const diffs = []
  for (let i = 1; i < dates.length; i++) {
    const diff = (dates[i]!.getTime() - dates[i - 1]!.getTime()) / (1000 * 60 * 60 * 24)
    diffs.push(Math.round(diff))
  }

  // 差分が一定かチェック
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const isConstant = diffs.every(d => d === avgDiff)

  if (isConstant) {
    return {
      type: 'date',
      increment: avgDiff,
      startValue: dates[dates.length - 1],
      dateFormat: firstValue // 元の形式を保存
    }
  }

  return null
}

/**
 * 曜日パターンを検出
 */
function detectWeekdayPattern(values: string[]): PatternInfo | null {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const weekdaysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const weekdaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const indices = values.map(v => {
    const trimmed = v.trim()
    let idx = weekdays.indexOf(trimmed)
    if (idx === -1) idx = weekdaysEn.findIndex(w => w.toLowerCase() === trimmed.toLowerCase())
    if (idx === -1) idx = weekdaysShort.findIndex(w => w.toLowerCase() === trimmed.toLowerCase())
    return idx
  })

  if (indices.some(i => i === -1)) {
    return null
  }

  // 連続しているかチェック
  const diffs = []
  for (let i = 1; i < indices.length; i++) {
    diffs.push((indices[i] - indices[i - 1] + 7) % 7)
  }

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const isConstant = diffs.every(d => d === avgDiff)

  if (isConstant && avgDiff > 0) {
    return {
      type: 'weekday',
      increment: avgDiff,
      startValue: indices[indices.length - 1]
    }
  }

  return null
}

/**
 * 月パターンを検出
 */
function detectMonthPattern(values: string[]): PatternInfo | null {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  const indices = values.map(v => {
    const trimmed = v.trim()
    let idx = months.indexOf(trimmed)
    if (idx === -1) idx = monthsEn.findIndex(m => m.toLowerCase() === trimmed.toLowerCase())
    if (idx === -1) idx = monthsShort.findIndex(m => m.toLowerCase() === trimmed.toLowerCase())
    return idx
  })

  if (indices.some(i => i === -1)) {
    return null
  }

  // 連続しているかチェック
  const diffs = []
  for (let i = 1; i < indices.length; i++) {
    diffs.push((indices[i] - indices[i - 1] + 12) % 12)
  }

  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const isConstant = diffs.every(d => d === avgDiff)

  if (isConstant && avgDiff > 0) {
    return {
      type: 'month',
      increment: avgDiff,
      startValue: indices[indices.length - 1]
    }
  }

  return null
}

/**
 * パターンに基づいて次の値を生成
 */
export function generateNextValue(pattern: PatternInfo, currentValue: string, step: number): string {
  switch (pattern.type) {
    case 'copy':
      return currentValue

    case 'series':
      if (pattern.increment !== undefined && pattern.startValue !== undefined) {
        const nextNum = pattern.startValue + (pattern.increment * step)
        // 小数点の桁数を元の値に合わせる
        /* istanbul ignore next -- includes('.')が真の時split('.')[1]は必ず存在するため || 0 は到達不能 */
        const decimalPlaces = currentValue.includes('.') ? currentValue.split('.')[1]?.length || 0 : 0
        return nextNum.toFixed(decimalPlaces)
      }
      return currentValue

    case 'date':
      if (pattern.increment !== undefined && pattern.startValue !== undefined) {
        const nextDate = new Date(pattern.startValue)
        nextDate.setDate(nextDate.getDate() + (pattern.increment * step))
        // 元の形式を使用（dateFormatが保存されている場合）
        const formatToUse = pattern.dateFormat || currentValue
        return formatDate(nextDate, formatToUse)
      }
      return currentValue

    case 'weekday':
      if (pattern.increment !== undefined && pattern.startValue !== undefined) {
        const weekdays = ['日', '月', '火', '水', '木', '金', '土']
        const nextIndex = ((pattern.startValue + (pattern.increment * step)) % 7 + 7) % 7
        return weekdays[nextIndex]
      }
      return currentValue

    case 'month':
      if (pattern.increment !== undefined && pattern.startValue !== undefined) {
        const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
        const nextIndex = ((pattern.startValue + (pattern.increment * step)) % 12 + 12) % 12
        return months[nextIndex]
      }
      return currentValue

    case 'text-with-number':
      if (pattern.increment !== undefined && pattern.startValue !== undefined && pattern.textPattern) {
        const nextNum = pattern.startValue + (pattern.increment * step)
        let formattedNum: string
        
        // 小数点がある場合
        if (pattern.isDecimal && pattern.decimalPlaces !== undefined) {
          formattedNum = nextNum.toFixed(pattern.decimalPlaces)
        }
        // 整数でゼロパディングされている場合（例: 001, 002）
        else if (pattern.zeroPadding && pattern.zeroPadding > 0) {
          formattedNum = Math.floor(nextNum).toString().padStart(pattern.zeroPadding, '0')
        }
        // 通常の整数
        else {
          formattedNum = Math.floor(nextNum).toString()
        }
        
        return pattern.textPattern.replace('{number}', formattedNum)
      }
      return currentValue

    /* istanbul ignore next -- 全FillPatternをcaseでカバー済みのため到達不能 */
    default:
      return currentValue
  }
}

/**
 * テキスト内の数値パターンを検出
 */
function detectTextWithNumber(values: string[]): PatternInfo | null {
  /* istanbul ignore if -- detectPattern経由ではlength<2は先に処理されるため到達不能 */
  if (values.length < 2) {
    return null
  }

  // 各値から最後に出現する数値を抽出
  const patterns: Array<{ 
    prefix: string
    number: number
    numberStr: string
    suffix: string
    position: { start: number; end: number }
  }> = []
  
  for (const value of values) {
    // 最後に出現する数値を検索（整数または小数）
    const matches = Array.from(value.matchAll(/\d+\.?\d*/g))
    if (matches.length === 0) {
      return null // 数値が含まれていない
    }

    const lastMatch = matches[matches.length - 1]
    const numberStr = lastMatch[0]
    const numberValue = parseFloat(numberStr)
    const position = {
      start: lastMatch.index!,
      end: lastMatch.index! + numberStr.length
    }

    patterns.push({
      prefix: value.substring(0, position.start),
      number: numberValue,
      numberStr: numberStr,
      suffix: value.substring(position.end),
      position
    })
  }

  // すべての値で prefix と suffix が同じかチェック
  const firstPrefix = patterns[0].prefix
  const firstSuffix = patterns[0].suffix
  
  if (!patterns.every(p => p.prefix === firstPrefix && p.suffix === firstSuffix)) {
    return null // パターンが一致しない
  }

  // 数値の差分を計算
  const diffs = []
  for (let i = 1; i < patterns.length; i++) {
    diffs.push(patterns[i].number - patterns[i - 1].number)
  }

  // 差分が一定かチェック
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length
  const isConstant = diffs.every(d => Math.abs(d - avgDiff) < 0.0001)

  if (isConstant) {
    // 最後のパターンから数値の形式を判定
    const lastNumberStr = patterns[patterns.length - 1].numberStr
    const isDecimal = lastNumberStr.includes('.')
    /* istanbul ignore next -- includes('.')が真の時split('.')[1]は必ず存在するため || 0 は到達不能 */
    const decimalPlaces = isDecimal ? lastNumberStr.split('.')[1]?.length || 0 : 0
    
    // ゼロパディングの判定（整数で先頭が0の場合）
    let zeroPadding = 0
    if (!isDecimal && lastNumberStr.length > 1 && lastNumberStr[0] === '0') {
      zeroPadding = lastNumberStr.length
    }

    return {
      type: 'text-with-number',
      increment: avgDiff,
      startValue: patterns[patterns.length - 1].number,
      textPattern: firstPrefix + '{number}' + firstSuffix,
      numberPosition: patterns[patterns.length - 1].position,
      zeroPadding: zeroPadding,
      isDecimal: isDecimal,
      decimalPlaces: decimalPlaces
    }
  }

  return null
}

/**
 * 日付を元の形式に合わせてフォーマット
 */
function formatDate(date: Date, originalFormat: string): string {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  
  // 日本語形式かチェック
  const isJapanese = /年.*月.*日/.test(originalFormat)
  
  if (isJapanese) {
    // 日本語形式: YYYY年M月D日 または YYYY年MM月DD日
    const hasMonthPadding = /年0\d月/.test(originalFormat)
    const hasDayPadding = /月0\d日/.test(originalFormat)
    
    const monthStr = hasMonthPadding ? String(month).padStart(2, '0') : String(month)
    const dayStr = hasDayPadding ? String(day).padStart(2, '0') : String(day)
    
    return `${year}年${monthStr}月${dayStr}日`
  }
  
  // 年が含まれているかチェック
  const hasYear = /^\d{4}[/-]/.test(originalFormat)
  
  // 月日のゼロパディングを判定
  const hasMonthPadding = /[/-]0\d/.test(originalFormat)
  const hasDayPadding = /[/-]\d{1,2}[/-]0\d/.test(originalFormat) || (originalFormat.split(/[/-]/).length === 2 && /0\d$/.test(originalFormat))
  
  const monthStr = hasMonthPadding ? String(month).padStart(2, '0') : String(month)
  const dayStr = hasDayPadding ? String(day).padStart(2, '0') : String(day)
  
  // 区切り文字を判定
  const separator = originalFormat.includes('/') ? '/' : '-'
  
  if (hasYear) {
    return `${year}${separator}${monthStr}${separator}${dayStr}`
  } else {
    // 年なし形式
    return `${monthStr}${separator}${dayStr}`
  }
}
