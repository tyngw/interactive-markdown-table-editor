import * as vscode from 'vscode';

export interface ThemeVariables {
  cssText: string;
}

export interface InstalledThemeInfo {
  id: string; // `${extensionId}:${relativePath}`
  label: string; // theme label
  uiTheme?: string; // vs, vs-dark, hc-black
  extensionId: string;
  themePath: vscode.Uri;
}

/**
 * インストール済みのカラーテーマ一覧を取得
 */
export function getInstalledColorThemes(): InstalledThemeInfo[] {
  const themes: InstalledThemeInfo[] = [];
  for (const ext of vscode.extensions.all) {
    const contributes = (ext.packageJSON && ext.packageJSON.contributes) || {};
    const themeEntries = contributes.themes as Array<any> | undefined;
    if (!Array.isArray(themeEntries)) continue;
    for (const t of themeEntries) {
      try {
        const label: string = t.label || t.id || t.name || 'Unnamed Theme';
        const relPath: string = t.path;
        if (!relPath) continue;
        const themeUri = vscode.Uri.joinPath(ext.extensionUri, relPath);
        const id = `${ext.id}:${relPath}`;
        themes.push({ id, label, uiTheme: t.uiTheme, extensionId: ext.id, themePath: themeUri });
      } catch {
        // ignore
      }
    }
  }
  // 重複を簡易排除（id基準）
  const seen = new Set<string>();
  return themes.filter(t => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}

/**
 * 指定テーマIDからテーマファイルを探す
 */
export function findThemeById(themeId: string): InstalledThemeInfo | undefined {
  const [extId, ...rest] = themeId.split(':');
  const relPath = rest.join(':');
  for (const ext of vscode.extensions.all) {
    if (ext.id !== extId) continue;
    const contributes = (ext.packageJSON && ext.packageJSON.contributes) || {};
    const themeEntries = contributes.themes as Array<any> | undefined;
    if (!Array.isArray(themeEntries)) continue;
    for (const t of themeEntries) {
      if (t.path === relPath) {
        return {
          id: themeId,
          label: t.label || t.id || t.name || 'Unnamed Theme',
          uiTheme: t.uiTheme,
          extensionId: ext.id,
          themePath: vscode.Uri.joinPath(ext.extensionUri, relPath)
        };
      }
    }
  }
  return undefined;
}

/**
 * テーマJSONの colors から CSS 変数 (--vscode-*) を組み立て
 */
async function buildCssFromThemeColors(themeUri: vscode.Uri): Promise<string> {
  try {
    const bytes = await vscode.workspace.fs.readFile(themeUri);
    const json = JSON.parse(Buffer.from(bytes).toString('utf8'));
    const colors = json.colors || {};
    const entries: string[] = [];
    for (const key of Object.keys(colors)) {
      const val = colors[key];
      if (typeof val !== 'string') continue;
      // VS Code Webview の CSS 変数名に合わせる（. を - に置換）
      const varName = `--vscode-${key.replace(/\./g, '-')}`;
      entries.push(`${varName}:${val}`);
    }
    return entries.length ? `:root{${entries.join(';')}}` : '';
  } catch {
    return '';
  }
}

/**
 * 選択テーマID（または inherit）からWebviewに注入するCSSを構築
 */
export async function buildThemeVariablesCss(selectedThemeId: string | undefined): Promise<ThemeVariables> {
  const choice = selectedThemeId ?? 'inherit';
  if (choice === 'inherit') {
    return { cssText: '' };
  }
  const theme = findThemeById(choice);
  if (!theme) {
    return { cssText: '' };
  }
  const css = await buildCssFromThemeColors(theme.themePath);
  // CSSが空なら簡易フォールバック
  if (css && css.trim().length > 0) return { cssText: css };

  const themeKind = vscode.window.activeColorTheme.kind;
  const isDark = themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast;
  const fallback = isDark
    ? `:root{--vscode-editor-background:#1e1e1e;--vscode-foreground:#cccccc;--vscode-panel-border:#3c3c3c;--vscode-focusBorder:#007acc;--vscode-list-hoverBackground:#2a2d2e;--vscode-editor-lineHighlightBackground:#2a2d2e;--vscode-descriptionForeground:#9d9d9d;--vscode-input-background:#3c3c3c;--vscode-inputOption-activeBorder:#007acc;--vscode-list-activeSelectionBackground:#094771;--vscode-list-activeSelectionForeground:#ffffff;}`
    : `:root{--vscode-editor-background:#ffffff;--vscode-foreground:#333333;--vscode-panel-border:#e5e5e5;--vscode-focusBorder:#007acc;--vscode-list-hoverBackground:#f2f2f2;--vscode-editor-lineHighlightBackground:#f7f7f7;--vscode-descriptionForeground:#6e6e6e;--vscode-input-background:#f3f3f3;--vscode-inputOption-activeBorder:#007acc;--vscode-list-activeSelectionBackground:#0078d4;--vscode-list-activeSelectionForeground:#ffffff;}`;
  return { cssText: fallback };
}

/**
 * Webviewにインラインstyleとして注入する <style>...</style> HTMLを生成
 */
export function createThemeStyleTag(theme: ThemeVariables): string {
  if (!theme.cssText) return '';
  const nonce = Date.now().toString();
  return `<style id="mte-theme-override" nonce="${nonce}">${theme.cssText}</style>`;
} 