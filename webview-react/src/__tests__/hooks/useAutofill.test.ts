/**
 * useAutofill.test.ts
 * useAutofillフックのテスト
 * ドラッグ開始・移動・終了、オートフィル実行（縦・横方向）を網羅
 */
import { renderHook, act } from '@testing-library/react'
import { useAutofill } from '../../hooks/useAutofill'
import { SelectionRange } from '../../types'

// autofillPatterns をモック
jest.mock('../../utils/autofillPatterns', () => ({
  detectPattern: jest.fn(() => 'copy'),
  generateNextValue: jest.fn((_pattern: string, sourceValue: string, _step: number) => sourceValue + '_filled'),
}))

const createProps = (overrides?: Partial<Parameters<typeof useAutofill>[0]>) => ({
  selectionRange: {
    start: { row: 0, col: 0 },
    end: { row: 1, col: 0 },
  } as SelectionRange | null,
  onUpdateCells: jest.fn(),
  getCellValue: jest.fn((row: number, col: number) => `r${row}c${col}`),
  onFillComplete: jest.fn(),
  ...overrides,
})

// elementFromPoint をモックするヘルパー
let mockElementFromPoint: jest.Mock
const originalElementFromPoint = document.elementFromPoint

beforeEach(() => {
  mockElementFromPoint = jest.fn().mockReturnValue(null)
  document.elementFromPoint = mockElementFromPoint
})

afterEach(() => {
  document.elementFromPoint = originalElementFromPoint
  jest.restoreAllMocks()
})

// DOM にセルを追加するヘルパー
function createCellElement(row: number, col: number): HTMLElement {
  const td = document.createElement('td')
  td.setAttribute('data-row', String(row))
  td.setAttribute('data-col', String(col))
  document.body.appendChild(td)
  return td
}

function startDrag(result: { current: ReturnType<typeof useAutofill> }) {
  act(() => {
    result.current.handleFillHandleMouseDown({
      preventDefault: jest.fn(),
      stopPropagation: jest.fn(),
    } as unknown as React.MouseEvent)
  })
}

function dispatchMouseMove(x: number, y: number) {
  act(() => {
    document.dispatchEvent(new MouseEvent('mousemove', {
      clientX: x, clientY: y, bubbles: true,
    }))
  })
}

function dispatchMouseUp() {
  act(() => {
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  })
}

