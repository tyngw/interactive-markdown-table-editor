import { TableData } from '../types'

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
  if (tables.length <= 1) {
    return null
  }

  return (
    <div className="table-tabs">
  {tables.map((_, index) => (
        <button
          key={index}
          className={`tab-button ${index === currentTableIndex ? 'active' : ''}`}
          onClick={() => {
            onTabChange(index)
          }}
        >
          表 {index + 1}
        </button>
      ))}
    </div>
  )
}

export default TableTabs