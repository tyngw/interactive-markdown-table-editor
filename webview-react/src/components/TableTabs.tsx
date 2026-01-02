import { useTranslation } from 'react-i18next'
import { TableData } from '../types'
import { TabsContainer, TabButton } from './TableTabs.styles'

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

  if (tables.length <= 1) {
    return null
  }

  return (
    <TabsContainer data-testid="mte-table-tabs">
      {tables.map((_, index) => (
        <TabButton
          key={index}
          data-testid={`mte-tab-button-${index}`}
          active={index === currentTableIndex}
          onClick={() => {
            onTabChange(index)
          }}
        >
          {t('tableTabs.tableLabel', { index: index + 1 })}
        </TabButton>
      ))}
    </TabsContainer>
  )
}

export default TableTabs