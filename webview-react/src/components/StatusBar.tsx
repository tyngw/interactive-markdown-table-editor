import { useStatus } from '../contexts/StatusContext'
import { useTheme } from '../contexts/ThemeContext'

const StatusBar: React.FC = () => {
  const { status, tableInfo, saveStatus, sortState } = useStatus()
  const { getStyle } = useTheme()

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className="status-item" id="statusSelection">
          <span className={`save-indicator ${saveStatus ?? 'saved'}`}>
            {saveStatus === 'saving' && '⏳ Saving...'}
            {saveStatus === 'error' && '❌ Error'}
            {(!saveStatus || saveStatus === 'saved') && '✓ Auto-saved'}
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
            <span className="status-message info">📊 表示順序はソートされています</span>
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
              {tableInfo.rows} rows × {tableInfo.columns} columns
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default StatusBar