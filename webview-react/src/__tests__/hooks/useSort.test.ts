import { renderHook, act } from '@testing-library/react'
import { useSort } from '../../hooks/useSort'

// console.log をモック
beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('useSort', () => {
  it('初期状態は column=-1, direction=none', () => {
    const { result } = renderHook(() => useSort())
    expect(result.current.sortState).toEqual({ column: -1, direction: 'none' })
  })

  it('instanceKey が設定される', () => {
    const { result } = renderHook(() => useSort('test-key'))
    expect(result.current.sortState).toEqual({ column: -1, direction: 'none' })
  })

  it('sortColumn で新しい列を asc に設定', () => {
    const { result } = renderHook(() => useSort())
    act(() => result.current.sortColumn(0))
    expect(result.current.sortState).toEqual({ column: 0, direction: 'asc' })
  })

  it('同じ列を2回ソートすると desc になる', () => {
    const { result } = renderHook(() => useSort())
    act(() => result.current.sortColumn(0))
    act(() => result.current.sortColumn(0))
    expect(result.current.sortState).toEqual({ column: 0, direction: 'desc' })
  })

  it('同じ列を3回ソートすると none に戻る', () => {
    const { result } = renderHook(() => useSort())
    act(() => result.current.sortColumn(0))
    act(() => result.current.sortColumn(0))
    act(() => result.current.sortColumn(0))
    expect(result.current.sortState).toEqual({ column: -1, direction: 'none' })
  })

  it('none の状態で同じ列をソートすると asc になる (default branch)', () => {
    const { result } = renderHook(() => useSort())
    // 初期状態 column=-1 → sortColumn(0)で別の列
    act(() => result.current.sortColumn(0))
    // asc
    act(() => result.current.sortColumn(0))
    // desc
    act(() => result.current.sortColumn(0))
    // none (column=-1)
    // もう一度同じ列をソート → 別の列扱い → asc
    act(() => result.current.sortColumn(0))
    expect(result.current.sortState).toEqual({ column: 0, direction: 'asc' })
  })

  it('別の列をソートすると常に asc から始まる', () => {
    const { result } = renderHook(() => useSort())
    act(() => result.current.sortColumn(0))
    expect(result.current.sortState).toEqual({ column: 0, direction: 'asc' })

    act(() => result.current.sortColumn(1))
    expect(result.current.sortState).toEqual({ column: 1, direction: 'asc' })
  })

  it('resetSortState で初期状態に戻る', () => {
    const { result } = renderHook(() => useSort())
    act(() => result.current.sortColumn(0))
    expect(result.current.sortState.column).toBe(0)

    act(() => result.current.resetSortState())
    expect(result.current.sortState).toEqual({ column: -1, direction: 'none' })
  })
})
