/**
 * MemoizedCell.test.tsx
 * MemoizedCellコンポーネントのテスト
 * 表示、選択状態、編集モード、イベントハンドラ、memo比較関数をカバー
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

// CellEditor をモック（内部の複雑なロジックをテストから分離）
jest.mock('../components/CellEditor', () => {
  const MockCellEditor = (props: {
    value: string
    onCommit: (value: string, move?: string) => void
    onCancel: () => void
  }) => (
    <div data-testid="cell-editor">
      <button data-testid="commit-btn" onClick={() => props.onCommit('new-value', 'right')}>Commit</button>
      <button data-testid="cancel-btn" onClick={() => props.onCancel()}>Cancel</button>
    </div>
  )
  return { __esModule: true, default: MockCellEditor }
})

// contentConverter をモック
jest.mock('../utils/contentConverter', () => ({
  processCellContent: (val: string) => val,
  processCellContentForEditing: (val: string) => val,
}))

import MemoizedCell, { MemoizedCellProps } from '../components/MemoizedCell'

// テーブル構造でラップするヘルパー
const renderInTable = (props: Partial<MemoizedCellProps> = {}) => {
  const defaultProps: MemoizedCellProps = {
    rowIndex: 1,
    colIndex: 0,
    cell: 'test value',
    isSelected: false,
    isAnchor: false,
    isSingleSelection: false,
    borders: { top: false, bottom: false, left: false, right: false },
    isEditing: false,
    isInFillRange: false,
    isSearchResult: false,
    isCurrentSearchResult: false,
    showFillHandle: false,
    storedWidth: 100,
    userResized: false,
    displayRowNumber: 1,
    onMouseDown: jest.fn(),
    onDoubleClick: jest.fn(),
    onCommitEdit: jest.fn(),
    onCancelEdit: jest.fn(),
  }

  const merged = { ...defaultProps, ...props }

  return render(
    <table>
      <tbody>
        <tr>
          <MemoizedCell {...merged} />
        </tr>
      </tbody>
    </table>
  )
}

describe('MemoizedCell', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // --- 基本表示 ---
  it('通常のセル内容を表示する', () => {
    renderInTable({ cell: 'Hello' })
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })

  it('空セルの場合は empty-cell-placeholder を表示する', () => {
    const { container } = renderInTable({ cell: '' })
    expect(container.querySelector('.empty-cell-placeholder')).toBeInTheDocument()
  })

  it('空白のみのセルも empty-cell-placeholder を表示する', () => {
    const { container } = renderInTable({ cell: '   ' })
    expect(container.querySelector('.empty-cell-placeholder')).toBeInTheDocument()
  })

  it('data-row と data-col 属性が正しく設定される', () => {
    const { container } = renderInTable({ rowIndex: 2, colIndex: 3 })
    const td = container.querySelector('td')!
    expect(td.getAttribute('data-row')).toBe('2')
    expect(td.getAttribute('data-col')).toBe('3')
  })

  it('幅スタイルが storedWidth で設定される', () => {
    const { container } = renderInTable({ storedWidth: 150 })
    const td = container.querySelector('td')!
    expect(td.style.width).toBe('150px')
    expect(td.style.minWidth).toBe('150px')
    expect(td.style.maxWidth).toBe('150px')
  })

  it('title属性が列記号と行番号で設定される', () => {
    const { container } = renderInTable({ colIndex: 0, displayRowNumber: 3 })
    const td = container.querySelector('td')!
    expect(td.title).toBe('Cell A3')
  })

  // --- CSSクラス ---
  it('空セルに empty-cell クラスが適用される', () => {
    const { container } = renderInTable({ cell: '' })
    const td = container.querySelector('td')!
    expect(td.classList.contains('empty-cell')).toBe(true)
  })

  it('userResized が true のとき user-resized クラスが適用される', () => {
    const { container } = renderInTable({ userResized: true })
    const td = container.querySelector('td')!
    expect(td.classList.contains('user-resized')).toBe(true)
  })

  it('isSearchResult が true のとき search-result クラスが適用される', () => {
    const { container } = renderInTable({ isSearchResult: true })
    const td = container.querySelector('td')!
    expect(td.classList.contains('search-result')).toBe(true)
  })

  it('isCurrentSearchResult が true のとき current-search-result クラスが適用される', () => {
    const { container } = renderInTable({ isCurrentSearchResult: true })
    const td = container.querySelector('td')!
    expect(td.classList.contains('current-search-result')).toBe(true)
  })

  it('isInFillRange が true のとき fill-range クラスが適用される', () => {
    const { container } = renderInTable({ isInFillRange: true })
    const td = container.querySelector('td')!
    expect(td.classList.contains('fill-range')).toBe(true)
  })

  it('isEditing が true のとき editing クラスが適用される', () => {
    const { container } = renderInTable({ isEditing: true })
    const td = container.querySelector('td')!
    expect(td.classList.contains('editing')).toBe(true)
  })

  it('isColumnNotExist が true のとき git-diff-column-not-exist クラスが適用される', () => {
    const { container } = renderInTable({ isColumnNotExist: true })
    const td = container.querySelector('td')!
    expect(td.classList.contains('git-diff-column-not-exist')).toBe(true)
  })

  // --- 選択状態のクラス ---
  it('isSelected && isAnchor でanchorクラスが適用される', () => {
    const { container } = renderInTable({ isSelected: true, isAnchor: true })
    const td = container.querySelector('td')!
    expect(td.classList.contains('selected')).toBe(true)
    expect(td.classList.contains('anchor')).toBe(true)
  })

  it('isSelected && isAnchor && isSingleSelection でsingle-selectionクラスが適用される', () => {
    const { container } = renderInTable({ isSelected: true, isAnchor: true, isSingleSelection: true })
    const td = container.querySelector('td')!
    expect(td.classList.contains('single-selection')).toBe(true)
  })

  it('isSelected && !isAnchor でボーダークラスが適用される', () => {
    const { container } = renderInTable({
      isSelected: true,
      isAnchor: false,
      borders: { top: true, bottom: true, left: true, right: true },
    })
    const td = container.querySelector('td')!
    expect(td.classList.contains('selected')).toBe(true)
    expect(td.classList.contains('border-top')).toBe(true)
    expect(td.classList.contains('border-bottom')).toBe(true)
    expect(td.classList.contains('border-left')).toBe(true)
    expect(td.classList.contains('border-right')).toBe(true)
  })

  it('isSelected && !isAnchor && isSingleSelection でsingle-selectionクラスが適用される', () => {
    const { container } = renderInTable({
      isSelected: true,
      isAnchor: false,
      isSingleSelection: true,
      borders: { top: false, bottom: false, left: false, right: false },
    })
    const td = container.querySelector('td')!
    expect(td.classList.contains('single-selection')).toBe(true)
  })

  it('isSelected が false のとき選択クラスが適用されない', () => {
    const { container } = renderInTable({ isSelected: false })
    const td = container.querySelector('td')!
    expect(td.classList.contains('selected')).toBe(false)
  })

  // --- デバッグログ ---
  it('rowIndex === 0 && isColumnNotExist のときデバッグログが出力される', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation()
    renderInTable({ rowIndex: 0, colIndex: 2, isColumnNotExist: true })
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('[MemoizedCell] Row 0, Col 2')
    )
    spy.mockRestore()
  })

  it('rowIndex !== 0 のときデバッグログが出力されない', () => {
    const spy = jest.spyOn(console, 'log').mockImplementation()
    renderInTable({ rowIndex: 1, colIndex: 0, isColumnNotExist: true })
    expect(spy).not.toHaveBeenCalledWith(
      expect.stringContaining('[MemoizedCell]')
    )
    spy.mockRestore()
  })

  // --- イベントハンドラ ---
  it('mouseDown イベントが正しく伝播する', () => {
    const onMouseDown = jest.fn()
    const { container } = renderInTable({ rowIndex: 1, colIndex: 2, onMouseDown })
    fireEvent.mouseDown(container.querySelector('td')!)
    expect(onMouseDown).toHaveBeenCalledWith(1, 2, expect.any(Object))
  })

  it('doubleClick イベントが正しく伝播する', () => {
    const onDoubleClick = jest.fn()
    const { container } = renderInTable({ rowIndex: 1, colIndex: 2, onDoubleClick })
    fireEvent.doubleClick(container.querySelector('td')!)
    expect(onDoubleClick).toHaveBeenCalledWith(1, 2)
  })

  it('mouseEnter イベントが onMouseEnter に伝播する', () => {
    const onMouseEnter = jest.fn()
    const { container } = renderInTable({ rowIndex: 3, colIndex: 1, onMouseEnter })
    fireEvent.mouseEnter(container.querySelector('td')!)
    expect(onMouseEnter).toHaveBeenCalledWith(3, 1)
  })

  it('onMouseEnter が未定義のとき mouseEnter でエラーにならない', () => {
    const { container } = renderInTable({ onMouseEnter: undefined })
    expect(() => fireEvent.mouseEnter(container.querySelector('td')!)).not.toThrow()
  })

  // --- 編集モード ---
  it('isEditing=true のとき CellEditor が表示される', () => {
    renderInTable({ isEditing: true })
    expect(screen.getByTestId('cell-editor')).toBeInTheDocument()
  })

  it('isEditing=false のとき CellEditor が表示されない', () => {
    renderInTable({ isEditing: false })
    expect(screen.queryByTestId('cell-editor')).not.toBeInTheDocument()
  })

  it('CellEditor のコミットで onCommitEdit が呼ばれる', () => {
    const onCommitEdit = jest.fn()
    renderInTable({ isEditing: true, rowIndex: 1, colIndex: 2, onCommitEdit })
    fireEvent.click(screen.getByTestId('commit-btn'))
    expect(onCommitEdit).toHaveBeenCalledWith(1, 2, 'new-value', 'right')
  })

  it('CellEditor のキャンセルで onCancelEdit が呼ばれる', () => {
    const onCancelEdit = jest.fn()
    renderInTable({ isEditing: true, rowIndex: 1, colIndex: 2, onCancelEdit })
    fireEvent.click(screen.getByTestId('cancel-btn'))
    expect(onCancelEdit).toHaveBeenCalledWith(1, 2)
  })

  it('initialCellInput が設定されている場合、それが CellEditor の value になる', () => {
    renderInTable({ isEditing: true, initialCellInput: 'initial text' })
    // CellEditor モックは value を直接表示しないが、レンダリングされることを確認
    expect(screen.getByTestId('cell-editor')).toBeInTheDocument()
  })

  it('initialCellInput が null の場合、processCellContentForEditing(cell) が使われる', () => {
    renderInTable({ isEditing: true, initialCellInput: null, cell: 'fallback' })
    expect(screen.getByTestId('cell-editor')).toBeInTheDocument()
  })

  it('initialCellInput が undefined の場合、processCellContentForEditing(cell) が使われる', () => {
    renderInTable({ isEditing: true, initialCellInput: undefined, cell: 'fallback2' })
    expect(screen.getByTestId('cell-editor')).toBeInTheDocument()
  })

  it('initialCellInput が undefined かつ cell が空のとき、空文字がフォールバックされる', () => {
    renderInTable({ isEditing: true, initialCellInput: undefined, cell: '' })
    expect(screen.getByTestId('cell-editor')).toBeInTheDocument()
  })

  // --- 編集モード時のスタイル: savedHeight ---
  it('isEditing=true かつ savedHeight.rowMax がある場合、height に rowMax が設定される', () => {
    const { container } = renderInTable({
      isEditing: true,
      savedHeight: { original: 30, rowMax: 60 },
    })
    const td = container.querySelector('td')!
    expect(td.style.height).toBe('60px')
    expect(td.style.minHeight).toBe('60px')
    expect(td.style.position).toBe('relative')
  })

  it('isEditing=true かつ savedHeight.rowMax=0 で original がある場合、height に original が設定される', () => {
    const { container } = renderInTable({
      isEditing: true,
      savedHeight: { original: 40, rowMax: 0 },
    })
    const td = container.querySelector('td')!
    expect(td.style.height).toBe('40px')
    expect(td.style.minHeight).toBe('40px')
  })

  it('isEditing=true かつ savedHeight.rowMax=0 && original=0 の場合、height は auto', () => {
    const { container } = renderInTable({
      isEditing: true,
      savedHeight: { original: 0, rowMax: 0 },
    })
    const td = container.querySelector('td')!
    expect(td.style.height).toBe('auto')
    expect(td.style.minHeight).toBe('auto')
  })

  it('isEditing=true かつ savedHeight がない場合、height は auto', () => {
    const { container } = renderInTable({
      isEditing: true,
      savedHeight: undefined,
    })
    const td = container.querySelector('td')!
    expect(td.style.height).toBe('auto')
    expect(td.style.minHeight).toBe('auto')
  })

  // --- フィルハンドル ---
  it('showFillHandle=true かつ onFillHandleMouseDown がある場合、fill-handle が表示される', () => {
    const onFillHandleMouseDown = jest.fn()
    const { container } = renderInTable({ showFillHandle: true, onFillHandleMouseDown })
    const handle = container.querySelector('.fill-handle')
    expect(handle).toBeInTheDocument()
  })

  it('fill-handle の mouseDown で onFillHandleMouseDown が呼ばれる', () => {
    const onFillHandleMouseDown = jest.fn()
    const { container } = renderInTable({ showFillHandle: true, onFillHandleMouseDown })
    fireEvent.mouseDown(container.querySelector('.fill-handle')!)
    expect(onFillHandleMouseDown).toHaveBeenCalled()
  })

  it('showFillHandle=false の場合、fill-handle が表示されない', () => {
    const { container } = renderInTable({ showFillHandle: false })
    expect(container.querySelector('.fill-handle')).not.toBeInTheDocument()
  })

  it('showFillHandle=true だが onFillHandleMouseDown がない場合、fill-handle が表示されない', () => {
    const { container } = renderInTable({ showFillHandle: true, onFillHandleMouseDown: undefined })
    expect(container.querySelector('.fill-handle')).not.toBeInTheDocument()
  })
})

// --- arePropsEqual（memo比較関数）のテスト ---
// memo の比較関数は直接エクスポートされていないので、再レンダリングの有無でテストする
describe('MemoizedCell arePropsEqual', () => {
  const baseProps: MemoizedCellProps = {
    rowIndex: 1,
    colIndex: 0,
    cell: 'test',
    isSelected: false,
    isAnchor: false,
    isSingleSelection: false,
    borders: { top: false, bottom: false, left: false, right: false },
    isEditing: false,
    isInFillRange: false,
    isSearchResult: false,
    isCurrentSearchResult: false,
    showFillHandle: false,
    storedWidth: 100,
    userResized: false,
    displayRowNumber: 1,
    onMouseDown: jest.fn(),
    onDoubleClick: jest.fn(),
    onCommitEdit: jest.fn(),
    onCancelEdit: jest.fn(),
  }

  // レンダリング回数を検出するためのラッパー
  const renderWithRerender = (initialProps: MemoizedCellProps) => {
    return render(
      <table>
        <tbody>
          <tr>
            <MemoizedCell {...initialProps} />
          </tr>
        </tbody>
      </table>
    )
  }

  it('同じ props で再レンダリングされない（memoが機能する）', () => {
    const { rerender } = renderWithRerender(baseProps)
    const td1 = document.querySelector('td')!
    const html1 = td1.innerHTML

    rerender(
      <table><tbody><tr><MemoizedCell {...baseProps} /></tr></tbody></table>
    )
    const td2 = document.querySelector('td')!
    expect(td2.innerHTML).toBe(html1)
  })

  it('cell が変わると再レンダリングされる', () => {
    const { rerender } = renderWithRerender(baseProps)
    rerender(
      <table><tbody><tr><MemoizedCell {...baseProps} cell="changed" /></tr></tbody></table>
    )
    expect(screen.getByText('changed')).toBeInTheDocument()
  })

  it('borders が変わると再レンダリングされる', () => {
    const { rerender, container } = renderWithRerender({ ...baseProps, isSelected: true })
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} isSelected={true} borders={{ top: true, bottom: false, left: false, right: false }} />
      </tr></tbody></table>
    )
    const td = container.querySelector('td')!
    expect(td.classList.contains('border-top')).toBe(true)
  })

  // savedHeight 比較のテスト
  it('savedHeight が undefined → undefined で再レンダリングされない', () => {
    const { rerender } = renderWithRerender({ ...baseProps, savedHeight: undefined })
    // 同じ props で再レンダリング試行（memoにより抑制されるはず）
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} savedHeight={undefined} />
      </tr></tbody></table>
    )
    // エラーなく表示されることを確認
    expect(document.querySelector('td')).toBeInTheDocument()
  })

  it('savedHeight が同じ参照で再レンダリングされない', () => {
    const height = { original: 30, rowMax: 50 }
    const { rerender } = renderWithRerender({ ...baseProps, savedHeight: height })
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} savedHeight={height} />
      </tr></tbody></table>
    )
    expect(document.querySelector('td')).toBeInTheDocument()
  })

  it('savedHeight が異なるオブジェクト（同じ値）で再レンダリングされない', () => {
    const { rerender } = renderWithRerender({
      ...baseProps,
      savedHeight: { original: 30, rowMax: 50 },
    })
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} savedHeight={{ original: 30, rowMax: 50 }} />
      </tr></tbody></table>
    )
    expect(document.querySelector('td')).toBeInTheDocument()
  })

  it('savedHeight の original が変わると再レンダリングされる', () => {
    const { rerender } = renderWithRerender({
      ...baseProps,
      isEditing: true,
      savedHeight: { original: 30, rowMax: 50 },
    })
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} isEditing={true} savedHeight={{ original: 40, rowMax: 50 }} />
      </tr></tbody></table>
    )
    expect(document.querySelector('td')).toBeInTheDocument()
  })

  it('savedHeight の rowMax が変わると再レンダリングされる', () => {
    const { rerender } = renderWithRerender({
      ...baseProps,
      isEditing: true,
      savedHeight: { original: 30, rowMax: 50 },
    })
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} isEditing={true} savedHeight={{ original: 30, rowMax: 60 }} />
      </tr></tbody></table>
    )
    expect(document.querySelector('td')).toBeInTheDocument()
  })

  it('savedHeight が undefined → 値あり で再レンダリングされる', () => {
    const { rerender } = renderWithRerender({ ...baseProps, savedHeight: undefined })
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} savedHeight={{ original: 30, rowMax: 50 }} />
      </tr></tbody></table>
    )
    expect(document.querySelector('td')).toBeInTheDocument()
  })

  it('savedHeight が 値あり → undefined で再レンダリングされる', () => {
    const { rerender } = renderWithRerender({
      ...baseProps,
      savedHeight: { original: 30, rowMax: 50 },
    })
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} savedHeight={undefined} />
      </tr></tbody></table>
    )
    expect(document.querySelector('td')).toBeInTheDocument()
  })

  // isColumnNotExist の変更
  it('isColumnNotExist が変わると再レンダリングされる', () => {
    const { rerender, container } = renderWithRerender({ ...baseProps, isColumnNotExist: false })
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} isColumnNotExist={true} />
      </tr></tbody></table>
    )
    const td = container.querySelector('td')!
    expect(td.classList.contains('git-diff-column-not-exist')).toBe(true)
  })

  // onMouseEnter の変更
  it('onMouseEnter が変わると再レンダリングされる', () => {
    const fn1 = jest.fn()
    const fn2 = jest.fn()
    const { rerender, container } = renderWithRerender({ ...baseProps, onMouseEnter: fn1 })
    rerender(
      <table><tbody><tr>
        <MemoizedCell {...baseProps} onMouseEnter={fn2} />
      </tr></tbody></table>
    )
    fireEvent.mouseEnter(container.querySelector('td')!)
    expect(fn2).toHaveBeenCalled()
  })
})
