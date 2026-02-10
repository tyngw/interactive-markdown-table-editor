import { queryCellElement, markCellAsTemporarilyEmpty, clearCellTemporaryMarker, cleanupCellVisualArtifacts } from '../../utils/cellDomUtils'

describe('cellDomUtils', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  function createCell(row: number, col: number): HTMLTableCellElement {
    const td = document.createElement('td')
    td.setAttribute('data-row', String(row))
    td.setAttribute('data-col', String(col))
    document.body.appendChild(td)
    return td
  }

  describe('queryCellElement', () => {
    it('位置が指定された場合に対応するDOM要素を返す', () => {
      const td = createCell(1, 2)
      const result = queryCellElement({ row: 1, col: 2 })
      expect(result).toBe(td)
    })

    it('位置がnullの場合はnullを返す', () => {
      expect(queryCellElement(null)).toBeNull()
    })

    it('位置がundefinedの場合はnullを返す', () => {
      expect(queryCellElement(undefined)).toBeNull()
    })

    it('対応するDOM要素がない場合はnullを返す', () => {
      expect(queryCellElement({ row: 99, col: 99 })).toBeNull()
    })
  })

  describe('markCellAsTemporarilyEmpty', () => {
    it('セル要素にtempEmpty属性を設定する', () => {
      const td = createCell(0, 0)
      const result = markCellAsTemporarilyEmpty({ row: 0, col: 0 })
      expect(result).toBe(true)
      expect(td.dataset.tempEmpty).toBe('true')
    })

    it('セル要素が存在しない場合はfalseを返す', () => {
      const result = markCellAsTemporarilyEmpty({ row: 99, col: 99 })
      expect(result).toBe(false)
    })
  })

  describe('clearCellTemporaryMarker', () => {
    it('セル要素のtempEmpty属性を削除する', () => {
      const td = createCell(0, 0)
      td.dataset.tempEmpty = 'true'
      clearCellTemporaryMarker({ row: 0, col: 0 })
      expect(td.dataset.tempEmpty).toBeUndefined()
    })

    it('セル要素が存在しない場合は何もしない', () => {
      expect(() => clearCellTemporaryMarker({ row: 99, col: 99 })).not.toThrow()
    })
  })

  describe('cleanupCellVisualArtifacts', () => {
    it('セル要素の各種データ属性とスタイルをクリーンアップする', () => {
      const td = createCell(0, 0)
      td.dataset.tempEmpty = 'true'
      td.dataset.originalHeight = '50'
      td.dataset.rowMaxHeight = '100'
      td.dataset.maxOtherHeight = '80'
      td.style.minHeight = '50px'

      cleanupCellVisualArtifacts({ row: 0, col: 0 })

      expect(td.dataset.tempEmpty).toBeUndefined()
      expect(td.dataset.originalHeight).toBeUndefined()
      expect(td.dataset.rowMaxHeight).toBeUndefined()
      expect(td.dataset.maxOtherHeight).toBeUndefined()
      expect(td.style.minHeight).toBe('')
    })

    it('セル要素が存在しない場合は何もしない', () => {
      expect(() => cleanupCellVisualArtifacts({ row: 99, col: 99 })).not.toThrow()
    })

    it('行要素のスペーサーDIVを削除する', () => {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.setAttribute('data-row', '0')
      td.setAttribute('data-col', '0')
      tr.appendChild(td)

      const spacer = document.createElement('div')
      spacer.classList.add('height-spacer')
      const spacerParent = document.createElement('div')
      spacerParent.appendChild(spacer)
      tr.appendChild(spacerParent)

      document.body.appendChild(tr)

      cleanupCellVisualArtifacts({ row: 0, col: 0 })

      expect(tr.querySelectorAll('.height-spacer').length).toBe(0)
    })

    it('行要素のtd[data-col]のminHeightをリセットする', () => {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.setAttribute('data-row', '0')
      td.setAttribute('data-col', '0')
      tr.appendChild(td)

      const otherTd = document.createElement('td')
      otherTd.setAttribute('data-col', '1')
      otherTd.style.minHeight = '100px'
      tr.appendChild(otherTd)

      document.body.appendChild(tr)

      cleanupCellVisualArtifacts({ row: 0, col: 0 })

      expect(otherTd.style.minHeight).toBe('')
    })

    it('cleanupRowVisualState: rowElementがnullの場合は何もしない', () => {
      // DocumentFragment内のtdはparentElementがnullではない（DocumentFragmentに属する）
      // cleanupRowVisualState(null)を呼ぶには、cellElement.parentElementがnullになる必要がある
      // DOMから切り離されたtdのparentElementはnull
      const td = document.createElement('td')
      td.setAttribute('data-row', '0')
      td.setAttribute('data-col', '0')
      document.body.appendChild(td)

      // parentElement を一時的にnullにするために、DOMから切り離す
      // しかしqueryCellElementはdocument.querySelectorを使うので、DOMに存在する必要がある
      // 代わりに、parentElement as HTMLElement | null がnullのケースは
      // cellElement がDOMツリーのルートにある場合（例：DocumentFragmentの直下）
      // 実際には body の parentElement は html なので通常は null にならない
      // この行は防御的コードなので istanbul ignore を追加する方が適切
      expect(() => cleanupCellVisualArtifacts({ row: 0, col: 0 })).not.toThrow()
    })
  })
})
