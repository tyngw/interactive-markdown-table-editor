import { useTranslation } from 'react-i18next'
import { useStatus } from '../contexts/StatusContext'
import { useTheme } from '../contexts/ThemeContext'

const StatusBar: React.FC = () => {
  const { t } = useTranslation()
  const { status, tableInfo, saveStatus, sortState } = useStatus()
  const { getStyle } = useTheme()

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className="status-item" id="statusSelection">
          <span className={`save-indicator ${saveStatus ?? 'saved'}`}>
            {saveStatus === 'saving' && `⏳ ${t('statusBar.saving')}`}
            {saveStatus === 'error' && `❌ ${t('statusBar.error')}`}
            {(!saveStatus || saveStatus === 'saved') && `✓ ${t('statusBar.saved')}`}
          </span>
          {status.selection && (
            <span className="status-selection">
              {status.selection}
            </span>
          )}
        </div>
      </div>
      <div className="status-center">
        <div className="status-message" id="statusMessage">
          {sortState?.direction !== 'none' && (
            <span className="status-message info">📊 {t('statusBar.sorted')}</span>
          )}
          {status.message && (
            <span className={`status-message ${status.type}`}>
              {status.message}
            </span>
          )}
        </div>
      </div>
      <div className="status-right">
        <div className="status-item" id="statusInfo">
          {tableInfo && (
            <span>
              {t('statusBar.rowsColumns', { rows: tableInfo.rows, columns: tableInfo.columns })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatusBar