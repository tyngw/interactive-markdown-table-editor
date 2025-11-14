import { useTranslation } from 'react-i18next'

interface SortActionsProps {
  onCommitSort: () => void
  onRestoreOriginal: () => void
}

const SortActions: React.FC<SortActionsProps> = ({
  onCommitSort,
  onRestoreOriginal
}) => {
  const { t } = useTranslation()

  return (
    <div className="sort-actions visible">
      <span className="sort-status-badge">{t('sortActions.viewingSorted')}</span>
      <button className="sort-action-btn secondary" onClick={onRestoreOriginal}>
        {t('sortActions.restoreOriginal')}
      </button>
      <button className="sort-action-btn" onClick={onCommitSort}>
        {t('sortActions.saveSortToFile')}
      </button>
    </div>
  )
}

export default SortActions