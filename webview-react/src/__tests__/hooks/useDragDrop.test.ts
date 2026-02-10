/**
 * useDragDrop フックのユニットテスト
 * ドラッグ＆ドロップによる行・列の移動ロジックを検証する
 */
import { renderHook, act } from '@testing-library/react'
import { useDragDrop } from '../../hooks/useDragDrop'

// console をモック
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
  // DOM をクリーンアップ
  document.body.innerHTML = ''
})

afterEach(() => {
  jest.restoreAllMocks()
})

// ヘルパー: 最小限の React.DragEvent モック
function createDragEvent(overrides: Record<string, unknown> = {}): React.DragEvent {
  const base = {
    clientX: 0,
    clientY: 0,
    preventDefault: jest.fn(),
    dataTransfer: {
      effectAllowed: '',
      dropEffect: '',
      setData: jest.fn(),
      getData: jest.fn(() => ''),
    },
    currentTarget: document.createElement('div'),
    ...overrides,
  }
  return base as unknown as React.DragEvent
}

// ヘルパー: .table-container を DOM に追加
function setupTableContainer() {
  const container = document.createElement('div')
  container.className = 'table-container'
  // getBoundingClientRect のモック
  container.getBoundingClientRect = () => ({
    top: 0, left: 0, right: 500, bottom: 300,
    width: 500, height: 300, x: 0, y: 0, toJSON: () => {},
  })
  Object.defineProperty(container, 'scrollHeight', { value: 300 })
  Object.defineProperty(container, 'scrollWidth', { value: 500 })
  Object.defineProperty(container, 'scrollLeft', { value: 0 })
  Object.defineProperty(container, 'scrollTop', { value: 0 })
  document.body.appendChild(container)
  return container
}

// ヘルパー: ターゲット要素を作成
function createTargetElement(rect: Partial<DOMRect> = {}) {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({
    top: 50, left: 50, right: 150, bottom: 100,
    width: 100, height: 50, x: 50, y: 50, toJSON: () => {},
    ...rect,
  })
  return el
}

