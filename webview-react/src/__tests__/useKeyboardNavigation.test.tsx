import React from 'react'
import { render, cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useEffect } from 'react'
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  jest.useRealTimers()
})

beforeEach(() => {
  jest.useFakeTimers()
})

function TestHarness(props: any) {
  const nav = useKeyboardNavigation({
    tableData: props.tableData,
    currentEditingCell: props.currentEditingCell,
    selectionRange: props.selectionRange,
    selectionAnchor: props.selectionAnchor,
    onCellSelect: props.onCellSelect,
    onCellEdit: props.onCellEdit,
    onCopy: props.onCopy,
    onPaste: props.onPaste,
    onCut: props.onCut,
    onClearCells: props.onClearCells,
    onSelectAll: props.onSelectAll,
    onSetSelectionAnchor: props.onSetSelectionAnchor,
    onUndo: props.onUndo,
    onRedo: props.onRedo,
    headerConfig: props.headerConfig,
    onOpenSearch: props.onOpenSearch,
  })

  useEffect(() => {
    const el = document.createElement('div')
    el.classList.add('input-capture')
    el.setAttribute('data-testid', 'host')
    document.body.appendChild(el)
    el.focus()
    return () => { if (el.parentNode) { el.parentNode.removeChild(el) } }
  }, [])

  // expose nav result via data attribute for testing
  if (props.onNavResult) {
    props.onNavResult(nav)
  }

  return null
}

const defaultTableData = {
  headers: ['a', 'b', 'c'],
  rows: [['1', '2', '3'], ['4', '', '6'], ['7', '8', '9']],
}

const defaultSelection = { start: { row: 1, col: 1 }, end: { row: 1, col: 1 } }

function createProps(overrides?: Record<string, unknown>) {
  return {
    tableData: defaultTableData,
    currentEditingCell: null,
    selectionRange: defaultSelection,
    selectionAnchor: null,
    onCellSelect: jest.fn(),
    onCellEdit: jest.fn(),
    onCopy: jest.fn(),
    onPaste: jest.fn(),
    onCut: jest.fn(),
    onClearCells: jest.fn(),
    onSelectAll: jest.fn(),
    onSetSelectionAnchor: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    headerConfig: { hasColumnHeaders: true, hasRowHeaders: false },
    onOpenSearch: jest.fn(),
    ...overrides,
  }
}

function dispatchKey(key: string, opts?: Partial<KeyboardEventInit>) {
  const ev = new KeyboardEvent('keydown', { key, bubbles: true, ...opts })
  document.dispatchEvent(ev)
  // setTimeout コールバック(scrollCellIntoView等)を即座に実行
  jest.runAllTimers()
}