describe('useAutofill', () => {
  describe('初期状態', () => {
    it('isDragging=false, fillRange=null', () => {
      const { result } = renderHook(() => useAutofill(createProps()))
      expect(result.current.isDragging).toBe(false)
      expect(result.current.fillRange).toBeNull()
    })
  })

  describe('handleFillHandleMouseDown', () => {
    it('selectionRange がある場合、ドラッグ開始', () => {
      const { result } = renderHook(() => useAutofill(createProps()))
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleFillHandleMouseDown(mockEvent)
      })

      expect(result.current.isDragging).toBe(true)
      expect(result.current.fillRange).not.toBeNull()
      expect(mockEvent.preventDefault).toHaveBeenCalled()
      expect(mockEvent.stopPropagation).toHaveBeenCalled()
    })

    it('selectionRange がない場合は何もしない', () => {
      const { result } = renderHook(() => useAutofill(createProps({ selectionRange: null })))
      const mockEvent = {
        preventDefault: jest.fn(),
        stopPropagation: jest.fn(),
      } as unknown as React.MouseEvent

      act(() => {
        result.current.handleFillHandleMouseDown(mockEvent)
      })

      expect(result.current.isDragging).toBe(false)
    })
  })

  describe('ドラッグ中のマウス移動', () => {
    it('セル上でマウスを動かすと fillRange が更新される', () => {
      const { result } = renderHook(() => useAutofill(createProps()))
      startDrag(result)

      const cell = createCellElement(3, 0)
      mockElementFromPoint.mockReturnValue(cell)

      dispatchMouseMove(100, 200)

      expect(result.current.fillRange).not.toBeNull()
      expect(result.current.fillRange!.end.row).toBe(3)

      document.body.removeChild(cell)
    })

    it('セルがない場所でマウスを動かしても無視', () => {
      const { result } = renderHook(() => useAutofill(createProps()))
      startDrag(result)

      mockElementFromPoint.mockReturnValue(null)
      dispatchMouseMove(100, 200)

      expect(result.current.isDragging).toBe(true)
    })

    it('[data-row][data-col] を持たない要素の場合は無視', () => {
      const { result } = renderHook(() => useAutofill(createProps()))
      startDrag(result)

      const div = document.createElement('div')
      document.body.appendChild(div)
      mockElementFromPoint.mockReturnValue(div)

      dispatchMouseMove(100, 200)

      expect(result.current.isDragging).toBe(true)
      document.body.removeChild(div)
    })

    it('data-row/data-col が空でも 0 として処理される', () => {
      const { result } = renderHook(() => useAutofill(createProps()))
      startDrag(result)

      // data-row, data-col を空文字にしたセル
      const cell = document.createElement('td')
      cell.setAttribute('data-row', '')
      cell.setAttribute('data-col', '')
      document.body.appendChild(cell)
      mockElementFromPoint.mockReturnValue(cell)

      dispatchMouseMove(100, 200)

      expect(result.current.fillRange).not.toBeNull()
      document.body.removeChild(cell)
    })

    it('横方向のドラッグの場合 col が変わる', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } },
      })
      const { result } = renderHook(() => useAutofill(props))
      startDrag(result)

      const cell = createCellElement(0, 3)
      mockElementFromPoint.mockReturnValue(cell)

      dispatchMouseMove(300, 50)

      expect(result.current.fillRange!.end.col).toBe(3)
      document.body.removeChild(cell)
    })

    it('ドラッグ中でない場合は mousemove を無視', () => {
      renderHook(() => useAutofill(createProps()))
      // ドラッグ開始せずに mousemove を発火しても問題なし
      dispatchMouseMove(100, 200)
    })
  })

  describe('ドラッグ終了 (mouseup)', () => {
    it('下方向にドラッグ終了するとオートフィルが実行される', () => {
      const props = createProps()
      const { result } = renderHook(() => useAutofill(props))
      startDrag(result)

      const cell = createCellElement(3, 0)
      mockElementFromPoint.mockReturnValue(cell)

      dispatchMouseMove(100, 300)
      dispatchMouseUp()

      expect(result.current.isDragging).toBe(false)
      expect(result.current.fillRange).toBeNull()
      expect(props.onUpdateCells).toHaveBeenCalled()
      expect(props.onFillComplete).toHaveBeenCalled()

      document.body.removeChild(cell)
    })

    it('ドラッグ開始なしで mouseup しても何もしない', () => {
      const props = createProps()
      renderHook(() => useAutofill(props))

      dispatchMouseUp()
      expect(props.onUpdateCells).not.toHaveBeenCalled()
    })

    it('isDragging=true でも selectionRange が null に変わった場合は早期リターン', () => {
      // selectionRange を変更できるようにする
      let selRange: SelectionRange | null = {
        start: { row: 0, col: 0 }, end: { row: 1, col: 0 }
      }
      const props = createProps({ selectionRange: selRange })
      const { result, rerender } = renderHook(
        (p: typeof props) => useAutofill(p),
        { initialProps: props }
      )
      startDrag(result)
      expect(result.current.isDragging).toBe(true)

      // selectionRange を null に変更して rerender
      selRange = null
      rerender({ ...props, selectionRange: null })

      // mouseup → 早期リターン（行82-84を通る）
      dispatchMouseUp()
      expect(result.current.isDragging).toBe(false)
      expect(result.current.fillRange).toBeNull()
      expect(props.onUpdateCells).not.toHaveBeenCalled()
    })

    it('onFillComplete がない場合もエラーなし', () => {
      const props = createProps({ onFillComplete: undefined })
      const { result } = renderHook(() => useAutofill(props))
      startDrag(result)

      const cell = createCellElement(3, 0)
      mockElementFromPoint.mockReturnValue(cell)

      dispatchMouseMove(100, 300)
      expect(() => {
        dispatchMouseUp()
      }).not.toThrow()

      document.body.removeChild(cell)
    })
  })

  describe('上方向のオートフィル', () => {
    it('上方向にドラッグするとオートフィルが実行される', () => {
      const props = createProps({
        selectionRange: { start: { row: 2, col: 0 }, end: { row: 3, col: 0 } },
      })
      const { result } = renderHook(() => useAutofill(props))
      startDrag(result)

      const cell = createCellElement(0, 0)
      mockElementFromPoint.mockReturnValue(cell)

      dispatchMouseMove(100, 10)
      dispatchMouseUp()

      expect(props.onUpdateCells).toHaveBeenCalled()
      document.body.removeChild(cell)
    })
  })

  describe('横方向のオートフィル', () => {
    it('右方向にドラッグするとオートフィルが実行される', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 1 } },
      })
      const { result } = renderHook(() => useAutofill(props))
      startDrag(result)

      const cell = createCellElement(0, 4)
      mockElementFromPoint.mockReturnValue(cell)

      dispatchMouseMove(400, 50)
      dispatchMouseUp()

      expect(props.onUpdateCells).toHaveBeenCalled()
      document.body.removeChild(cell)
    })

    it('左方向にドラッグするとオートフィルが実行される', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 3 }, end: { row: 0, col: 4 } },
      })
      const { result } = renderHook(() => useAutofill(props))
      startDrag(result)

      const cell = createCellElement(0, 0)
      mockElementFromPoint.mockReturnValue(cell)

      dispatchMouseMove(10, 50)
      dispatchMouseUp()

      expect(props.onUpdateCells).toHaveBeenCalled()
      document.body.removeChild(cell)
    })
  })

  describe('更新なしのフィル', () => {
    it('ソース範囲とターゲット範囲が同じなら更新しない', () => {
      const props = createProps({
        selectionRange: { start: { row: 0, col: 0 }, end: { row: 1, col: 0 } },
      })
      const { result } = renderHook(() => useAutofill(props))
      startDrag(result)

      const cell = createCellElement(1, 0)
      mockElementFromPoint.mockReturnValue(cell)

      dispatchMouseMove(100, 100)
      dispatchMouseUp()

      expect(props.onUpdateCells).not.toHaveBeenCalled()
      document.body.removeChild(cell)
    })
  })

  describe('クリーンアップ', () => {
    it('アンマウント時にイベントリスナーが解除される', () => {
      const { result, unmount } = renderHook(() => useAutofill(createProps()))
      startDrag(result)

      const removeListenerSpy = jest.spyOn(document, 'removeEventListener')
      unmount()

      expect(removeListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
      expect(removeListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))
      removeListenerSpy.mockRestore()
    })
  })
})