describe('useDragDrop', () => {
  const defaultCallbacks = {
    onMoveRow: jest.fn(),
    onMoveColumn: jest.fn(),
  }

  beforeEach(() => {
    defaultCallbacks.onMoveRow.mockClear()
    defaultCallbacks.onMoveColumn.mockClear()
  })

  // --- 初期状態 ---
  it('初期状態が正しい', () => {
    const { result } = renderHook(() => useDragDrop(defaultCallbacks))
    expect(result.current.dragState).toEqual({
      isDragging: false,
      dragType: null,
      dragIndex: -1,
      selectedIndices: [],
      dropIndex: -1,
      startX: 0,
      startY: 0,
    })
  })

  // --- getDragProps / getDropProps ---
  it('getDragProps が正しいプロパティを返す', () => {
    const { result } = renderHook(() => useDragDrop(defaultCallbacks))
    const props = result.current.getDragProps('row', 0)
    expect(props.draggable).toBe(true)
    expect(typeof props.onDragStart).toBe('function')
    expect(typeof props.onDragEnd).toBe('function')
  })

  it('getDropProps が正しいプロパティを返す', () => {
    const { result } = renderHook(() => useDragDrop(defaultCallbacks))
    const props = result.current.getDropProps('row', 0)
    expect(typeof props.onDragOver).toBe('function')
    expect(typeof props.onDragEnter).toBe('function')
    expect(typeof props.onDragLeave).toBe('function')
    expect(typeof props.onDrop).toBe('function')
  })

  it('getDragProps に selectedIndices を渡せる', () => {
    const { result } = renderHook(() => useDragDrop(defaultCallbacks))
    const props = result.current.getDragProps('column', 1, [0, 1, 2])
    expect(props.draggable).toBe(true)
  })

  it('getDragProps の onDragStart ラムダを呼び出すとドラッグが開始される', () => {
    const { result } = renderHook(() => useDragDrop(defaultCallbacks))
    const props = result.current.getDragProps('row', 2, [1, 2])
    const event = createDragEvent({ clientX: 10, clientY: 20 })

    act(() => {
      props.onDragStart(event)
    })

    expect(result.current.dragState.isDragging).toBe(true)
    expect(result.current.dragState.dragIndex).toBe(2)
  })

  it('getDragProps の onDragEnd ラムダを呼び出すとドラッグが終了する', () => {
    const { result } = renderHook(() => useDragDrop(defaultCallbacks))
    const startEvent = createDragEvent()
    act(() => {
      result.current.handleDragStart(startEvent, 'row', 0)
    })

    const props = result.current.getDragProps('row', 0)
    const endEvent = createDragEvent()
    act(() => {
      props.onDragEnd(endEvent)
    })

    expect(result.current.dragState.isDragging).toBe(false)
  })

  it('getDropProps のラムダを呼び出すと各ハンドラが動作する', () => {
    const { result } = renderHook(() => useDragDrop(defaultCallbacks))
    const startEvent = createDragEvent()
    act(() => {
      result.current.handleDragStart(startEvent, 'row', 0)
    })

    const props = result.current.getDropProps('row', 2)

    // onDragOver ラムダ
    const overEvent = createDragEvent()
    act(() => {
      props.onDragOver(overEvent)
    })
    expect(overEvent.preventDefault).toHaveBeenCalled()

    // onDragEnter ラムダ
    const target = document.createElement('div')
    const enterEvent = createDragEvent({ currentTarget: target })
    act(() => {
      props.onDragEnter(enterEvent)
    })
    expect(target.classList.contains('drag-over')).toBe(true)

    // onDrop ラムダ
    const dropEvent = createDragEvent({
      currentTarget: target,
      dataTransfer: {
        effectAllowed: '',
        dropEffect: '',
        setData: jest.fn(),
        getData: jest.fn(() => 'row:0'),
      },
    })
    act(() => {
      props.onDrop(dropEvent)
    })
    expect(defaultCallbacks.onMoveRow).toHaveBeenCalledWith([0], 3)
  })

  // --- handleDragStart ---
  describe('handleDragStart', () => {
    it('ドラッグ状態を設定する', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const event = createDragEvent({ clientX: 100, clientY: 200 })

      act(() => {
        result.current.handleDragStart(event, 'row', 2)
      })

      expect(result.current.dragState.isDragging).toBe(true)
      expect(result.current.dragState.dragType).toBe('row')
      expect(result.current.dragState.dragIndex).toBe(2)
      expect(result.current.dragState.selectedIndices).toEqual([2])
    })

    it('無効なインデックス（負数）の場合は早期リターン', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const event = createDragEvent()

      act(() => {
        result.current.handleDragStart(event, 'row', -1)
      })

      expect(result.current.dragState.isDragging).toBe(false)
      expect(console.error).toHaveBeenCalled()
    })

    it('selectedIndices にドラッグ対象が含まれる場合、selectedIndices を使う', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const event = createDragEvent({ clientX: 10, clientY: 20 })

      act(() => {
        result.current.handleDragStart(event, 'column', 1, [2, 1, 3, 1])
      })

      // 重複排除 & ソート
      expect(result.current.dragState.selectedIndices).toEqual([1, 2, 3])
    })

    it('selectedIndices にドラッグ対象が含まれない場合、[index] を使う', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const event = createDragEvent()

      act(() => {
        result.current.handleDragStart(event, 'row', 5, [0, 1, 2])
      })

      expect(result.current.dragState.selectedIndices).toEqual([5])
    })

    it('dataTransfer にデータを設定する', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const event = createDragEvent()

      act(() => {
        result.current.handleDragStart(event, 'column', 3)
      })

      expect(event.dataTransfer!.effectAllowed).toBe('move')
      expect(event.dataTransfer!.setData).toHaveBeenCalledWith('text/plain', 'column:3')
    })

    it('currentTarget の opacity を 0.5 に設定する', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const target = document.createElement('div')
      const event = createDragEvent({ currentTarget: target })

      act(() => {
        result.current.handleDragStart(event, 'row', 0)
      })

      expect(target.style.opacity).toBe('0.5')
    })

    it('dataTransfer が null の場合もエラーにならない', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const event = createDragEvent({ dataTransfer: null })

      act(() => {
        result.current.handleDragStart(event, 'row', 0)
      })

      expect(result.current.dragState.isDragging).toBe(true)
    })

    it('currentTarget が HTMLElement でない場合も opacity 設定をスキップする', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const event = createDragEvent({ currentTarget: null })

      act(() => {
        result.current.handleDragStart(event, 'row', 0)
      })

      expect(result.current.dragState.isDragging).toBe(true)
    })
  })

  // --- handleDragOver ---
  describe('handleDragOver', () => {
    it('dragType が一致する場合に preventDefault と dropEffect を設定', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const overEvent = createDragEvent()
      act(() => {
        result.current.handleDragOver(overEvent, 'row', 2)
      })

      expect(overEvent.preventDefault).toHaveBeenCalled()
      expect(overEvent.dataTransfer!.dropEffect).toBe('move')
    })

    it('dragType が一致しない場合は何もしない', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const overEvent = createDragEvent()
      act(() => {
        result.current.handleDragOver(overEvent, 'column', 2)
      })

      expect(overEvent.preventDefault).not.toHaveBeenCalled()
    })

    it('ドロップインジケーターを表示する（column 右移動）', () => {
      setupTableContainer()
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'column', 0)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'column', 2)
      })

      // ドロップインジケーターが作成されていること
      expect(document.querySelector('.drop-indicator')).not.toBeNull()
    })

    it('ドロップインジケーターを表示する（column 左移動）', () => {
      setupTableContainer()
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'column', 3)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'column', 1)
      })

      expect(document.querySelector('.drop-indicator')).not.toBeNull()
    })

    it('ドロップインジケーターを表示する（row 下移動）', () => {
      setupTableContainer()
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'row', 2)
      })

      expect(document.querySelector('.drop-indicator')).not.toBeNull()
    })

    it('ドロップインジケーターを表示する（row 上移動）', () => {
      setupTableContainer()
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 3)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'row', 1)
      })

      expect(document.querySelector('.drop-indicator')).not.toBeNull()
    })

    it('同じインデックスの場合はドロップインジケーターを削除', () => {
      setupTableContainer()
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 2)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'row', 2)
      })

      expect(document.querySelector('.drop-indicator')).toBeNull()
    })
  })

  // --- handleDragEnter ---
  describe('handleDragEnter', () => {
    it('dragType が一致する場合に drag-over クラスを追加', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const target = document.createElement('div')
      const enterEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragEnter(enterEvent, 'row', 1)
      })

      expect(enterEvent.preventDefault).toHaveBeenCalled()
      expect(target.classList.contains('drag-over')).toBe(true)
    })

    it('dragType が一致しない場合は何もしない', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const target = document.createElement('div')
      const enterEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragEnter(enterEvent, 'column', 1)
      })

      expect(enterEvent.preventDefault).not.toHaveBeenCalled()
      expect(target.classList.contains('drag-over')).toBe(false)
    })

    it('currentTarget が HTMLElement でない場合もエラーにならない', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const enterEvent = createDragEvent({ currentTarget: null })
      act(() => {
        result.current.handleDragEnter(enterEvent, 'row', 1)
      })

      expect(enterEvent.preventDefault).toHaveBeenCalled()
    })
  })

  // --- handleDragLeave ---
  describe('handleDragLeave', () => {
    it('currentTarget から drag-over クラスを削除', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const target = document.createElement('div')
      target.classList.add('drag-over')

      const leaveEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragLeave(leaveEvent)
      })

      expect(target.classList.contains('drag-over')).toBe(false)
    })

    it('currentTarget が HTMLElement でない場合もエラーにならない', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const leaveEvent = createDragEvent({ currentTarget: null })

      act(() => {
        result.current.handleDragLeave(leaveEvent)
      })
      // エラーが発生しないことを確認
    })
  })

  // --- handleDrop ---
  describe('handleDrop', () => {
    it('行を下方向にドロップすると onMoveRow が呼ばれる', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 1)
      })

      const dropEvent = createDragEvent({
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => 'row:1'),
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'row', 3)
      })

      // index > maxSelected なので targetIndex = 3 + 1 = 4
      expect(defaultCallbacks.onMoveRow).toHaveBeenCalledWith([1], 4)
      expect(result.current.dragState.isDragging).toBe(false)
    })

    it('行を上方向にドロップすると onMoveRow が呼ばれる', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 3)
      })

      const dropEvent = createDragEvent({
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => 'row:3'),
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'row', 1)
      })

      // index <= maxSelected なので targetIndex = 1
      expect(defaultCallbacks.onMoveRow).toHaveBeenCalledWith([3], 1)
    })

    it('列を右方向にドロップすると onMoveColumn が呼ばれる', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'column', 0)
      })

      const dropEvent = createDragEvent({
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => 'column:0'),
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'column', 2)
      })

      // index > maxSelected なので targetIndex = 2 + 1 = 3
      expect(defaultCallbacks.onMoveColumn).toHaveBeenCalledWith([0], 3)
    })

    it('列を左方向にドロップすると onMoveColumn が呼ばれる', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'column', 3)
      })

      const dropEvent = createDragEvent({
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => 'column:3'),
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'column', 1)
      })

      expect(defaultCallbacks.onMoveColumn).toHaveBeenCalledWith([3], 1)
    })

    it('dragType が一致しない場合は何もしない', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const dropEvent = createDragEvent()
      act(() => {
        result.current.handleDrop(dropEvent, 'column', 2)
      })

      expect(defaultCallbacks.onMoveRow).not.toHaveBeenCalled()
      expect(defaultCallbacks.onMoveColumn).not.toHaveBeenCalled()
    })

    it('同じインデックスにドロップした場合は何もしない', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 2)
      })

      const dropEvent = createDragEvent({
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => 'row:2'),
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'row', 2)
      })

      expect(defaultCallbacks.onMoveRow).not.toHaveBeenCalled()
    })

    it('dataTransfer からドラッグ情報を取得するフォールバック（dragIndex=-1の場合）', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))

      // 直接 dragState を操作できないので、handleDragStart 後に handleDrop で
      // dataTransfer のフォールバックをテストする。
      // dragState.dragType='row' だが dragIndex=-1 を再現するために
      // dataTransfer に有効なデータを入れる
      const startEvent = createDragEvent()
      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const dropEvent = createDragEvent({
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => 'row:0'),
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'row', 2)
      })

      expect(defaultCallbacks.onMoveRow).toHaveBeenCalledWith([0], 3)
    })

    it('dataTransfer のタイプが一致しない場合は dragIndexFromDataTransfer が -1 のまま', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const dropEvent = createDragEvent({
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => 'column:0'), // タイプ不一致
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'row', 2)
      })

      expect(defaultCallbacks.onMoveRow).toHaveBeenCalledWith([0], 3)
    })

    it('dataTransfer が null の場合もエラーにならない', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const dropEvent = createDragEvent({ dataTransfer: null })
      act(() => {
        result.current.handleDrop(dropEvent, 'row', 2)
      })

      expect(defaultCallbacks.onMoveRow).toHaveBeenCalledWith([0], 3)
    })

    it('dataTransfer のデータが空文字列の場合', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const dropEvent = createDragEvent({
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => ''),
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'row', 2)
      })

      expect(defaultCallbacks.onMoveRow).toHaveBeenCalledWith([0], 3)
    })

    it('ドロップ後に drag-over クラスが削除される', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const target = document.createElement('div')
      target.classList.add('drag-over')
      const dropEvent = createDragEvent({
        currentTarget: target,
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => 'row:0'),
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'row', 2)
      })

      expect(target.classList.contains('drag-over')).toBe(false)
    })

    it('複数選択でのドロップ', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 1, [1, 2, 3])
      })

      const dropEvent = createDragEvent({
        dataTransfer: {
          effectAllowed: '',
          dropEffect: '',
          setData: jest.fn(),
          getData: jest.fn(() => 'row:1'),
        },
      })

      act(() => {
        result.current.handleDrop(dropEvent, 'row', 5)
      })

      // maxSelected=3, index=5 > 3 → targetIndex=6
      expect(defaultCallbacks.onMoveRow).toHaveBeenCalledWith([1, 2, 3], 6)
    })
  })

  // --- handleDragEnd ---
  describe('handleDragEnd', () => {
    it('ドラッグ状態をリセットし opacity を 1 に戻す', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const target = document.createElement('div')
      target.style.opacity = '0.5'

      const startEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const endEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragEnd(endEvent)
      })

      expect(target.style.opacity).toBe('1')
      expect(result.current.dragState.isDragging).toBe(false)
      expect(result.current.dragState.dragType).toBeNull()
    })

    it('すべての drag-over クラスを削除する', () => {
      const el1 = document.createElement('div')
      el1.classList.add('drag-over')
      document.body.appendChild(el1)
      const el2 = document.createElement('div')
      el2.classList.add('drag-over')
      document.body.appendChild(el2)

      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const endEvent = createDragEvent()

      act(() => {
        result.current.handleDragEnd(endEvent)
      })

      expect(el1.classList.contains('drag-over')).toBe(false)
      expect(el2.classList.contains('drag-over')).toBe(false)
    })

    it('ドロップインジケーターを削除する', () => {
      const indicator = document.createElement('div')
      indicator.className = 'drop-indicator'
      document.body.appendChild(indicator)

      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const endEvent = createDragEvent()

      act(() => {
        result.current.handleDragEnd(endEvent)
      })

      expect(document.querySelector('.drop-indicator')).toBeNull()
    })

    it('currentTarget が HTMLElement でない場合も正常動作', () => {
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const endEvent = createDragEvent({ currentTarget: null })

      act(() => {
        result.current.handleDragEnd(endEvent)
      })

      expect(result.current.dragState.isDragging).toBe(false)
    })
  })

  // --- createDropIndicator ---
  describe('createDropIndicator (showDropIndicator 経由)', () => {
    it('.table-container がない場合は早期リターン', () => {
      // table-container なし
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'row', 2)
      })

      // インジケーターは作成されない
      expect(document.querySelector('.drop-indicator')).toBeNull()
    })

    it('column before 位置のインジケーター', () => {
      setupTableContainer()
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'column', 3)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'column', 1)
      })

      const indicator = document.querySelector('.drop-indicator') as HTMLElement
      expect(indicator).not.toBeNull()
      expect(indicator.className).toContain('column')
      expect(indicator.style.width).toBe('4px')
    })

    it('column after 位置のインジケーター', () => {
      setupTableContainer()
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'column', 0)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'column', 3)
      })

      const indicator = document.querySelector('.drop-indicator') as HTMLElement
      expect(indicator).not.toBeNull()
    })

    it('row before 位置のインジケーター', () => {
      setupTableContainer()
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 5)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'row', 1)
      })

      const indicator = document.querySelector('.drop-indicator') as HTMLElement
      expect(indicator).not.toBeNull()
      expect(indicator.className).toContain('row')
      expect(indicator.style.height).toBe('4px')
    })

    it('row after 位置のインジケーター', () => {
      setupTableContainer()
      const { result } = renderHook(() => useDragDrop(defaultCallbacks))
      const startEvent = createDragEvent()

      act(() => {
        result.current.handleDragStart(startEvent, 'row', 0)
      })

      const target = createTargetElement()
      const overEvent = createDragEvent({ currentTarget: target })
      act(() => {
        result.current.handleDragOver(overEvent, 'row', 3)
      })

      const indicator = document.querySelector('.drop-indicator') as HTMLElement
      expect(indicator).not.toBeNull()
    })
  })

  // --- アンマウント時のクリーンアップ ---
  it('アンマウント時にドロップインジケーターを削除する', () => {
    const indicator = document.createElement('div')
    indicator.className = 'drop-indicator'
    document.body.appendChild(indicator)

    const { unmount } = renderHook(() => useDragDrop(defaultCallbacks))

    unmount()

    expect(document.querySelector('.drop-indicator')).toBeNull()
  })
})