describe('useKeyboardNavigation', () => {
  describe('矢印キーナビゲーション', () => {
    it('ArrowDown で下に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown')
      expect(props.onCellSelect).toHaveBeenCalledWith(2, 1, false)
    })

    it('ArrowUp で上に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp')
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 1, false)
    })

    it('ArrowLeft で左に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('ArrowLeft')
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('ArrowRight で右に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('ArrowRight')
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 2, false)
    })

    it('Shift+ArrowDown で選択範囲を拡張', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { shiftKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(2, 1, true)
    })

    it('Ctrl+ArrowDown でスマートナビゲーション', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { ctrlKey: true })
      // 現在のセル(1,1)は空→次のセルが空でない→行2に移動
      expect(props.onCellSelect).toHaveBeenCalled()
    })

    it('Ctrl+ArrowUp でスマートナビゲーション', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalled()
    })

    it('Ctrl+ArrowLeft でスマートナビゲーション', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('ArrowLeft', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalled()
    })

    it('Ctrl+ArrowRight でスマートナビゲーション', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('ArrowRight', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalled()
    })

    it('上端でArrowUpしても行0以下にならない', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp')
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('下端でArrowDownしても最終行を超えない', () => {
      const props = createProps({
        selectionRange: { start: { row: 2, col: 0 }, end: { row: 2, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown')
      expect(props.onCellSelect).toHaveBeenCalledWith(2, 0, false)
    })

    it('左端でArrowLeftしても列0以下にならない', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowLeft')
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('右端でArrowRightしても最終列を超えない', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 2 }, end: { row: 0, col: 2 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowRight')
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 2, false)
    })
  })

  describe('Tab ナビゲーション', () => {
    it('Tab で右のセルに移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('Tab')
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 2, false)
    })

    it('Shift+Tab で左のセルに移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('Tab', { shiftKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('最終列でTabを押すと次の行の最初に移動', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 2 }, end: { row: 0, col: 2 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Tab')
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('最初の列でShift+Tabすると前の行の最終列に移動', () => {
      const props = createProps({
        selectionRange: { start: { row: 1, col: 0 }, end: { row: 1, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Tab', { shiftKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 2, false)
    })

    it('最終行最終列でTabすると最初の行の最初に戻る', () => {
      const props = createProps({
        selectionRange: { start: { row: 2, col: 2 }, end: { row: 2, col: 2 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Tab')
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('最初の行最初の列でShift+Tabすると最後に戻る', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Tab', { shiftKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(2, 2, false)
    })
  })

  describe('Home / End', () => {
    it('Home で行の最初に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('Home')
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('Ctrl+Home でテーブルの左上に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('Home', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('End で行の最後に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('End')
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 2, false)
    })

    it('Ctrl+End でテーブルの右下に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('End', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(2, 2, false)
    })
  })

  describe('PageUp / PageDown', () => {
    it('PageUp で10行上に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('PageUp')
      // row=1 - 10 = -9 → max(0, -9) = 0
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 1, false)
    })

    it('PageDown で10行下に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('PageDown')
      // row=1 + 10 = 11 → min(2, 11) = 2
      expect(props.onCellSelect).toHaveBeenCalledWith(2, 1, false)
    })
  })

  describe('Enter / F2', () => {
    it('Enter で編集モードに入る', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('Enter')
      expect(props.onCellEdit).toHaveBeenCalledWith({ row: 1, col: 1 })
    })

    it('Shift+Enter で上に移動', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('Enter', { shiftKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 1, false)
    })

    it('F2 で編集モードに入る', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('F2')
      expect(props.onCellEdit).toHaveBeenCalledWith({ row: 1, col: 1 })
    })

    it('複数選択時のEnterは範囲内で移動', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Enter')
      // 複数選択なので編集ではなく移動
      expect(props.onCellSelect).toHaveBeenCalled()
      expect(props.onCellEdit).not.toHaveBeenCalled()
    })
  })

  describe('Delete / Backspace', () => {
    it('Delete でセルをクリア', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('Delete')
      expect(props.onClearCells).toHaveBeenCalled()
    })

    it('Backspace でセルをクリア', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('Backspace')
      expect(props.onClearCells).toHaveBeenCalled()
    })
  })

  describe('コピー・ペースト・カット', () => {
    it('Ctrl+C でコピー', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('c', { ctrlKey: true })
      expect(props.onCopy).toHaveBeenCalled()
    })

    it('Ctrl+V でペースト', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('v', { ctrlKey: true })
      expect(props.onPaste).toHaveBeenCalled()
    })

    it('Ctrl+X でカット', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('x', { ctrlKey: true })
      expect(props.onCut).toHaveBeenCalled()
    })

    it('大文字でも動作: Ctrl+C', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('C', { ctrlKey: true })
      expect(props.onCopy).toHaveBeenCalled()
    })

    it('大文字でも動作: Ctrl+V', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('V', { ctrlKey: true })
      expect(props.onPaste).toHaveBeenCalled()
    })

    it('大文字でも動作: Ctrl+X', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('X', { ctrlKey: true })
      expect(props.onCut).toHaveBeenCalled()
    })
  })

  describe('Ctrl+A (全選択)', () => {
    it('Ctrl+A で全選択', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('a', { ctrlKey: true })
      expect(props.onSelectAll).toHaveBeenCalled()
    })

    it('Ctrl+A 大文字でも動作', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('A', { ctrlKey: true })
      expect(props.onSelectAll).toHaveBeenCalled()
    })
  })

  describe('Ctrl+Z / Ctrl+Y (Undo/Redo)', () => {
    it('Ctrl+Z でUndo', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('z', { ctrlKey: true })
      expect(props.onUndo).toHaveBeenCalled()
    })

    it('Ctrl+Y でRedo', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('y', { ctrlKey: true })
      expect(props.onRedo).toHaveBeenCalled()
    })

    it('Ctrl+Shift+Z でRedo', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('z', { ctrlKey: true, shiftKey: true })
      expect(props.onRedo).toHaveBeenCalled()
    })
  })

  describe('Ctrl+F / Ctrl+H (検索)', () => {
    it('Ctrl+F で検索を開く', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('f', { ctrlKey: true })
      expect(props.onOpenSearch).toHaveBeenCalledWith(false)
    })

    it('Ctrl+H で置換付き検索を開く', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('h', { ctrlKey: true })
      expect(props.onOpenSearch).toHaveBeenCalledWith(true)
    })

    it('大文字でも動作: Ctrl+F', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('F', { ctrlKey: true })
      expect(props.onOpenSearch).toHaveBeenCalledWith(false)
    })

    it('大文字でも動作: Ctrl+H', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('H', { ctrlKey: true })
      expect(props.onOpenSearch).toHaveBeenCalledWith(true)
    })

    it('onOpenSearch がない場合は何もしない', () => {
      const props = createProps({ onOpenSearch: undefined })
      render(<TestHarness {...props} />)
      expect(() => { dispatchKey('f', { ctrlKey: true }) }).not.toThrow()
    })
  })

  describe('Escape', () => {
    it('Escape キーでイベントが処理される', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      expect(() => { dispatchKey('Escape') }).not.toThrow()
    })
  })

  describe('Shift キー', () => {
    it('Shift を押すとアンカーが設定される', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('Shift')
      expect(props.onSetSelectionAnchor).toHaveBeenCalledWith({ row: 1, col: 1 })
    })

    it('Shift を押した時 selectionRange.end がない場合は start が使われる', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 } } as any, // end がない
      })
      render(<TestHarness {...props} />)
      dispatchKey('Shift')
      expect(props.onSetSelectionAnchor).toHaveBeenCalledWith({ row: 0, col: 0 })
    })

    it('既にアンカーがある場合はShiftで再設定しない', () => {
      const props = createProps({
        selectionAnchor: { row: 0, col: 0 }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Shift')
      expect(props.onSetSelectionAnchor).not.toHaveBeenCalled()
    })
  })

  describe('フォーム要素フォーカス時の無視', () => {
    it('input要素にフォーカスがある場合はキーイベントを無視', () => {
      const props = createProps()
      render(<TestHarness {...props} />)

      const input = document.createElement('input')
      document.body.appendChild(input)
      input.focus()

      dispatchKey('ArrowDown')
      expect(props.onCellSelect).not.toHaveBeenCalled()
    })

    it('textarea要素にフォーカスがある場合はキーイベントを無視', () => {
      const props = createProps()
      render(<TestHarness {...props} />)

      const textarea = document.createElement('textarea')
      document.body.appendChild(textarea)
      textarea.focus()

      dispatchKey('ArrowDown')
      expect(props.onCellSelect).not.toHaveBeenCalled()
    })

    it('header-input クラスの要素はフォーム要素扱いしない', () => {
      const props = createProps()
      render(<TestHarness {...props} />)

      const input = document.createElement('input')
      input.classList.add('header-input')
      document.body.appendChild(input)
      input.focus()

      // header-input でも currentEditingCell がない場合は通過しないはず
      // ただし実際のロジック上は header-input は isFormField=false だが
      // isHeaderEditing=true → currentEditingCell チェックに進む
      dispatchKey('ArrowDown')
      // currentEditingCell=null なので通常のナビゲーションが実行される
      expect(props.onCellSelect).toHaveBeenCalled()
    })
  })

  describe('編集中のキー入力', () => {
    it('編集中にCtrl+Cは通常のブラウザ処理に委ねる', () => {
      const props = createProps({
        currentEditingCell: { row: 0, col: 0 }
      })
      render(<TestHarness {...props} />)

      const ta = document.createElement('textarea')
      ta.classList.add('input-capture')
      document.body.appendChild(ta)
      ta.focus()

      dispatchKey('c', { ctrlKey: true })
      // 編集中のCtrl+Cはコピーハンドラに渡さない
      expect(props.onCopy).not.toHaveBeenCalled()
    })

    it('編集中のEnter/Tab/Escapeはreturnする', () => {
      const props = createProps({
        currentEditingCell: { row: 0, col: 0 }
      })
      render(<TestHarness {...props} />)

      const ta = document.createElement('textarea')
      ta.classList.add('input-capture')
      document.body.appendChild(ta)
      ta.focus()

      dispatchKey('Enter')
      expect(props.onCellEdit).not.toHaveBeenCalled()
    })

    it('編集中のその他のキーはreturn', () => {
      const props = createProps({
        currentEditingCell: { row: 0, col: 0 }
      })
      render(<TestHarness {...props} />)

      const ta = document.createElement('textarea')
      ta.classList.add('input-capture')
      document.body.appendChild(ta)
      ta.focus()

      dispatchKey('a')
      expect(props.onCellSelect).not.toHaveBeenCalled()
    })
  })

  describe('selectionRange がない場合', () => {
    it('selectionRange がnullの場合は何もしない', () => {
      const props = createProps({ selectionRange: null })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown')
      expect(props.onCellSelect).not.toHaveBeenCalled()
    })
  })

  describe('headerConfig.hasColumnHeaders=false', () => {
    it('hasColumnHeaders=false で行-1まで移動可能', () => {
      const props = createProps({
        headerConfig: { hasColumnHeaders: false, hasRowHeaders: false },
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp')
      expect(props.onCellSelect).toHaveBeenCalledWith(-1, 0, false)
    })

    it('hasColumnHeaders=false でCtrl+Arrowも使える (minRow = -1)', () => {
      const tableData = {
        headers: ['a'],
        rows: [['x'], ['y']],
      }
      const props = createProps({
        tableData,
        headerConfig: { hasColumnHeaders: false, hasRowHeaders: false },
        selectionRange: { start: { row: 1, col: 0 }, end: { row: 1, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalled()
    })

    it('hasColumnHeaders=false でTabの折り返しがrow=-1を含む', () => {
      const props = createProps({
        headerConfig: { hasColumnHeaders: false, hasRowHeaders: false },
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Tab', { shiftKey: true })
      // Shift+Tab: col=0, row>minRow(-1)なのでrow=0-1=-1, col=maxCol=2
      expect(props.onCellSelect).toHaveBeenCalledWith(-1, 2, false)
    })

    it('hasColumnHeaders=false でTab先頭ラップ (最終行→行-1)', () => {
      const props = createProps({
        headerConfig: { hasColumnHeaders: false, hasRowHeaders: false },
        selectionRange: { start: { row: 2, col: 2 }, end: { row: 2, col: 2 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Tab')
      // Tab: col=2=maxCol, row=2=maxRow → wrap to minRow=-1, col=0
      expect(props.onCellSelect).toHaveBeenCalledWith(-1, 0, false)
    })

    it('hasColumnHeaders=false でHome/Ctrl+Home', () => {
      const props = createProps({
        headerConfig: { hasColumnHeaders: false, hasRowHeaders: false },
        selectionRange: { start: { row: 1, col: 1 }, end: { row: 1, col: 1 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Home', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(-1, 0, false)
    })

    it('hasColumnHeaders=false でPageUp', () => {
      const props = createProps({
        headerConfig: { hasColumnHeaders: false, hasRowHeaders: false },
        selectionRange: { start: { row: 1, col: 0 }, end: { row: 1, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('PageUp')
      // row=1 - 10 = -9 → max(-1, -9) = -1
      expect(props.onCellSelect).toHaveBeenCalledWith(-1, 0, false)
    })

    it('hasColumnHeaders=false でEnter (minRow=-1)', () => {
      const props = createProps({
        headerConfig: { hasColumnHeaders: false, hasRowHeaders: false },
        selectionRange: { start: { row: -1, col: 0 }, end: { row: -1, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Enter')
      // row=-1 >= minRow(-1) なので編集モード
      expect(props.onCellEdit).toHaveBeenCalledWith({ row: -1, col: 0 })
    })

    it('hasColumnHeaders=false でF2 (row=-1でも編集可)', () => {
      const props = createProps({
        headerConfig: { hasColumnHeaders: false, hasRowHeaders: false },
        selectionRange: { start: { row: -1, col: 0 }, end: { row: -1, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('F2')
      expect(props.onCellEdit).toHaveBeenCalledWith({ row: -1, col: 0 })
    })
  })

  describe('metaKey (macOS Cmd)', () => {
    it('metaKey+C でコピー', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('c', { metaKey: true })
      expect(props.onCopy).toHaveBeenCalled()
    })
  })

  describe('スマートナビゲーションの詳細', () => {
    // ---- UP direction ----
    it('Ctrl+Up: 内容あり→内容ありで同一状態の端までジャンプ (same state branch)', () => {
      const tableData = {
        headers: ['a'],
        rows: [['x'], ['y'], ['z'], ['w']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 3, col: 0 }, end: { row: 3, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('Ctrl+Up: 内容あり→空セルでdifferent stateの端までジャンプ', () => {
      const tableData = {
        headers: ['a'],
        rows: [['x'], [''], [''], ['y']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 3, col: 0 }, end: { row: 3, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('Ctrl+Up: 空セル→空セルで同一状態の端までジャンプ', () => {
      const tableData = {
        headers: ['a'],
        rows: [['x'], [''], [''], ['']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 3, col: 0 }, end: { row: 3, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('Ctrl+Up: 空セル→内容ありでdifferent stateジャンプ', () => {
      const tableData = {
        headers: ['a'],
        rows: [['x'], ['y'], ['z'], ['']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 3, col: 0 }, end: { row: 3, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('Ctrl+Up: 最上行から動かない', () => {
      const tableData = {
        headers: ['a'],
        rows: [['x'], ['y']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowUp', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    // ---- DOWN direction ----
    it('Ctrl+Down: 内容あり→内容ありで同一状態の端までジャンプ (same state branch)', () => {
      const tableData = {
        headers: ['a'],
        rows: [['x'], ['y'], ['z'], ['w']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(3, 0, false)
    })

    it('Ctrl+Down: 内容あり→空セルでdifferent stateジャンプ', () => {
      const tableData = {
        headers: ['a'],
        rows: [['x'], [''], [''], ['y']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(2, 0, false)
    })

    it('Ctrl+Down: 空セル→空セルで同一状態の端までジャンプ', () => {
      const tableData = {
        headers: ['a'],
        rows: [[''], [''], [''], ['x']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(2, 0, false)
    })

    it('Ctrl+Down: 空セル→内容ありでdifferent stateジャンプ', () => {
      const tableData = {
        headers: ['a'],
        rows: [[''], ['x'], ['y'], ['z']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(3, 0, false)
    })

    it('Ctrl+Down: 最下行から動かない', () => {
      const tableData = {
        headers: ['a'],
        rows: [['x'], ['y']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 1, col: 0 }, end: { row: 1, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    // ---- LEFT direction ----
    it('Ctrl+Left: 内容あり→内容ありで同一状態の端までジャンプ', () => {
      const tableData = {
        headers: ['a', 'b', 'c', 'd'],
        rows: [['x', 'y', 'z', 'w']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 3 }, end: { row: 0, col: 3 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowLeft', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('Ctrl+Left: 内容あり→空セルでdifferent stateジャンプ', () => {
      const tableData = {
        headers: ['a', 'b', 'c', 'd'],
        rows: [['x', '', '', 'y']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 3 }, end: { row: 0, col: 3 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowLeft', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 1, false)
    })

    it('Ctrl+Left: 空セル→空セルで同一状態の端までジャンプ', () => {
      const tableData = {
        headers: ['a', 'b', 'c', 'd'],
        rows: [['x', '', '', '']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 3 }, end: { row: 0, col: 3 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowLeft', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 1, false)
    })

    it('Ctrl+Left: 空セル→内容ありでdifferent stateジャンプ', () => {
      const tableData = {
        headers: ['a', 'b', 'c', 'd'],
        rows: [['x', 'y', 'z', '']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 3 }, end: { row: 0, col: 3 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowLeft', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    it('Ctrl+Left: 最左列から動かない', () => {
      const tableData = {
        headers: ['a', 'b'],
        rows: [['x', 'y']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowLeft', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, false)
    })

    // ---- RIGHT direction ----
    it('Ctrl+Right: 内容あり→内容ありで同一状態の端までジャンプ', () => {
      const tableData = {
        headers: ['a', 'b', 'c', 'd'],
        rows: [['x', 'y', 'z', 'w']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowRight', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 3, false)
    })

    it('Ctrl+Right: 内容あり→空セルでdifferent stateジャンプ', () => {
      const tableData = {
        headers: ['a', 'b', 'c', 'd'],
        rows: [['x', '', '', 'y']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowRight', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 2, false)
    })

    it('Ctrl+Right: 空セル→空セルで同一状態の端までジャンプ', () => {
      const tableData = {
        headers: ['a', 'b', 'c', 'd'],
        rows: [['', '', '', 'x']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowRight', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 2, false)
    })

    it('Ctrl+Right: 空セル→内容ありでdifferent stateジャンプ', () => {
      const tableData = {
        headers: ['a', 'b', 'c', 'd'],
        rows: [['', 'x', 'y', 'z']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowRight', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 3, false)
    })

    it('Ctrl+Right: 最右列から動かない', () => {
      const tableData = {
        headers: ['a', 'b'],
        rows: [['x', 'y']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 1 }, end: { row: 0, col: 1 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowRight', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 1, false)
    })
  })

  describe('複数選択時のEnter循環', () => {
    it('選択範囲の最終行を超えると最初の行に戻る', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('Enter')
      expect(props.onCellSelect).toHaveBeenCalled()
    })

    it('最終列を超えると最初の列に戻る', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 2, col: 2 } },
        selectionAnchor: { row: 2, col: 2 }
      })
      render(<TestHarness {...props} />)
      // End position (2,2) → next row would be 3 > maxSelRow 2
      // → nextRow = 0, nextCol = 2+1 = 3 > maxSelCol 2 → nextCol = 0
      dispatchKey('Enter')
      expect(props.onCellSelect).toHaveBeenCalled()
    })

    it('最終行最終列でEnterすると左上に戻る (行・列ともに折り返し)', () => {
      // selectionAnchor があるので currentPos = selectionAnchor を使う
      // selectionAnchor が最終行最終列のケース
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 2, col: 2 } },
        // selectionAnchor は Enter非Shift時は使わない（shiftKey=false → currentPos = selectionRange.end）
      })
      render(<TestHarness {...props} />)
      // currentPos = end = (2,2), nextRow = 3 > maxSelRow(2) → nextRow=0, nextCol=3 > maxSelCol(2) → nextCol=0
      dispatchKey('Enter')
      expect(props.onSetSelectionAnchor).toHaveBeenCalledWith(null)
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, true)
    })

    it('行が折り返しても列はそのまま進む', () => {
      // currentPos at (1, 0), selection (0,0)-(1,1)
      // nextRow = 2 > maxSelRow(1) → nextRow = 0, nextCol = 0+1 = 1 <= maxSelCol(1)
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } }
      })
      render(<TestHarness {...props} />)
      // currentPos = end = (1,1), nextRow = 2 > 1 → wrap: nextRow=0, nextCol=1+1=2 > 1 → nextCol=0
      dispatchKey('Enter')
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 0, true)
    })

    it('行折り返しで列が増加するケース', () => {
      // 3x3テーブルで選択(0,0)-(2,2)、currentPos at (2,1)
      // nextRow = 3 > 2 → wrap: nextRow=0, nextCol=1+1=2 <= 2
      const tableData = {
        headers: ['a', 'b', 'c'],
        rows: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 2, col: 2 } },
        selectionAnchor: { row: 2, col: 1 }
      })
      render(<TestHarness {...props} />)
      // selectionAnchor used (non-shift Enter → currentPos = selectionAnchor = (2,1))
      // nextRow=3 > 2 → nextRow=0, nextCol=1+1=2 <= 2
      dispatchKey('Enter')
      expect(props.onCellSelect).toHaveBeenCalledWith(0, 2, true)
    })
  })

  describe('不明なキー', () => {
    it('未知のキーは無視される', () => {
      const props = createProps()
      render(<TestHarness {...props} />)
      dispatchKey('q')
      expect(props.onCellSelect).not.toHaveBeenCalled()
      expect(props.onCellEdit).not.toHaveBeenCalled()
    })
  })

  describe('scrollCellIntoView', () => {
    it('矢印キーでDOM上のセルにscrollIntoViewが呼ばれる', () => {
      const props = createProps()
      render(<TestHarness {...props} />)

      // セルのDOM要素を追加
      const td = document.createElement('td')
      td.setAttribute('data-row', '2')
      td.setAttribute('data-col', '1')
      td.scrollIntoView = jest.fn()
      document.body.appendChild(td)

      dispatchKey('ArrowDown')

      expect(td.scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto', block: 'nearest', inline: 'nearest'
      })
    })

    it('DOM上にセルがない場合はスキップ', () => {
      const props = createProps()
      render(<TestHarness {...props} />)

      // scrollIntoView がなくてもエラーにならない
      expect(() => dispatchKey('ArrowDown')).not.toThrow()
    })
  })

  describe('getNextCellPosition / getTabNextPosition の返り値', () => {
    it('getNextCellPosition が返される', () => {
      let navResult: any
      const props = createProps({
        onNavResult: (nav: any) => { navResult = nav },
      })
      render(<TestHarness {...props} />)
      expect(navResult).toBeDefined()
      expect(navResult.getNextCellPosition).toBeDefined()
      expect(navResult.getTabNextPosition).toBeDefined()
    })

    it('getNextCellPosition で直接計算できる', () => {
      let navResult: any
      const props = createProps({
        onNavResult: (nav: any) => { navResult = nav },
      })
      render(<TestHarness {...props} />)
      const result = navResult.getNextCellPosition({ row: 1, col: 1 }, 'up')
      expect(result).toEqual({ row: 0, col: 1 })
    })

    it('getNextCellPosition で default 分岐を通る', () => {
      let navResult: any
      const props = createProps({
        onNavResult: (nav: any) => { navResult = nav },
      })
      render(<TestHarness {...props} />)
      // 不正な direction を渡すと default: return currentPos
      const result = navResult.getNextCellPosition({ row: 1, col: 1 }, 'invalid' as any)
      expect(result).toEqual({ row: 1, col: 1 })
    })

    it('getTabNextPosition で直接計算できる', () => {
      let navResult: any
      const props = createProps({
        onNavResult: (nav: any) => { navResult = nav },
      })
      render(<TestHarness {...props} />)
      const result = navResult.getTabNextPosition({ row: 0, col: 0 }, true)
      // Shift+Tab: 最初のセル → ラップして最後のセル
      expect(result).toEqual({ row: 2, col: 2 })
    })

    it('getTabNextPosition のデフォルト引数 (shiftKey=false)', () => {
      let navResult: any
      const props = createProps({
        onNavResult: (nav: any) => { navResult = nav },
      })
      render(<TestHarness {...props} />)
      // shiftKey引数を省略してデフォルト値(false)を通す
      const result = navResult.getTabNextPosition({ row: 0, col: 0 })
      expect(result).toEqual({ row: 0, col: 1 })
    })

    it('getNextCellPosition のデフォルト引数 (ctrlKey=false)', () => {
      let navResult: any
      const props = createProps({
        onNavResult: (nav: any) => { navResult = nav },
      })
      render(<TestHarness {...props} />)
      // ctrlKey引数を省略してデフォルト値(false)を通す
      const result = navResult.getNextCellPosition({ row: 0, col: 0 }, 'down')
      expect(result).toEqual({ row: 1, col: 0 })
    })
  })

  describe('cell-input / contentEditable フォーカスチェック', () => {
    it('cell-input クラスの要素で currentEditingCell がある場合は無視', () => {
      const props = createProps({
        currentEditingCell: { row: 0, col: 0 }
      })
      render(<TestHarness {...props} />)

      const input = document.createElement('input')
      input.classList.add('cell-input')
      document.body.appendChild(input)
      input.focus()

      dispatchKey('ArrowDown')
      expect(props.onCellSelect).not.toHaveBeenCalled()
    })

    it('cell-input クラスの要素で currentEditingCell がnullの場合は通過', () => {
      const props = createProps()
      render(<TestHarness {...props} />)

      const input = document.createElement('input')
      input.classList.add('cell-input')
      document.body.appendChild(input)
      input.focus()

      dispatchKey('ArrowDown')
      expect(props.onCellSelect).toHaveBeenCalled()
    })

    it('contentEditable要素にフォーカスがある場合はキーイベントを無視', () => {
      const props = createProps()
      render(<TestHarness {...props} />)

      const div = document.createElement('div')
      div.setAttribute('contenteditable', 'true')
      // jsdom では isContentEditable を手動で設定する必要がある
      Object.defineProperty(div, 'isContentEditable', { value: true })
      document.body.appendChild(div)
      div.focus()

      dispatchKey('ArrowDown')
      expect(props.onCellSelect).not.toHaveBeenCalled()
    })
  })

  describe('selectionAnchor を使ったナビゲーション', () => {
    it('selectionAnchor がありShift無しの場合 anchorPos を基準にする', () => {
      const props = createProps({
        selectionAnchor: { row: 0, col: 0 },
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 2, col: 2 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown')
      // selectionAnchor (0,0) を基準に下移動 → (1, 0)
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('selectionAnchor がありShiftの場合 selectionRange.end を基準にする', () => {
      const props = createProps({
        selectionAnchor: { row: 0, col: 0 },
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 2, col: 2 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { shiftKey: true })
      // Shift → currentPos = selectionRange.end (2, 2) → 下に移動（境界なのでそのまま）
      expect(props.onCellSelect).toHaveBeenCalledWith(2, 2, true)
    })
  })

  describe('hasContent のエッジケース', () => {
    it('セル値がnullの場合は空として扱われる', () => {
      const tableData = {
        headers: ['a', 'b'],
        rows: [[null as any, 'x'], ['y', null as any]],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      // (0,0)=null(空), (1,0)=y(非空) → different state → 行1にジャンプ
      dispatchKey('ArrowDown', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('セル値がundefinedの場合は空として扱われる', () => {
      const tableData = {
        headers: ['a', 'b'],
        rows: [[undefined as any, 'x'], ['y', undefined as any]],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { ctrlKey: true })
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })

    it('セル値がスペースのみの場合は空として扱われる', () => {
      const tableData = {
        headers: ['a'],
        rows: [['  '], ['x']],
      }
      const props = createProps({
        tableData,
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } }
      })
      render(<TestHarness {...props} />)
      dispatchKey('ArrowDown', { ctrlKey: true })
      // (0,0)=空(空白のみ), (1,0)=x → different state → 行1にジャンプ
      expect(props.onCellSelect).toHaveBeenCalledWith(1, 0, false)
    })
  })
})
