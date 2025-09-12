import { TableData } from '../types'
import { useTheme } from '../contexts/ThemeContext'

interface TableTabsProps {
  tables: TableData[]
  currentTableIndex: number
  onTabChange: (index: number) => void
}

const TableTabs: React.FC<TableTabsProps> = ({
  tables,
  currentTableIndex,
  onTabChange
}) => {
  const { getStyle } = useTheme()
  if (tables.length <= 1) {
    return null
  }

  return (
    <div className="table-tabs">
      {tables.map((table, index) => (
        <button
          key={index}
          className={`tab-button ${index === currentTableIndex ? 'active' : ''}`}
          onClick={() => onTabChange(index)}
        >
          表 {index + 1}
        </button>
      ))}
    </div>
  )
}

export default TableTabs