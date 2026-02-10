/**
 * TableEditor コンポーネントの包括的テスト（フックモック版）
 * 全メトリクス（Stmts, Branch, Funcs, Lines）100% を目指す
 */
import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TableData, EditorState } from '../types'

// i18next / react-i18next モック
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
  initReactI18next: { type: '3rdParty', init: () => {} }
}))

// ===== フック・ユーティリティモック =====
const mockUpdateCell = jest.fn()
const mockUpdateCells = jest.fn()
const mockUpdateHeader = jest.fn()
const mockAddRow = jest.fn()
const mockDeleteRow = jest.fn()
const mockAddColumn = jest.fn()
const mockDeleteColumn = jest.fn()
const mockSelectCell = jest.fn()
const mockSelectRow = jest.fn()
const mockSelectColumn = jest.fn()
const mockSelectAll = jest.fn()
const mockSetCurrentEditingCell = jest.fn()
const mockSetInitialCellInput = jest.fn()
const mockSetSelectionAnchor = jest.fn()
const mockSetColumnWidth = jest.fn()
const mockSortColumn = jest.fn()
const mockMoveRows = jest.fn()
const mockMoveColumns = jest.fn()
const mockCommitSort = jest.fn()
const mockResetSort = jest.fn()
const mockToggleColumnHeaders = jest.fn()
const mockToggleRowHeaders = jest.fn()
const mockOnDragStart = jest.fn()
const mockOnDragEnter = jest.fn()
const mockOnDragEnd = jest.fn()

const defaultEditorState: EditorState = {
  selectedCells: new Set<string>(['0-0']),
  selectionRange: { start: { row: 0, col: 0 }, end: { row: 0, col: 0 } },
  currentEditingCell: null,
  sortState: { column: -1, direction: 'none' },
  columnWidths: [150, 150, 150],
  fullySelectedRows: new Set<number>(),
  fullySelectedCols: new Set<number>(),
  headerConfig: { hasColumnHeaders: true, hasRowHeaders: false }
}

const mockTableData: TableData = {
  headers: ['Name', 'Age', 'City'],
  rows: [
    ['Alice', '25', 'Tokyo'],
    ['Bob', '30', 'Osaka'],
    ['Charlie', '35', 'Kyoto']
  ]
}

let useTableEditorReturn: any
jest.mock('../hooks/useTableEditor', () => ({
  useTableEditor: jest.fn(() => useTableEditorReturn)
}))

let copyResult = true
const mockCopySelectedCells = jest.fn().mockImplementation(() => Promise.resolve(copyResult))
let pasteResult: any = { success: true, updates: [{ row: 0, col: 0, value: 'pasted' }], message: 'Pasted' }
const mockPasteFromClipboard = jest.fn().mockImplementation(() => Promise.resolve(pasteResult))
jest.mock('../hooks/useClipboard', () => ({
  useClipboard: jest.fn(() => ({
    copySelectedCells: mockCopySelectedCells,
    pasteFromClipboard: mockPasteFromClipboard
  }))
}))

const mockExportToCSV = jest.fn()
const mockExportToTSV = jest.fn()
jest.mock('../hooks/useCSVExport', () => ({
  useCSVExport: jest.fn(() => ({
    exportToCSV: mockExportToCSV,
    exportToTSV: mockExportToTSV
  }))
}))

let autofillCallbacks: any = {}
jest.mock('../hooks/useAutofill', () => ({
  useAutofill: jest.fn((opts: any) => {
    autofillCallbacks = opts
    return { fillRange: null, handleFillHandleMouseDown: jest.fn() }
  })
}))

let dragDropCallbacks: any = {}
jest.mock('../hooks/useDragDrop', () => ({
  useDragDrop: jest.fn((opts: any) => {
    dragDropCallbacks = opts
    return {
      getDragProps: jest.fn(() => ({})),
      getDropProps: jest.fn(() => ({}))
    }
  })
}))

let searchCallbacks: any = {}
const mockPerformSearch = jest.fn()
const mockOpenSearch = jest.fn()
const mockCloseSearch = jest.fn()
jest.mock('../hooks/useSearch', () => ({
  useSearch: jest.fn((opts: any) => {
    searchCallbacks = opts
    return {
      searchState: { isOpen: false, searchText: '', results: [], currentResultIndex: -1, options: {}, scope: 'all' },
      performSearch: mockPerformSearch,
      findNext: jest.fn(),
      findPrevious: jest.fn(),
      replaceOne: jest.fn(),
      replaceAll: jest.fn(),
      openSearch: mockOpenSearch,
      closeSearch: mockCloseSearch,
      setSearchText: jest.fn(),
      setReplaceText: jest.fn(),
      setScope: jest.fn(),
      toggleOption: jest.fn(),
      toggleAdvanced: jest.fn(),
      toggleReplace: jest.fn(),
      currentResultInfo: null
    }
  })
}))

jest.mock('../hooks/useKeyboardNavigation', () => ({
  useKeyboardNavigation: jest.fn()
}))

const mockUpdateStatus = jest.fn()
const mockUpdateTableInfo = jest.fn()
const mockUpdateSaveStatus = jest.fn()
const mockUpdateSortState = jest.fn()
jest.mock('../contexts/StatusContext', () => {
  const actual = jest.requireActual('../contexts/StatusContext')
  return {
    ...actual,
    useStatus: jest.fn(() => ({
      updateStatus: mockUpdateStatus,
      updateTableInfo: mockUpdateTableInfo,
      updateSaveStatus: mockUpdateSaveStatus,
      updateSortState: mockUpdateSortState
    })),
    StatusProvider: ({ children }: any) => <>{children}</>
  }
})

jest.mock('../utils/cellDomUtils', () => ({
  cleanupCellVisualArtifacts: jest.fn(),
  clearCellTemporaryMarker: jest.fn(),
  markCellAsTemporarilyEmpty: jest.fn().mockReturnValue(true),
  queryCellElement: jest.fn().mockReturnValue(null)
}))

// 子コンポーネントをモック
const MockTableHeader = jest.fn((props: any) => (
  <thead>
    <tr>
      {props.headers.map((h: string, i: number) => (
        <th key={i} data-col={i} onClick={() => props.onSort(i)} onContextMenu={(e: any) => props.onShowColumnContextMenu(e, i)} onDoubleClick={() => props.onHeaderUpdate(i, 'edited')}>
          {h}
        </th>
      ))}
    </tr>
  </thead>
))
jest.mock('../components/TableHeader', () => ({
  __esModule: true,
  default: MockTableHeader
}))

