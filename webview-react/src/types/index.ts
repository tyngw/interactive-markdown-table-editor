// テーブルデータの型定義
export interface TableData {
  headers: string[]
  rows: string[][]
  fileInfo?: {
    fileName: string
    filePath: string
  }
}

// 複数テーブル対応
export interface MultiTableData {
  tables: TableData[]
  currentTableIndex: number
}

// セルの位置
export interface CellPosition {
  row: number
  col: number
}

// 選択範囲
export interface SelectionRange {
  start: CellPosition
  end: CellPosition
}

// VSCode通信メッセージ
export interface VSCodeMessage {
  command: string
  data?: any
}

// テーブル編集アクション
export interface TableAction {
  type: 'UPDATE_CELL' | 'ADD_ROW' | 'DELETE_ROW' | 'ADD_COLUMN' | 'DELETE_COLUMN' | 'SORT_COLUMN'
  payload: any
}

// ソート状態
export interface SortState {
  column: number
  direction: 'asc' | 'desc' | 'none'
}

// 列幅設定
export interface ColumnWidths {
  [columnIndex: number]: number
}

// エディタ状態
export interface EditorState {
  currentEditingCell: CellPosition | null
  selectedCells: Set<string>
  selectionRange: SelectionRange | null
  isSelecting: boolean
  sortState: SortState
  columnWidths: ColumnWidths
}