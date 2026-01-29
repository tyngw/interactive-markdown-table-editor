// このモジュールは Webview パネルとテーブルマネージャの対応付けを管理し、
// URI からパネルや TableDataManager を解決する共通処理を提供する。
// 担当: エントリ (extension.ts) から責務を分離し、テスト容易性と再利用性を高める。
import * as vscode from 'vscode';
import { TableDataManager } from '../tableDataManager';
import { WebviewManager } from '../webviewManager';

export interface PanelContextResult {
    uri: vscode.Uri | null;
    uriString: string;
    panel: vscode.WebviewPanel | null;
    panelKey?: string;
    tableManagersMap?: Map<number, TableDataManager>;
}

export class PanelSessionManager {
    private readonly activeTableManagers = new Map<string, TableDataManager>();
    private readonly activeMultiTableManagers = new Map<string, Map<number, TableDataManager>>();

    constructor(private readonly webviewManager: WebviewManager) {}

    public normalizeUri(value: unknown): { uri: vscode.Uri | null; uriString: string } {
        if (!value) {
            return { uri: null, uriString: '' };
        }

        if (typeof value === 'string') {
            try {
                const parsed = vscode.Uri.parse(value);
                // URI が妥当か確認（スキーム＆パスの存在を判定）
                if (!parsed.scheme || (parsed.scheme === 'file' && !parsed.path) || value.includes('::')) {
                    return { uri: null, uriString: value };
                }
                return { uri: parsed, uriString: value };
            } catch (error) {
                return { uri: null, uriString: value };
            }
        }

        if (value instanceof vscode.Uri) {
            const uriString = value.toString();
            // URI インスタンスも妥当性チェック
            if (!value.scheme || (value.scheme === 'file' && !value.path) || uriString.includes('::')) {
                return { uri: null, uriString };
            }
            return { uri: value, uriString };
        }

        if (typeof (value as any)?.toString === 'function') {
            const uriString = (value as any).toString();
            try {
                const parsed = vscode.Uri.parse(uriString);
                if (!parsed.scheme || (parsed.scheme === 'file' && !parsed.path) || uriString.includes('::')) {
                    return { uri: null, uriString };
                }
                return { uri: parsed, uriString };
            } catch (error) {
                return { uri: null, uriString };
            }
        }

        return { uri: null, uriString: '' };
    }

    public resolvePanelContext(uriValue: unknown, panelId?: string): PanelContextResult {
        const { uri, uriString } = this.normalizeUri(uriValue);
        const candidateKeys: string[] = [];

        if (panelId && typeof panelId === 'string' && panelId.length > 0) {
            candidateKeys.push(panelId);
        }

        if (uriString) {
            candidateKeys.push(uriString);
        }

        let resolvedPanel: vscode.WebviewPanel | null = null;
        let resolvedPanelKey: string | undefined = undefined;

        for (const key of candidateKeys) {
            const candidatePanel = this.webviewManager.getPanel(key);
            if (candidatePanel) {
                resolvedPanel = candidatePanel;
                resolvedPanelKey = key;
                break;
            }
        }

        if (!resolvedPanel && candidateKeys.length > 0) {
            resolvedPanelKey = candidateKeys[0];
        }

        let tableManagersMap: Map<number, TableDataManager> | undefined;

        if (resolvedPanelKey) {
            tableManagersMap = this.activeMultiTableManagers.get(resolvedPanelKey);
        }

        if (!tableManagersMap) {
            for (const key of candidateKeys) {
                const candidateMap = this.activeMultiTableManagers.get(key);
                if (candidateMap) {
                    tableManagersMap = candidateMap;
                    resolvedPanelKey = key;
                    break;
                }
            }
        }

        return {
            uri,
            uriString,
            panel: resolvedPanel,
            panelKey: resolvedPanelKey,
            tableManagersMap
        };
    }

    public setManagers(panelKey: string, tableManagersMap: Map<number, TableDataManager>): void {
        this.activeMultiTableManagers.set(panelKey, tableManagersMap);
        const primaryManager = tableManagersMap.get(0);
        if (primaryManager) {
            this.activeTableManagers.set(panelKey, primaryManager);
        }
    }

    public getManagers(panelKey: string): Map<number, TableDataManager> | undefined {
        return this.activeMultiTableManagers.get(panelKey);
    }

    public getPanelAndManagers(panelKey: string): { panel: vscode.WebviewPanel | null; managers?: Map<number, TableDataManager> } {
        const panel = this.webviewManager.getPanel(panelKey);
        const managers = this.activeMultiTableManagers.get(panelKey);
        return { panel, managers };
    }

    public clearAll(): void {
        this.activeMultiTableManagers.clear();
        this.activeTableManagers.clear();
    }
}