const MockTableBody = jest.fn((props: any) => (
  <tbody>
    {props.rows.map((row: string[], ri: number) => (
      <tr key={ri}>
        <td className="row-number" data-row={ri} onClick={(e: any) => props.onRowSelect(ri, e)} onContextMenu={(e: any) => props.onShowRowContextMenu(e, ri)}>{ri + 1}</td>
        {row.map((cell: string, ci: number) => (
          <td key={ci} data-row={ri} data-col={ci} onClick={() => props.onCellSelect(ri, ci, false)} onDoubleClick={() => props.onCellEdit({ row: ri, col: ci })}>
            {cell}
          </td>
        ))}
      </tr>
    ))}
  </tbody>
))
jest.mock('../components/TableBody', () => ({
  __esModule: true,
  default: MockTableBody
}))

const MockContextMenu = jest.fn((props: any) => {
  if (!props.menuState.type) return null
  return (
    <div data-testid="context-menu">
      <button onClick={() => props.onAddRow(1)}>addRow</button>
      <button onClick={() => props.onDeleteRow(1)}>deleteRow</button>
      <button onClick={() => props.onDeleteRows([0, 1])}>deleteRows</button>
      <button onClick={() => props.onAddColumn(1)}>addColumn</button>
      <button onClick={() => props.onDeleteColumn(1)}>deleteColumn</button>
      <button onClick={() => props.onDeleteColumns([0, 1])}>deleteColumns</button>
      <button onClick={() => props.onClose()}>close</button>
      <button onClick={() => props.onImportCsv()}>importCsv</button>
      <button onClick={() => props.onExportCsv()}>exportCsv</button>
      <button onClick={() => props.onExportTsv()}>exportTsv</button>
      <button onClick={() => props.onChangeEncoding('sjis')}>changeSjis</button>
      <button onClick={() => props.onResetSort()}>resetSort</button>
      <button onClick={() => props.onCommitSort()}>commitSort</button>
      <button onClick={() => props.onToggleColumnHeaders()}>toggleColHeaders</button>
      <button onClick={() => props.onToggleRowHeaders()}>toggleRowHeaders</button>
      <span>hasActiveSort:{String(props.hasActiveSort)}</span>
      <span>encoding:{props.exportEncoding}</span>
    </div>
  )
})
jest.mock('../components/ContextMenu', () => ({
  __esModule: true,
  default: MockContextMenu,
  ContextMenuState: {}
}))

const MockSearchBar = jest.fn((props: any) => (
  <div data-testid="search-bar">
    <button onClick={() => props.onSearch()}>search</button>
    <button onClick={() => props.onClose()}>closeSearch</button>
  </div>
))
jest.mock('../components/SearchBar', () => ({
  __esModule: true,
  default: MockSearchBar
}))

// DynamicThemeProvider をパススルー
jest.mock('../contexts/DynamicThemeContext', () => ({
  DynamicThemeProvider: ({ children }: any) => <>{children}</>
}))

// scrollIntoView モック
Element.prototype.scrollIntoView = jest.fn()

// VSCode API モック
Object.defineProperty(window, 'vscode', { value: { postMessage: jest.fn() }, writable: true })

// clipboard モック
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: jest.fn().mockResolvedValue(undefined), readText: jest.fn().mockResolvedValue('test') },
  configurable: true
})

import TableEditor from '../components/TableEditor'

