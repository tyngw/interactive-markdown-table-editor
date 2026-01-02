import { useTranslation } from 'react-i18next'
import { useStatus } from '../contexts/StatusContext'
import {
  StatusBarContainer,
  StatusSection,
  StatusItem,
  SaveIndicator,
  GitDiffButton,
  StatusSelection,
  StatusMessage,
} from './StatusBar.styles'

interface StatusBarProps {
  showGitDiff?: boolean
  sortState?: { column: number; direction: 'asc' | 'desc' | 'none' }
  onGitDiffToggle?: (show: boolean) => void
}

const StatusBar: React.FC<StatusBarProps> = ({ showGitDiff = false, sortState: propSortState, onGitDiffToggle }) => {
  const { t } = useTranslation()
  const { status, tableInfo, saveStatus, sortState: contextSortState } = useStatus()
  const displaySortState = propSortState || contextSortState

  return (
    <StatusBarContainer data-testid="mte-status-bar">
      <StatusSection align="left">
        <StatusItem id="statusSelection">
          <SaveIndicator status={saveStatus ?? 'saved'}>
            {saveStatus === 'saving' && `⏳ ${t('statusBar.saving')}`}
            {saveStatus === 'error' && `❌ ${t('statusBar.error')}`}
            {(!saveStatus || saveStatus === 'saved') && `✓ ${t('statusBar.saved')}`}
          </SaveIndicator>
          <GitDiffButton
            active={showGitDiff}
            onClick={() => onGitDiffToggle?.(!showGitDiff)}
            title={t('statusBar.toggleGitDiff') || 'Toggle Git Diff'}
            aria-label="Git Diff"
          >
            {showGitDiff ? '✓ Diff' : '- Diff'}
          </GitDiffButton>
          {status.selection && (
            <StatusSelection>
              {status.selection}
            </StatusSelection>
          )}
        </StatusItem>
      </StatusSection>
      <StatusSection align="center">
        <div id="statusMessage">
          {displaySortState?.direction !== 'none' && !showGitDiff && (
            <StatusMessage messageType="info">📊 {t('statusBar.sorted')}</StatusMessage>
          )}
          {status.message && (
            <StatusMessage messageType={status.type}>
              {status.message}
            </StatusMessage>
          )}
        </div>
      </StatusSection>
      <StatusSection align="right">
        <StatusItem id="statusInfo">
          {tableInfo && (
            <span>
              {t('statusBar.rowsColumns', { rows: tableInfo.rows, columns: tableInfo.columns })}
            </span>
          )}
        </StatusItem>
      </StatusSection>
    </StatusBarContainer>
  )
}

export default StatusBar