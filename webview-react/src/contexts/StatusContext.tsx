import { createContext, useContext, useState, ReactNode } from 'react'

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
  updateStatus: (type: StatusState['type'], message: string) => void
  updateSelection: (selection: string) => void
  updateTableInfo: (rows: number, columns: number) => void
  updateSaveStatus: (status: SaveStatus) => void
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

  const updateStatus = (type: StatusState['type'], message: string) => {
    setStatus({ type, message })
    // Auto-clear status after 3 seconds
    setTimeout(() => {
      setStatus(prev => ({ ...prev, message: undefined, type: undefined }))
    }, 3000)
  }

  const updateSelection = (selection: string) => {
    setStatus(prev => ({ ...prev, selection }))
  }

  const updateTableInfo = (rows: number, columns: number) => {
    setTableInfo({ rows, columns })
  }

  const updateSaveStatus = (status: SaveStatus) => {
    setSaveStatus(status)
    // Auto-clear save status after 2 seconds if it's not an error
    if (status === 'saved') {
      setTimeout(() => setSaveStatus(null), 2000)
    }
  }

  const clearStatus = () => {
    setStatus({})
    setSaveStatus(null)
  }

  return (
    <StatusContext.Provider value={{
      status,
      tableInfo,
      saveStatus,
      updateStatus,
      updateSelection,
      updateTableInfo,
      updateSaveStatus,
      clearStatus
    }}>
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