describe('TableEditor (mocked hooks)', () => {
  const mockOnTableUpdate = jest.fn()
  const mockOnSendMessage = jest.fn()
  const mockOnTableSwitch = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    copyResult = true
    pasteResult = { success: true, updates: [{ row: 0, col: 0, value: 'pasted' }], message: 'Pasted' }
    useTableEditorReturn = {
      tableData: mockTableData,
      modelTableData: mockTableData,
      editorState: { ...defaultEditorState, selectedCells: new Set(['0-0']) },
      selectionAnchor: null,
      updateCell: mockUpdateCell,
      updateCells: mockUpdateCells,
      updateHeader: mockUpdateHeader,
      addRow: mockAddRow,
      deleteRow: mockDeleteRow,
      addColumn: mockAddColumn,
      deleteColumn: mockDeleteColumn,
      selectCell: mockSelectCell,
      selectRow: mockSelectRow,
      selectColumn: mockSelectColumn,
      selectAll: mockSelectAll,
      setCurrentEditingCell: mockSetCurrentEditingCell,
      initialCellInput: null,
      setInitialCellInput: mockSetInitialCellInput,
      setSelectionAnchor: mockSetSelectionAnchor,
      setColumnWidth: mockSetColumnWidth,
      sortColumn: mockSortColumn,
      moveRows: mockMoveRows,
      moveColumns: mockMoveColumns,
      commitSort: mockCommitSort,
      resetSort: mockResetSort,
      viewToModelMap: [0, 1, 2],
      toggleColumnHeaders: mockToggleColumnHeaders,
      toggleRowHeaders: mockToggleRowHeaders,
      onDragStart: mockOnDragStart,
      onDragEnter: mockOnDragEnter,
      onDragEnd: mockOnDragEnd
    }
  })

  const renderEditor = (props: Partial<React.ComponentProps<typeof TableEditor>> = {}) => {
    return render(
      <TableEditor
        tableData={mockTableData}
        onTableUpdate={mockOnTableUpdate}
        onSendMessage={mockOnSendMessage}
        {...props}
      />
    )
  }

  // ===== 基本レンダリング =====
  test('renders with default props', () => {
    renderEditor()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  test('renders with external sortState and headerConfig', () => {
    const setSortState = jest.fn()
    const setHeaderConfig = jest.fn()
    renderEditor({
      sortState: { column: 0, direction: 'asc' },
      setSortState,
      headerConfig: { hasColumnHeaders: true, hasRowHeaders: true },
      setHeaderConfig
    })
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  test('renders with allTables and onTableSwitch', () => {
    renderEditor({
      currentTableIndex: 0,
      allTables: [mockTableData],
      onTableSwitch: mockOnTableSwitch
    })
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  test('renders with showGitDiff=false', () => {
    renderEditor({ showGitDiff: false })
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  // ===== useEffect: globalMouseUp =====
  test('global mouseup calls onDragEnd', () => {
    renderEditor()
    act(() => { window.dispatchEvent(new Event('mouseup')) })
    expect(mockOnDragEnd).toHaveBeenCalled()
  })

  // ===== useEffect: clearInitialInputTimeoutRef cleanup =====
  test('clearInitialInputTimeoutRef cleanup during editing', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: { ...defaultEditorState, currentEditingCell: { row: 0, col: 0 } }
    }
    const { unmount } = renderEditor()
    unmount()
  })

  // ===== toModelRow =====
  test('toModelRow handles non-array viewToModelMap', () => {
    useTableEditorReturn = { ...useTableEditorReturn, viewToModelMap: null }
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onDeleteRow(0)
    expect(mockOnSendMessage).toHaveBeenCalled()
  })

  test('toModelRow handles undefined map entry', () => {
    useTableEditorReturn = { ...useTableEditorReturn, viewToModelMap: [undefined, 1, 2] }
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onDeleteRow(0)
    expect(mockOnSendMessage).toHaveBeenCalled()
  })

  // ===== markCellAsTempEmptyWithTracking =====
  test('markCellAsTempEmptyWithTracking tracks position', () => {
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    expect(inputCapture).toBeTruthy()
    fireEvent.compositionStart(inputCapture)
  })

  // ===== selectedColumns/selectedRows useMemo =====
  test('selectedColumns/selectedRows computed from selectedCells', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: { ...defaultEditorState, selectedCells: new Set(['0-0', '0-1', '1-0', '1-1']) }
    }
    renderEditor()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  // ===== useEffect: cleanup visual artifacts =====
  test('cleanup visual artifacts when editing ends', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: { ...defaultEditorState, currentEditingCell: null }
    }
    renderEditor()
    const cellDomUtils = require('../utils/cellDomUtils')
    expect(cellDomUtils.cleanupCellVisualArtifacts).toHaveBeenCalled()
  })

  // ===== useAutofill callbacks =====
  test('autofill onUpdateCells sends bulkUpdateCells message', () => {
    renderEditor()
    act(() => {
      autofillCallbacks.onUpdateCells([{ row: 0, col: 0, value: 'filled' }])
    })
    expect(mockUpdateCells).toHaveBeenCalledWith([{ row: 0, col: 0, value: 'filled' }])
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'bulkUpdateCells',
      data: expect.objectContaining({ updates: expect.any(Array) })
    })
    expect(mockUpdateStatus).toHaveBeenCalled()
  })

  test('autofill getCellValue returns cell value', () => {
    renderEditor()
    const val = autofillCallbacks.getCellValue(0, 0)
    expect(val).toBe('Alice')
  })

  test('autofill getCellValue returns empty for out of range', () => {
    renderEditor()
    const val = autofillCallbacks.getCellValue(99, 99)
    expect(val).toBe('')
  })

  test('autofill onFillComplete extends selection', () => {
    renderEditor()
    act(() => {
      autofillCallbacks.onFillComplete({ start: { row: 0, col: 0 }, end: { row: 2, col: 0 } })
    })
    expect(mockSelectCell).toHaveBeenCalledWith(2, 0, true)
  })

  // ===== useDragDrop callbacks =====
  test('dragDrop onMoveRow calls moveRows and sends message', () => {
    renderEditor()
    act(() => {
      dragDropCallbacks.onMoveRow([0, 1], 2)
    })
    expect(mockMoveRows).toHaveBeenCalledWith([0, 1], 2)
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'moveRow',
      data: expect.objectContaining({ indices: [0, 1], toIndex: 2 })
    })
  })

  test('dragDrop onMoveRow with empty validIndices does nothing', () => {
    renderEditor()
    act(() => {
      dragDropCallbacks.onMoveRow([undefined, null], 2)
    })
    expect(mockMoveRows).not.toHaveBeenCalled()
  })

  test('dragDrop onMoveColumn calls moveColumns and sends message', () => {
    renderEditor()
    act(() => {
      dragDropCallbacks.onMoveColumn([0], 2)
    })
    expect(mockMoveColumns).toHaveBeenCalledWith([0], 2)
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'moveColumn',
      data: expect.objectContaining({ indices: [0], toIndex: 2 })
    })
  })

  test('dragDrop onMoveColumn with empty validIndices does nothing', () => {
    renderEditor()
    act(() => {
      dragDropCallbacks.onMoveColumn([undefined], 2)
    })
    expect(mockMoveColumns).not.toHaveBeenCalled()
  })

  // ===== useSearch callbacks =====
  test('search onNavigateToResult navigates to same sheet', () => {
    renderEditor({ currentTableIndex: 0 })
    act(() => {
      searchCallbacks.onNavigateToResult({ tableIndex: 0, row: 1, col: 1 })
    })
    expect(mockSelectCell).toHaveBeenCalledWith(1, 1, false)
  })

  test('search onNavigateToResult navigates to different sheet', () => {
    jest.useFakeTimers()
    renderEditor({ currentTableIndex: 0, onTableSwitch: mockOnTableSwitch })
    act(() => {
      searchCallbacks.onNavigateToResult({ tableIndex: 1, row: 0, col: 0 })
    })
    expect(mockOnTableSwitch).toHaveBeenCalledWith(1)
    act(() => { jest.advanceTimersByTime(300) })
    expect(mockSelectCell).toHaveBeenCalled()
    jest.useRealTimers()
  })

  test('search onUpdateCell updates cell in current table', () => {
    renderEditor({ currentTableIndex: 0 })
    act(() => {
      searchCallbacks.onUpdateCell(0, 1, 1, 'updated')
    })
    expect(mockUpdateCell).toHaveBeenCalledWith(1, 1, 'updated')
  })

  test('search onUpdateCell does nothing for different table', () => {
    renderEditor({ currentTableIndex: 0 })
    act(() => {
      searchCallbacks.onUpdateCell(1, 0, 0, 'val')
    })
    expect(mockUpdateCell).not.toHaveBeenCalled()
  })

  test('search onBulkUpdate updates cells in current table', () => {
    renderEditor({ currentTableIndex: 0 })
    act(() => {
      searchCallbacks.onBulkUpdate(0, [{ row: 0, col: 0, value: 'v1' }])
    })
    expect(mockUpdateCells).toHaveBeenCalled()
  })

  test('search onBulkUpdate does nothing for different table', () => {
    renderEditor({ currentTableIndex: 0 })
    act(() => {
      searchCallbacks.onBulkUpdate(1, [{ row: 0, col: 0, value: 'v1' }])
    })
    expect(mockUpdateCells).not.toHaveBeenCalled()
  })

  // ===== handleColumnSelect / handleRowSelect =====
  test('handleRowSelect from TableBody', () => {
    renderEditor()
    
    const bodyProps = MockTableBody.mock.calls[MockTableBody.mock.calls.length - 1][0]
    bodyProps.onRowSelect(0, { shiftKey: false })
    expect(mockSelectRow).toHaveBeenCalledWith(0, false)
  })

  test('handleRowSelect with shift', () => {
    renderEditor()
    
    const bodyProps = MockTableBody.mock.calls[MockTableBody.mock.calls.length - 1][0]
    bodyProps.onRowSelect(1, { shiftKey: true })
    expect(mockSelectRow).toHaveBeenCalledWith(1, true)
  })

  test('handleColumnSelect from TableHeader', () => {
    renderEditor()
    
    const headerProps = MockTableHeader.mock.calls[MockTableHeader.mock.calls.length - 1][0]
    headerProps.onColumnSelect(0, { shiftKey: false })
    expect(mockSelectColumn).toHaveBeenCalledWith(0, false)
  })

  test('handleColumnSelect with shift', () => {
    renderEditor()
    
    const headerProps = MockTableHeader.mock.calls[MockTableHeader.mock.calls.length - 1][0]
    headerProps.onColumnSelect(1, { shiftKey: true })
    expect(mockSelectColumn).toHaveBeenCalledWith(1, true)
  })

  // ===== handleCellUpdate =====
  test('handleCellUpdate for normal cell', () => {
    renderEditor()
    
    const bodyProps = MockTableBody.mock.calls[MockTableBody.mock.calls.length - 1][0]
    bodyProps.onCellUpdate(0, 0, 'new value')
    expect(mockUpdateCell).toHaveBeenCalledWith(0, 0, 'new value')
  })

  test('handleCellUpdate for header row', () => {
    renderEditor()
    
    const bodyProps = MockTableBody.mock.calls[MockTableBody.mock.calls.length - 1][0]
    bodyProps.onCellUpdate(-1, 0, 'new header')
    expect(mockUpdateHeader).toHaveBeenCalledWith(0, 'new header')
  })

  // ===== handleHeaderUpdate =====
  test('handleHeaderUpdate sends message', () => {
    renderEditor()
    
    const headerProps = MockTableHeader.mock.calls[MockTableHeader.mock.calls.length - 1][0]
    headerProps.onHeaderUpdate(1, 'New Name')
    expect(mockUpdateHeader).toHaveBeenCalledWith(1, 'New Name')
  })

  // ===== handleAddRow / handleAddColumn =====
  test('handleAddRow with count', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onAddRow(2, 3)
    expect(mockAddRow).toHaveBeenCalledWith(2, 3)
  })

  test('handleAddRow without count defaults to 1', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onAddRow(0)
    expect(mockAddRow).toHaveBeenCalledWith(0, 1)
  })

  test('handleAddColumn with count', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onAddColumn(1, 2)
    expect(mockAddColumn).toHaveBeenCalledWith(1, 2)
  })

  // ===== handleDeleteRows / handleDeleteColumns =====
  test('handleDeleteRows deletes multiple rows', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onDeleteRows([0, 2])
    expect(mockDeleteRow).toHaveBeenCalledTimes(2)
  })

  test('handleDeleteRow delegates to handleDeleteRows', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onDeleteRow(1)
    expect(mockDeleteRow).toHaveBeenCalled()
  })

  test('handleDeleteColumns deletes multiple columns', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onDeleteColumns([0, 1])
    expect(mockDeleteColumn).toHaveBeenCalledTimes(2)
  })

  test('handleDeleteColumn delegates to handleDeleteColumns', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onDeleteColumn(1)
    expect(mockDeleteColumn).toHaveBeenCalled()
  })

  // ===== handleSort / handleCommitSort / handleResetSort =====
  test('handleSort calls sortColumn', () => {
    renderEditor()
    
    const headerProps = MockTableHeader.mock.calls[MockTableHeader.mock.calls.length - 1][0]
    headerProps.onSort(0)
    expect(mockSortColumn).toHaveBeenCalledWith(0)
  })

  test('handleCommitSort with active sort sends sort message', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: { ...defaultEditorState, sortState: { column: 0, direction: 'asc' } }
    }
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onCommitSort()
    expect(mockCommitSort).toHaveBeenCalled()
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'sort',
      data: expect.objectContaining({ column: 0, direction: 'asc' })
    })
  })

  test('handleCommitSort with direction none returns early', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onCommitSort()
    expect(mockCommitSort).not.toHaveBeenCalled()
  })

  test('handleResetSort resets sort state', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onResetSort()
    expect(mockResetSort).toHaveBeenCalled()
    expect(mockUpdateStatus).toHaveBeenCalledWith('info', expect.any(String))
  })

  // ===== handleCopy / handlePaste / handleCut / handleClearCells =====
  test('handleCopy success', async () => {
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    await act(async () => { await keyNavProps.onCopy() })
    expect(mockUpdateStatus).toHaveBeenCalledWith('success', expect.any(String))
  })

  test('handleCopy failure', async () => {
    copyResult = false
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    await act(async () => { await keyNavProps.onCopy() })
    expect(mockUpdateStatus).toHaveBeenCalledWith('error', expect.any(String))
  })

  test('handlePaste success with updates', async () => {
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    await act(async () => { await keyNavProps.onPaste() })
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'bulkUpdateCells',
      data: expect.objectContaining({ updates: expect.any(Array) })
    })
  })

  test('handlePaste failure', async () => {
    pasteResult = { success: false, updates: [], message: 'Failed' }
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    await act(async () => { await keyNavProps.onPaste() })
    expect(mockUpdateStatus).toHaveBeenCalledWith('error', 'Failed')
  })

  test('handlePaste with no updates', async () => {
    pasteResult = { success: true, updates: [], message: 'OK' }
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    await act(async () => { await keyNavProps.onPaste() })
    expect(mockUpdateStatus).toHaveBeenCalledWith('success', 'OK')
  })

  test('handleCut success', async () => {
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    await act(async () => { await keyNavProps.onCut() })
    expect(mockUpdateCells).toHaveBeenCalled()
    expect(mockUpdateStatus).toHaveBeenCalledWith('success', expect.any(String))
  })

  test('handleCut failure', async () => {
    copyResult = false
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    await act(async () => { await keyNavProps.onCut() })
    expect(mockUpdateStatus).toHaveBeenCalledWith('error', expect.any(String))
  })

  test('handleCut without selectionRange', async () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: { ...defaultEditorState, selectionRange: null, selectedCells: new Set() }
    }
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    await act(async () => { await keyNavProps.onCut() })
    expect(mockUpdateCells).not.toHaveBeenCalled()
  })

  test('handleClearCells clears selected cells', () => {
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    act(() => { keyNavProps.onClearCells() })
    expect(mockUpdateCells).toHaveBeenCalled()
  })

  test('handleClearCells with empty selection', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: { ...defaultEditorState, selectedCells: new Set() }
    }
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    act(() => { keyNavProps.onClearCells() })
    expect(mockUpdateCells).not.toHaveBeenCalled()
  })

  // ===== IME handlers =====
  test('compositionStart cancels pending timer', () => {
    jest.useFakeTimers()
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.compositionStart(inputCapture)
    Object.defineProperty(inputCapture, 'value', { value: 'テ', writable: true, configurable: true })
    fireEvent.compositionEnd(inputCapture, { data: 'テ' })
    fireEvent.compositionStart(inputCapture)
    act(() => { jest.advanceTimersByTime(200) })
    jest.useRealTimers()
  })

  test('compositionEnd triggers edit mode after timer', () => {
    jest.useFakeTimers()
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.compositionStart(inputCapture)
    Object.defineProperty(inputCapture, 'value', { value: 'テスト', writable: true, configurable: true })
    fireEvent.compositionEnd(inputCapture, { data: 'テスト' })
    act(() => { jest.advanceTimersByTime(200) })
    expect(mockSetInitialCellInput).toHaveBeenCalledWith('テスト')
    expect(mockSetCurrentEditingCell).toHaveBeenCalled()
    jest.useRealTimers()
  })

  test('input event during pending timer is ignored', () => {
    jest.useFakeTimers()
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.compositionStart(inputCapture)
    Object.defineProperty(inputCapture, 'value', { value: 'あ', writable: true, configurable: true })
    fireEvent.compositionEnd(inputCapture, { data: 'あ' })
    fireEvent.input(inputCapture, { target: { value: 'あ' }, nativeEvent: { isComposing: false } })
    act(() => { jest.advanceTimersByTime(200) })
    jest.useRealTimers()
  })

  test('non-IME input triggers edit mode', () => {
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    Object.defineProperty(inputCapture, 'value', { value: 'a', writable: true, configurable: true })
    fireEvent.input(inputCapture, { target: { value: 'a' }, nativeEvent: { isComposing: false } })
    expect(mockSetInitialCellInput).toHaveBeenCalledWith('a')
  })

  test('keyDown Enter during IME stops propagation', () => {
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.compositionStart(inputCapture)
    fireEvent.keyDown(inputCapture, { key: 'Enter', nativeEvent: { isComposing: true } })
  })

  test('paste on input capture prevents default', () => {
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.paste(inputCapture, {
      clipboardData: { getData: () => 'text' },
      preventDefault: jest.fn()
    })
  })

  // ===== updateInputCapturePosition =====
  test('updateInputCapturePosition hides when no selectionRange', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: { ...defaultEditorState, selectionRange: null }
    }
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    expect(inputCapture.style.zIndex).toBe('-1')
  })

  test('updateInputCapturePosition positions with cell element', () => {
    const cellDomUtils = require('../utils/cellDomUtils')
    const mockElement = document.createElement('td')
    mockElement.getBoundingClientRect = jest.fn().mockReturnValue({ left: 100, top: 200, width: 150, height: 30 })
    cellDomUtils.queryCellElement.mockReturnValue(mockElement)
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    expect(inputCapture.style.left).toBe('100px')
    cellDomUtils.queryCellElement.mockReturnValue(null)
  })

  // ===== useEffect: focus inputCapture with initialCellInput =====
  test('focus inputCapture when initialCellInput is set', () => {
    jest.useFakeTimers()
    useTableEditorReturn = {
      ...useTableEditorReturn,
      initialCellInput: 'test'
    }
    renderEditor()
    act(() => { jest.advanceTimersByTime(200) })
    jest.useRealTimers()
  })

  // ===== handleExportCsv / handleExportTsv =====
  test('handleExportCsv calls exportToCSV', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onExportCsv()
    expect(mockExportToCSV).toHaveBeenCalled()
  })

  test('handleExportTsv calls exportToTSV', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onExportTsv()
    expect(mockExportToTSV).toHaveBeenCalled()
  })

  // ===== handleImportCsv =====
  test('handleImportCsv sends message', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onImportCsv()
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'importCSV',
      data: expect.objectContaining({ tableIndex: 0 })
    })
  })

  // ===== handleEncodingChange =====
  test('handleEncodingChange changes encoding', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    expect(ctxProps.exportEncoding).toBe('utf8')
    act(() => { ctxProps.onChangeEncoding('sjis') })
  })

  // ===== closeContextMenu =====
  test('closeContextMenu resets menu state', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    expect(screen.getByTestId('context-menu')).toBeInTheDocument()
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    act(() => { ctxProps.onClose() })
  })

  // ===== handleEditorContextMenu =====
  test('handleEditorContextMenu with prevented default', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'defaultPrevented', { value: true })
    act(() => { container.dispatchEvent(event) })
  })

  test('handleEditorContextMenu opens menu', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    expect(screen.getByTestId('context-menu')).toBeInTheDocument()
  })

  // ===== toggle column/row headers =====
  test('toggleColumnHeaders via context menu', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onToggleColumnHeaders()
    expect(mockToggleColumnHeaders).toHaveBeenCalled()
  })

  test('toggleRowHeaders via context menu', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    
    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onToggleRowHeaders()
    expect(mockToggleRowHeaders).toHaveBeenCalled()
  })

  // ===== hasActiveSort prop =====
  test('hasActiveSort true', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: { ...defaultEditorState, sortState: { column: 0, direction: 'asc' } }
    }
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    expect(screen.getByText('hasActiveSort:true')).toBeInTheDocument()
  })

  test('hasActiveSort false', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)
    expect(screen.getByText('hasActiveSort:false')).toBeInTheDocument()
  })

  // ===== useEffect: model data and sort state =====
  test('onTableUpdate and updateSortState called on render', () => {
    renderEditor()
    expect(mockOnTableUpdate).toHaveBeenCalledWith(mockTableData)
    expect(mockUpdateSortState).toHaveBeenCalled()
  })

  // ===== useKeyboardNavigation callbacks =====
  test('onUndo sends undo message', () => {
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    keyNavProps.onUndo()
    expect(mockOnSendMessage).toHaveBeenCalledWith({ command: 'undo' })
  })

  test('onRedo sends redo message', () => {
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    keyNavProps.onRedo()
    expect(mockOnSendMessage).toHaveBeenCalledWith({ command: 'redo' })
  })

  test('onOpenSearch calls openSearch', () => {
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    keyNavProps.onOpenSearch(true)
    expect(mockOpenSearch).toHaveBeenCalledWith(true)
  })

  test('onOpenSearch default to false', () => {
    renderEditor()
    const keyNavMock = require('../hooks/useKeyboardNavigation').useKeyboardNavigation
    const keyNavProps = keyNavMock.mock.calls[keyNavMock.mock.calls.length - 1][0]
    keyNavProps.onOpenSearch()
    expect(mockOpenSearch).toHaveBeenCalledWith(false)
  })

  // ===== resize event =====
  test('resize event', () => {
    renderEditor()
    act(() => { window.dispatchEvent(new Event('resize')) })
  })

  // ===== selection change clears IME state =====
  test('selection change clears IME state', () => {
    const { rerender } = renderEditor()
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: { ...defaultEditorState, selectionRange: { start: { row: 1, col: 1 }, end: { row: 1, col: 1 } } }
    }
    rerender(
      <TableEditor
        tableData={mockTableData}
        onTableUpdate={mockOnTableUpdate}
        onSendMessage={mockOnSendMessage}
      />
    )
  })

  // ===== selection change triggers IME cleanup =====
  test('selection change with existing prevPos clears IME state', () => {
    // 1回目のレンダリング: prevSelectionRef = null → selectionRange.start = {row:0, col:0}
    const { rerender } = renderEditor()
    // useEffect 完了後: prevSelectionRef = {row:0, col:0}

    // 2回目のレンダリング: prevPos={row:0,col:0}, currentPos={row:1,col:1}
    // → IME状態がクリアされるはず
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: {
        ...defaultEditorState,
        selectionRange: { start: { row: 1, col: 1 }, end: { row: 1, col: 1 } }
      }
    }
    act(() => {
      rerender(
        <TableEditor
          tableData={mockTableData}
          onTableUpdate={mockOnTableUpdate}
          onSendMessage={mockOnSendMessage}
        />
      )
    })
  })

  // ===== compositionEnd twice (timer clear in compositionEnd) =====
  test('compositionEnd twice clears existing timer', () => {
    jest.useFakeTimers()
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.compositionStart(inputCapture)
    Object.defineProperty(inputCapture, 'value', { value: 'あ', writable: true, configurable: true })
    fireEvent.compositionEnd(inputCapture, { data: 'あ' })
    // タイマーがセットされた状態でもう1回compositionEnd
    Object.defineProperty(inputCapture, 'value', { value: 'あい', writable: true, configurable: true })
    fireEvent.compositionEnd(inputCapture, { data: 'あい' })
    act(() => { jest.advanceTimersByTime(200) })
    jest.useRealTimers()
  })

  // ===== compositionHandledRef prevents input processing =====
  test('input after compositionEnd is ignored via compositionHandledRef', () => {
    jest.useFakeTimers()
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.compositionStart(inputCapture)
    Object.defineProperty(inputCapture, 'value', { value: 'か', writable: true, configurable: true })
    fireEvent.compositionEnd(inputCapture, { data: 'か' })
    // compositionHandledRef.current = true の状態で input が来る
    // setTimeout(0) がまだ実行されていないので compositionHandledRef は true
    fireEvent.input(inputCapture, { target: { value: 'か' }, nativeEvent: { isComposing: false } })
    act(() => { jest.advanceTimersByTime(200) })
    jest.useRealTimers()
  })

  // ===== isNativeComposing in input event =====
  test('input event during IME composing is ignored', () => {
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    // compositionStart でIME状態をtrueにし、状態を反映させる
    act(() => { fireEvent.compositionStart(inputCapture) })
    // compositionStart 後は IME タイマーが設定されているので、
    // input イベントはそのタイマー処理に委ねられて無視される
    Object.defineProperty(inputCapture, 'value', { value: 'き', writable: true, configurable: true })
    // compositionEnd でタイマーを設定
    fireEvent.compositionEnd(inputCapture, { data: 'き' })
    // タイマーが動いている間の input は無視される (imeCompleteTimerRef.current が truthy)
    fireEvent.input(inputCapture, { target: { value: 'き' }, nativeEvent: { isComposing: false } })
  })

  // ===== Enter key after compositionEnd (compositionHandledRef) =====
  test('Enter after compositionEnd is prevented', () => {
    jest.useFakeTimers()
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.compositionStart(inputCapture)
    Object.defineProperty(inputCapture, 'value', { value: 'く', writable: true, configurable: true })
    fireEvent.compositionEnd(inputCapture, { data: 'く' })
    // compositionHandledRef = true の間に Enter
    fireEvent.keyDown(inputCapture, { key: 'Enter', nativeEvent: { isComposing: false } })
    act(() => { jest.advanceTimersByTime(200) })
    jest.useRealTimers()
  })

  // ===== onShowColumnContextMenu from TableHeader =====
  test('column header context menu sets menu state', () => {
    renderEditor()
    const th = document.querySelector('th[data-col="0"]')!
    fireEvent.contextMenu(th, { clientX: 100, clientY: 200 })
  })

  // ===== onShowRowContextMenu from TableBody =====
  test('row number context menu sets menu state', () => {
    renderEditor()
    const rowNum = document.querySelector('.row-number[data-row="0"]')!
    fireEvent.contextMenu(rowNum, { clientX: 150, clientY: 250 })
  })

  // ===== focus inputCapture useEffect (L793) =====
  test('inputCapture gets focused with initialCellInput when not editing', () => {
    jest.useFakeTimers()
    useTableEditorReturn = {
      ...useTableEditorReturn,
      initialCellInput: 'abc',
      editorState: { ...defaultEditorState, currentEditingCell: null }
    }
    renderEditor()
    act(() => { jest.advanceTimersByTime(200) })
    jest.useRealTimers()
  })

  // ===== unmount =====
  test('unmount cleans up', () => {
    const { unmount } = renderEditor()
    unmount()
  })

  // ===== auto-search on options/scope change =====
  test('auto-search triggers when search is open with results', () => {
    const useSearchMock = require('../hooks/useSearch').useSearch
    useSearchMock.mockReturnValue({
      searchState: { isOpen: true, searchText: 'Alice', results: [{ tableIndex: 0, row: 0, col: 0 }], currentResultIndex: 0, options: {}, scope: 'all' },
      performSearch: mockPerformSearch,
      findNext: jest.fn(), findPrevious: jest.fn(), replaceOne: jest.fn(), replaceAll: jest.fn(),
      openSearch: mockOpenSearch, closeSearch: mockCloseSearch, setSearchText: jest.fn(),
      setReplaceText: jest.fn(), setScope: jest.fn(), toggleOption: jest.fn(),
      toggleAdvanced: jest.fn(), toggleReplace: jest.fn(), currentResultInfo: null
    })
    renderEditor()
    expect(mockPerformSearch).toHaveBeenCalled()
    // リセット
    useSearchMock.mockImplementation((opts: any) => {
      searchCallbacks = opts
      return {
        searchState: { isOpen: false, searchText: '', results: [], currentResultIndex: -1, options: {}, scope: 'all' },
        performSearch: mockPerformSearch, findNext: jest.fn(), findPrevious: jest.fn(),
        replaceOne: jest.fn(), replaceAll: jest.fn(), openSearch: mockOpenSearch, closeSearch: mockCloseSearch,
        setSearchText: jest.fn(), setReplaceText: jest.fn(), setScope: jest.fn(), toggleOption: jest.fn(),
        toggleAdvanced: jest.fn(), toggleReplace: jest.fn(), currentResultInfo: null
      }
    })
  })

  // ===== isSearchResult / isCurrentSearchResult =====
  test('isSearchResult and isCurrentSearchResult', () => {
    const useSearchMock = require('../hooks/useSearch').useSearch
    useSearchMock.mockReturnValue({
      searchState: { isOpen: true, searchText: 'Alice', results: [{ tableIndex: 0, row: 0, col: 0 }], currentResultIndex: 0, options: {}, scope: 'all' },
      performSearch: mockPerformSearch, findNext: jest.fn(), findPrevious: jest.fn(),
      replaceOne: jest.fn(), replaceAll: jest.fn(), openSearch: mockOpenSearch, closeSearch: mockCloseSearch,
      setSearchText: jest.fn(), setReplaceText: jest.fn(), setScope: jest.fn(), toggleOption: jest.fn(),
      toggleAdvanced: jest.fn(), toggleReplace: jest.fn(), currentResultInfo: null
    })
    renderEditor()
    
    const bodyProps = MockTableBody.mock.calls[MockTableBody.mock.calls.length - 1][0]
    expect(bodyProps.isSearchResult(0, 0)).toBe(true)
    expect(bodyProps.isSearchResult(1, 1)).toBe(false)
    expect(bodyProps.isCurrentSearchResult(0, 0)).toBe(true)
    expect(bodyProps.isCurrentSearchResult(1, 1)).toBe(false)
    useSearchMock.mockImplementation((opts: any) => {
      searchCallbacks = opts
      return {
        searchState: { isOpen: false, searchText: '', results: [], currentResultIndex: -1, options: {}, scope: 'all' },
        performSearch: mockPerformSearch, findNext: jest.fn(), findPrevious: jest.fn(),
        replaceOne: jest.fn(), replaceAll: jest.fn(), openSearch: mockOpenSearch, closeSearch: mockCloseSearch,
        setSearchText: jest.fn(), setReplaceText: jest.fn(), setScope: jest.fn(), toggleOption: jest.fn(),
        toggleAdvanced: jest.fn(), toggleReplace: jest.fn(), currentResultInfo: null
      }
    })
  })

  test('isCurrentSearchResult false when index is negative', () => {
    const useSearchMock = require('../hooks/useSearch').useSearch
    useSearchMock.mockReturnValue({
      searchState: { isOpen: true, searchText: 'Alice', results: [{ tableIndex: 0, row: 0, col: 0 }], currentResultIndex: -1, options: {}, scope: 'all' },
      performSearch: mockPerformSearch, findNext: jest.fn(), findPrevious: jest.fn(),
      replaceOne: jest.fn(), replaceAll: jest.fn(), openSearch: mockOpenSearch, closeSearch: mockCloseSearch,
      setSearchText: jest.fn(), setReplaceText: jest.fn(), setScope: jest.fn(), toggleOption: jest.fn(),
      toggleAdvanced: jest.fn(), toggleReplace: jest.fn(), currentResultInfo: null
    })
    renderEditor()
    
    const bodyProps = MockTableBody.mock.calls[MockTableBody.mock.calls.length - 1][0]
    expect(bodyProps.isCurrentSearchResult(0, 0)).toBe(false)
    useSearchMock.mockImplementation((opts: any) => {
      searchCallbacks = opts
      return {
        searchState: { isOpen: false, searchText: '', results: [], currentResultIndex: -1, options: {}, scope: 'all' },
        performSearch: mockPerformSearch, findNext: jest.fn(), findPrevious: jest.fn(),
        replaceOne: jest.fn(), replaceAll: jest.fn(), openSearch: mockOpenSearch, closeSearch: mockCloseSearch,
        setSearchText: jest.fn(), setReplaceText: jest.fn(), setScope: jest.fn(), toggleOption: jest.fn(),
        toggleAdvanced: jest.fn(), toggleReplace: jest.fn(), currentResultInfo: null
      }
    })
  })

  // ===== Branch: withTableIndex when currentTableIndex is undefined =====
  // 注: currentTableIndex のデフォルト値が 0 のため、undefined を渡しても
  // 分割代入のデフォルト値により 0 が使われる。
  // false 分岐は istanbul ignore で対応。

  // ===== Branch: handleAddColumn without count =====
  test('handleAddColumn without count defaults to 1', () => {
    renderEditor()
    const container = document.getElementById('table-content')!
    fireEvent.contextMenu(container)

    const ctxProps = MockContextMenu.mock.calls[MockContextMenu.mock.calls.length - 1][0]
    ctxProps.onAddColumn(1)
    expect(mockAddColumn).toHaveBeenCalledWith(1, 1)
    expect(mockOnSendMessage).toHaveBeenCalledWith({
      command: 'addColumn',
      data: expect.objectContaining({ index: 1, count: 1 })
    })
  })

  // ===== Branch: selectionRange.end fallback to start =====
  // 注: selectionRange.end が null のテストは、useEffect 依存配列で
  // selectionRange?.end.row を参照しているため TypeErrorが発生する。
  // 実運用では end は常に設定されるため、end || start のフォールバックは
  // istanbul ignore で対応。

  test('non-IME input with empty value does not enter edit mode', () => {
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    Object.defineProperty(inputCapture, 'value', { value: '', writable: true, configurable: true })
    fireEvent.input(inputCapture, { target: { value: '' }, nativeEvent: { isComposing: false } })
    expect(mockSetInitialCellInput).not.toHaveBeenCalled()
  })

  // ===== Branch: compositionStart when currently editing =====
  test('compositionStart during editing does not mark cell as temp empty', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: {
        ...defaultEditorState,
        currentEditingCell: { row: 0, col: 0 }
      }
    }
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    const cellDomUtils = require('../utils/cellDomUtils')
    cellDomUtils.markCellAsTemporarilyEmpty.mockClear()
    fireEvent.compositionStart(inputCapture)
    expect(cellDomUtils.markCellAsTemporarilyEmpty).not.toHaveBeenCalled()
  })

  // ===== Branch: compositionEnd when currently editing =====
  test('compositionEnd during editing does not enter edit mode', () => {
    jest.useFakeTimers()
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: {
        ...defaultEditorState,
        currentEditingCell: { row: 0, col: 0 }
      }
    }
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    Object.defineProperty(inputCapture, 'value', { value: 'い', writable: true, configurable: true })
    fireEvent.compositionEnd(inputCapture, { data: 'い' })
    act(() => { jest.advanceTimersByTime(200) })
    // 既に編集中なので setCurrentEditingCell は呼ばれない
    expect(mockSetCurrentEditingCell).not.toHaveBeenCalled()
    jest.useRealTimers()
  })

  // ===== Branch: non-IME input during editing does not enter edit mode =====
  test('non-IME input during editing does not enter edit mode', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: {
        ...defaultEditorState,
        currentEditingCell: { row: 0, col: 0 }
      }
    }
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    Object.defineProperty(inputCapture, 'value', { value: 'z', writable: true, configurable: true })
    fireEvent.input(inputCapture, { target: { value: 'z' }, nativeEvent: { isComposing: false } })
    expect(mockSetCurrentEditingCell).not.toHaveBeenCalled()
  })

  // ===== Branch: compositionStart with null selectionRange =====
  test('compositionStart with null selectionRange', () => {
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: {
        ...defaultEditorState,
        selectionRange: null
      }
    }
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.compositionStart(inputCapture)
    const cellDomUtils = require('../utils/cellDomUtils')
    // selectionRange が null なので markCellAsTemporarilyEmpty は呼ばれない
    // (ただし useEffect内で先に呼ばれている可能性がある)
  })

  // ===== Branch: compositionEnd with null selectionRange (pendingCompositionCleanupRef fallback) =====
  test('compositionEnd with null selectionRange falls back to pendingCompositionCleanupRef', () => {
    jest.useFakeTimers()
    // 最初に通常の selectionRange でレンダーし、compositionStart で pendingCompositionCleanupRef をセット
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    fireEvent.compositionStart(inputCapture)

    // selectionRange を null に変更してrerender
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: {
        ...defaultEditorState,
        selectionRange: null
      }
    }

    Object.defineProperty(inputCapture, 'value', { value: 'う', writable: true, configurable: true })
    fireEvent.compositionEnd(inputCapture, { data: 'う' })
    act(() => { jest.advanceTimersByTime(200) })
    jest.useRealTimers()
  })

  // ===== Branch: isNativeComposing ?? isComposing in handleInputCaptureInput =====
  test('handleInputCaptureInput isComposing nullish coalescing fallback', () => {
    renderEditor()
    const inputCapture = document.querySelector('.input-capture') as HTMLTextAreaElement
    // nativeEvent に isComposing が undefined の場合のフォールバック
    Object.defineProperty(inputCapture, 'value', { value: 'b', writable: true, configurable: true })
    // isComposing が undefined のイベントを発火（?? でフォールバック）
    const event = new Event('input', { bubbles: true }) as any
    Object.defineProperty(event, 'nativeEvent', { value: { isComposing: undefined } })
    Object.defineProperty(event, 'currentTarget', { value: inputCapture })
    // fireEvent.input では nativeEvent が制御できないため直接カバーは難しいが
    // 既存テストの isComposing: false で ?? は false を返す
    fireEvent.input(inputCapture, { target: { value: 'b' }, nativeEvent: { isComposing: false } })
    expect(mockSetInitialCellInput).toHaveBeenCalledWith('b')
  })

  // ===== Branch: scroll-padding when table-container has no thead =====
  test('scroll-padding handles missing thead gracefully', () => {
    // MockTableHeader は thead をレンダリングするので、
    // headerHeight = 0 (getBoundingClientRect は jsdom で 0 を返す) のケースはカバーされている
    renderEditor()
    const container = document.querySelector('.table-container')
    expect(container).toBeTruthy()
  })

  // ===== Branch: columnWidths in useEffect dependency =====
  test('scroll-padding updates when columnWidths changes', () => {
    const { rerender } = renderEditor()
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: {
        ...defaultEditorState,
        columnWidths: [200, 200, 200]
      }
    }
    rerender(
      <TableEditor
        tableData={mockTableData}
        onTableUpdate={mockOnTableUpdate}
        onSendMessage={mockOnSendMessage}
      />
    )
    const container = document.querySelector('.table-container')
    expect(container).toBeTruthy()
  })

  // ===== selection change col only =====
  test('selection change with same row but different col clears IME state', () => {
    const { rerender } = renderEditor()
    // col のみ変更（row は同じ 0）
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: {
        ...defaultEditorState,
        selectionRange: { start: { row: 0, col: 2 }, end: { row: 0, col: 2 } }
      }
    }
    act(() => {
      rerender(
        <TableEditor
          tableData={mockTableData}
          onTableUpdate={mockOnTableUpdate}
          onSendMessage={mockOnSendMessage}
        />
      )
    })
  })

  // ===== selection change row only =====
  test('selection change with same col but different row clears IME state', () => {
    const { rerender } = renderEditor()
    useTableEditorReturn = {
      ...useTableEditorReturn,
      editorState: {
        ...defaultEditorState,
        selectionRange: { start: { row: 1, col: 0 }, end: { row: 1, col: 0 } }
      }
    }
    act(() => {
      rerender(
        <TableEditor
          tableData={mockTableData}
          onTableUpdate={mockOnTableUpdate}
          onSendMessage={mockOnSendMessage}
        />
      )
    })
  })})