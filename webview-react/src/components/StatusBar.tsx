import { useTranslation } from 'react-i18next'
import { useStatus } from '../contexts/StatusContext'
import { useDynamicTheme } from '../contexts/DynamicThemeContext'
import {
  StatusBarContainer,
  StatusSection,
  StatusItem,
  SaveIndicator,
  GitDiffButton,
  GitDiffIcon,
  GitDiffLabel,
  StatusSelection,
  StatusMessage,
} from './StatusBar.styles'

interface StatusBarProps {
  showGitDiff?: boolean
  sortState?: { column: number; direction: 'asc' | 'desc' | 'none' }
  onGitDiffToggle?: (show: boolean) => void
  autoSaveEnabled?: boolean
  onAutoSaveToggle?: (enabled: boolean) => void
  isDirty?: boolean
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  showGitDiff = false, 
  sortState: propSortState, 
  onGitDiffToggle,
  autoSaveEnabled = true,
  onAutoSaveToggle,
  isDirty = false
}) => {
  const { t } = useTranslation()
  const { status, tableInfo, saveStatus, sortState: contextSortState } = useStatus()
  const { theme } = useDynamicTheme() // DynamicThemeContext から theme を直接取得
  const displaySortState = propSortState || contextSortState

  console.log('[StatusBar] Rendering with props:', {
    showGitDiff,
    propSortState,
    saveStatus,
    displaySortState,
    autoSaveEnabled,
    isDirty,
    themeStatusBarBackground: theme?.statusBarBackground,
    themeStatusBarForeground: theme?.statusBarForeground,
  })

  // StatusBar コンテナの inline style で theme から取得した色を直接適用
  const statusBarStyle = {
    backgroundColor: theme?.statusBarBackground || '#007acc',
    color: theme?.statusBarForeground || '#ffffff',
    borderTopColor: theme?.statusBarBorder || 'transparent',
  }

  const saveIndicatorStyle = {
    color: theme?.statusBarForeground || '#ffffff',
  }

  const gitDiffButtonStyle = {
    color: theme?.statusBarForeground || '#ffffff',
    backgroundColor: 'transparent',
  }

  return (
    <StatusBarContainer data-testid="mte-status-bar" style={statusBarStyle}>
      <StatusSection align="left">
        <StatusItem id="statusSelection">
          <SaveIndicator status={saveStatus ?? 'saved'} style={saveIndicatorStyle} isLoading={saveStatus === 'saving'}>
            {saveStatus === 'saving' ? <span className="mte-loading-spinner" style={{ color: theme?.statusBarForeground || '#ffffff' }} /> : ''}
          </SaveIndicator>
          <GitDiffButton
            active={showGitDiff}
            onClick={() => onGitDiffToggle?.(!showGitDiff)}
            title={t('statusBar.toggleGitDiff') || 'Toggle Git Diff'}
            aria-label="Git Diff"
            style={gitDiffButtonStyle}
          >
            <GitDiffIcon>
              {showGitDiff ? '✓' : '⊘'}
            </GitDiffIcon>
            <GitDiffLabel>Diff</GitDiffLabel>
          </GitDiffButton>
          <GitDiffButton
            active={autoSaveEnabled}
            onClick={() => onAutoSaveToggle?.(!autoSaveEnabled)}
            title={t('statusBar.toggleAutoSave') || 'Toggle Auto Save'}
            aria-label="Auto Save"
            style={gitDiffButtonStyle}
          >
            <GitDiffIcon>
              {autoSaveEnabled ? '✓' : '⊘'}
            </GitDiffIcon>
            <GitDiffLabel>
              {isDirty && !autoSaveEnabled ? 'Save*' : 'Save'}
            </GitDiffLabel>
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