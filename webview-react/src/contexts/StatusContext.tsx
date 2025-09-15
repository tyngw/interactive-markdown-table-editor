import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react'
import { SortState } from '../types'

interface StatusState {
  message?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  selection?: string
}

interface TableInfo {
  rows: number
  columns: number
}

type SaveStatus = 'saved' | 'saving' | 'error' | null

interface StatusContextType {
  status: StatusState
  tableInfo: TableInfo | null
  saveStatus: SaveStatus
  sortState: SortState | null
  updateStatus: (type: StatusState['type'], message: string) => void
  updateSelection: (selection: string) => void
  updateTableInfo: (rows: number, columns: number) => void
  updateSaveStatus: (status: SaveStatus) => void
  updateSortState: (state: SortState) => void
  clearStatus: () => void
}

const StatusContext = createContext<StatusContextType | undefined>(undefined)

interface StatusProviderProps {
  children: ReactNode
}

export const StatusProvider: React.FC<StatusProviderProps> = ({ children }) => {
  const [status, setStatus] = useState<StatusState>({})
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null)
  const [sortState, setSortState] = useState<SortState | null>(null)

  const updateStatus = useCallback((type: StatusState['type'], message: string) => {
    setStatus({ type, message })
    setTimeout(() => {
      setStatus(prev => ({ ...prev, message: undefined, type: undefined }))
    }, 3000)
  }, [])

  const updateSelection = useCallback((selection: string) => {
    setStatus(prev => ({ ...prev, selection }))
  }, [])

  const updateTableInfo = useCallback((rows: number, columns: number) => {
    setTableInfo({ rows, columns })
  }, [])

  const updateSaveStatus = useCallback((status: SaveStatus) => {
    setSaveStatus(status)
    if (status === 'saved') {
      setTimeout(() => setSaveStatus(null), 2000)
    }
  }, [])

  const updateSortState = useCallback((state: SortState) => {
    setSortState(state)
  }, [])

  const clearStatus = useCallback(() => {
    setStatus({})
    setSaveStatus(null)
    setSortState(null)
  }, [])

  const contextValue = useMemo(() => ({
    status,
    tableInfo,
    saveStatus,
    sortState,
    updateStatus,
    updateSelection,
    updateTableInfo,
    updateSaveStatus,
    updateSortState,
    clearStatus
  }), [status, tableInfo, saveStatus, sortState, updateStatus, updateSelection, updateTableInfo, updateSaveStatus, updateSortState, clearStatus])

  return (
    <StatusContext.Provider value={contextValue}>
      {children}
    </StatusContext.Provider>
  )
}

export const useStatus = () => {
  const context = useContext(StatusContext)
  if (context === undefined) {
    throw new Error('useStatus must be used within a StatusProvider')
  }
  return context
}
