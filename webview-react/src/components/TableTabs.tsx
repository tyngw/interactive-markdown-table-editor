import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()

  console.log('[MTE][TableTabs] Render with tables:', {
    tablesLength: tables.length,
    currentTableIndex,
    tableHeaders: tables.map((t, i) => ({ index: i, headers: t.headers?.slice(0, 2) }))
  })

  if (tables.length <= 1) {
    console.log('[MTE][TableTabs] Skipping render - tables.length <= 1')
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
          {t('tableTabs.tableLabel', { index: index + 1 })}
        </button>
      ))}
    </div>
  )
}

export default TableTabs