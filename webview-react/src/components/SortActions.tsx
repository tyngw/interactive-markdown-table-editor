interface SortActionsProps {
  onCommitSort: () => void
  onRestoreOriginal: () => void
}

const SortActions: React.FC<SortActionsProps> = ({
  onCommitSort,
  onRestoreOriginal
}) => {
  return (
    <div className="sort-actions visible">
      <span className="sort-status-badge">📊 Viewing sorted data</span>
      <button className="sort-action-btn secondary" onClick={onRestoreOriginal}>
        📄 Restore Original
      </button>
      <button className="sort-action-btn" onClick={onCommitSort}>
        💾 Save Sort to File
      </button>
    </div>
  )
}

export default SortActions