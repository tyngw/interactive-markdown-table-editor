// このモジュールはテーマ設定の適用と関連イベント監視を担当する。
// 担当: 設定変更や VS Code テーマ変更時に Webview へ CSS 変数を配信する。
import * as vscode from 'vscode';
import { buildThemeVariablesCss, getInstalledColorThemes } from '../themeUtils';
import { WebviewManager } from '../webviewManager';
import { error, info } from '../logging';

export class ThemeApplier {
    constructor(private readonly webviewManager: WebviewManager) {}

    public async applyConfiguredThemeToPanels(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('markdownTableEditor');
            const selectedTheme = config.get<string>('theme', 'inherit');
            info(`[Extension] Applying theme: "${selectedTheme}"`);
            const themeVars = await buildThemeVariablesCss(selectedTheme);
            const activeCount = this.webviewManager.communicationManagerCount;
            info(`[Extension] Broadcasting applyThemeVariables to ${activeCount} communication managers`);
            this.webviewManager.broadcastNotification('applyThemeVariables', { cssText: themeVars.cssText });
        } catch (err) {
            error('[Extension] Theme application failed:', err);
        }
    }

    public registerWatchers(context: vscode.ExtensionContext): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration(async (e) => {
            if (e.affectsConfiguration('markdownTableEditor.theme')) {
                await this.applyConfiguredThemeToPanels();
            }
        });

        const colorThemeWatcher = vscode.window.onDidChangeActiveColorTheme(async () => {
            await this.applyConfiguredThemeToPanels();
        });

        context.subscriptions.push(configWatcher, colorThemeWatcher);
    }

    public async showThemePicker(): Promise<void> {
        const themes = getInstalledColorThemes();
        const items: vscode.QuickPickItem[] = [
            { label: `$(color-mode) ${vscode.l10n.t('selectTheme.inherit')}`, description: 'inherit' }
        ].concat(
            themes.map(t => ({ label: t.label, description: t.id }))
        );
        const picked = await vscode.window.showQuickPick(items, {
            placeHolder: vscode.l10n.t('selectTheme.placeholder'),
            matchOnDescription: true
        });
        if (!picked) {return;}
        const themeId = picked.description === 'inherit' ? 'inherit' : picked.description || 'inherit';
        await vscode.workspace.getConfiguration('markdownTableEditor').update('theme', themeId, true);
        await this.applyConfiguredThemeToPanels();
        vscode.window.showInformationMessage(vscode.l10n.t('selectTheme.updated'));
    }
}