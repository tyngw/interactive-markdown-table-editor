import { useStatus } from '../contexts/StatusContext'
import { useTheme } from '../contexts/ThemeContext'

const StatusBar: React.FC = () => {
  const { status, tableInfo, saveStatus } = useStatus()
  const { getStyle } = useTheme()

  return (
    <div className="status-bar">
      <div className="status-left">
        <div className="status-item" id="statusSelection">
          {saveStatus && (
            <span className={`save-indicator ${saveStatus}`}>
              {saveStatus === 'saved' && '✓ Saved'}
              {saveStatus === 'saving' && '⏳ Saving...'}
              {saveStatus === 'error' && '❌ Error'}
            </span>
          )}
          {status.selection && (
            <span className="status-selection">
              {status.selection}
            </span>
          )}
        </div>
      </div>
      <div className="status-center">
        <div className="status-message" id="statusMessage">
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