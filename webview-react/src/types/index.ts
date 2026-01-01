// ヘッダー設定
export interface HeaderConfig {
  hasColumnHeaders: boolean  // 一番上の行を列ヘッダーとして扱う
  hasRowHeaders: boolean     // 一番左の列を行ヘッダーとして扱う
}

// Git差分状態
export enum GitDiffStatus {
  UNCHANGED = 'unchanged',
  ADDED = 'added',
  MODIFIED = 'modified',
  DELETED = 'deleted'
}

// 行のGit差分情報
export interface RowGitDiff {
  row: number
  status: GitDiffStatus
  oldContent?: string  // 削除された行の内容（変更前の行を表示するため）
  isDeletedRow?: boolean  // 削除行の表示用フラグ（実データ行ではない）
}

// テーブルの列差分情報
export interface ColumnDiffInfo {
  oldColumnCount: number      // 変更前の列数
  newColumnCount: number      // 変更後の列数
  addedColumns: number[]      // 追加された列のインデックス（変更後の列番号）
  deletedColumns: number[]    // 削除された列のインデックス（変更前の列番号）
  oldHeaders?: string[]       // 変更前のヘッダ（削除列表示用）
}

// テーブルデータの型定義
export interface TableData {
  headers: string[]
  rows: string[][]
  fileInfo?: {
    fileName: string
    filePath: string
  }
  headerConfig?: HeaderConfig
  gitDiff?: RowGitDiff[]  // Git差分情報
  columnDiff?: ColumnDiffInfo  // 列の差分情報
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
  fullySelectedRows: Set<number>
  fullySelectedCols: Set<number>
  selectionRange: SelectionRange | null
  sortState: SortState
  columnWidths: ColumnWidths
  headerConfig: HeaderConfig
}

// 検索範囲
export type SearchScope = 'all' | 'current' | 'selection'

// 検索オプション
export interface SearchOptions {
  caseSensitive: boolean      // 大文字小文字を区別
  wholeWord: boolean           // 完全一致
  regex: boolean               // 正規表現
}

// 検索結果
export interface SearchResult {
  tableIndex: number
  row: number
  col: number
}

// 検索状態
export interface SearchState {
  isOpen: boolean              // 検索バーを表示するか
  showReplace: boolean         // 置換UIを表示するか
  showAdvanced: boolean        // 詳細設定を表示するか
  searchText: string           // 検索文字列
  replaceText: string          // 置換文字列
  scope: SearchScope           // 検索範囲
  options: SearchOptions       // 検索オプション
  results: SearchResult[]      // 検索結果
  currentResultIndex: number   // 現在の検索結果のインデックス
}