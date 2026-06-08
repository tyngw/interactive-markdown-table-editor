export enum GitDiffStatus {
    UNCHANGED = 'unchanged',
    ADDED = 'added',
    MODIFIED = 'modified',
    DELETED = 'deleted'
}

export interface RowGitDiff {
    row: number;
    status: GitDiffStatus;
    oldContent?: string;
    newContent?: string;
    isDeletedRow?: boolean;
    targetRow?: number;
}

export interface TableGitDiff {
    tableIndex: number;
    rows: RowGitDiff[];
}

export interface ColumnPositionChange {
    index: number;
    type: 'added' | 'removed' | 'renamed';
    header?: string;
    confidence: number;
    oldIndex?: number;
    newIndex?: number;
}

export interface ColumnDiffInfo {
    oldColumnCount: number;
    newColumnCount: number;
    addedColumns: number[];
    deletedColumns: number[];
    oldHeaders?: string[];
    newHeaders?: string[];
    changeType?: 'added' | 'removed' | 'mixed' | 'none';
    positions?: ColumnPositionChange[];
    mapping?: number[];
    heuristics?: string[];
}
