import * as vscode from 'vscode';
import { debug, warn } from './logging';

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
 * @param extensionList テスト用の拡張機能リスト（省略時は vscode.extensions.all を使用）
 */
export function getInstalledColorThemes(extensionList?: readonly vscode.Extension<any>[]): InstalledThemeInfo[] {
  const themes: InstalledThemeInfo[] = [];
  const extensions = extensionList ?? vscode.extensions.all;
  for (const ext of extensions) {
    const contributes = (ext.packageJSON && ext.packageJSON.contributes) || {};
    const themeEntries = contributes.themes as Array<any> | undefined;
    if (!Array.isArray(themeEntries)) {continue;}
    for (const t of themeEntries) {
      try {
        const label: string = t.label || t.id || t.name || 'Unnamed Theme';
        const relPath: string = t.path;
        if (!relPath) {continue;}
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
 * @param extensionList テスト用の拡張機能リスト（省略時は vscode.extensions.all を使用）
 */
export function findThemeById(themeId: string, extensionList?: readonly vscode.Extension<any>[]): InstalledThemeInfo | undefined {
  const [extId, ...rest] = themeId.split(':');
  const relPath = rest.join(':');
  const extensions = extensionList ?? vscode.extensions.all;
  for (const ext of extensions) {
    if (ext.id !== extId) {continue;}
    const contributes = (ext.packageJSON && ext.packageJSON.contributes) || {};
    const themeEntries = contributes.themes as Array<any> | undefined;
    if (!Array.isArray(themeEntries)) {continue;}
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
 * テーマJSONをロード（include ディレクティブに対応）
 */
async function loadThemeJson(themeUri: vscode.Uri): Promise<Record<string, any>> {
  const bytes = await vscode.workspace.fs.readFile(themeUri);
  const json = JSON.parse(Buffer.from(bytes).toString('utf8'));
  
  // include ディレクティブがある場合、インクルードされたテーマもロード
    if (json.include) {
    const themeDir = vscode.Uri.joinPath(themeUri, '..');
    const includeUri = vscode.Uri.joinPath(themeDir, json.include);
    debug(`[themeUtils] Theme includes: ${json.include}, resolving to ${includeUri.toString()}`);
    try {
      const includeBytes = await vscode.workspace.fs.readFile(includeUri);
      const includeJson = JSON.parse(Buffer.from(includeBytes).toString('utf8'));
      // colors を統合（include されたテーマが優先）
      const mergedColors = { ...includeJson.colors, ...json.colors };
      json.colors = mergedColors;
      debug(`[themeUtils] Merged colors from included theme, total colors: ${Object.keys(mergedColors).length}`);
    } catch (error) {
      warn(`[themeUtils] Failed to load included theme: ${error}`);
    }
  }
  
  return json;
}

/**
 * テーマJSONの colors から CSS 変数 (--vscode-*) を組み立て
 */
async function buildCssFromThemeColors(themeUri: vscode.Uri): Promise<string> {
  try {
    debug(`[themeUtils] Reading theme file from: ${themeUri.toString()}`);
    const json = await loadThemeJson(themeUri);
    
    // theme JSONの構造をデバッグ出力
    const topLevelKeys = Object.keys(json);
    debug(`[themeUtils] Theme JSON top-level keys: ${topLevelKeys.join(', ')}`);
    
    const colors = json.colors || {};
    debug(`[themeUtils] Successfully loaded theme colors from ${themeUri.toString()}, found ${Object.keys(colors).length} colors`);
    
    if (Object.keys(colors).length === 0) {
      debug(`[themeUtils] No colors found in theme JSON. Checking if colors is under a different key...`);
      debug(`[themeUtils] JSON keys available:`, topLevelKeys);
      
      // セマンティックトークンカラーから基本的な色を抽出してみる
      if (json.semanticTokenColors) {
        debug(`[themeUtils] Found semanticTokenColors, but preferring colors object. Theme may need include processing.`);
      }
    }
    
  const entries: string[] = [];
    for (const key of Object.keys(colors)) {
      const val = colors[key];
      if (typeof val !== 'string') {continue;}

  // VS Code Webview の CSS 変数名に合わせる（. を - に置換）
      const varName = `--vscode-${key.replace(/\./g, '-')}`;
  entries.push(`${varName}:${val}`);
    }
    // 拡張で使用する重要トークンのフォールバック上書きを追加
    const ensure = buildEnsureOverrides(colors);
  
  // CSS変数を:root と Webview 内のルート要素（#root / #mte-root）に同時適用する
  // 古いバンドルでは #root、拡張側で明示的に付与する場合は #mte-root を使うため両方に書き込む
  // #mte-root は優先度を上げるため二重セレクタでも定義する
  const targets = [':root', '#root', '#mte-root', '#mte-root#mte-root'];
  const base = entries.length
    ? targets.map((t) => `${t}{${entries.join(';')}}`).join(';')
    : '';
  const overrides = ensure
    ? targets.map((t) => `${t}{${ensure}}`).join(';')
    : '';
  const result = base + overrides;
    debug(`[themeUtils] Built CSS with ${entries.length} variables and ${ensure ? 'overrides' : 'no overrides'}`);
    debug(`[themeUtils] First 500 chars of CSS: ${result.substring(0, 500)}`);
  return result;
  } catch (err) {
    warn(`[themeUtils] Failed to read theme colors from ${themeUri.toString()}:`, err);
    return '';
  }
}

/**
 * 選択テーマID（または inherit）からWebviewに注入するCSSを構築
 * @param extensionList テスト用の拡張機能リスト（省略時は vscode.extensions.all を使用）
 */
export async function buildThemeVariablesCss(selectedThemeId: string | undefined, extensionList?: readonly vscode.Extension<any>[]): Promise<ThemeVariables> {
  const choice = selectedThemeId ?? 'inherit';
  debug(`[themeUtils] buildThemeVariablesCss called with selectedThemeId: "${selectedThemeId}" (choice: "${choice}")`);
  
  if (choice === 'inherit') {
    debug(`[themeUtils] Theme is set to inherit, returning empty cssText`);
    return { cssText: '' };
  }
  
  const theme = findThemeById(choice, extensionList);
  if (!theme) {
    warn(`[themeUtils] Theme not found for id: ${choice}, returning empty cssText`);
    return { cssText: '' };
  }
  
  debug(`[themeUtils] Found theme: ${theme.label} from extension ${theme.extensionId}`);
  const css = await buildCssFromThemeColors(theme.themePath);
  
  // CSSが正常に生成された場合はそれを使用
  if (css && css.trim().length > 0) {
    debug(`[themeUtils] Successfully built CSS from theme file, cssText length: ${css.length}`);
    return { cssText: css };
  }

  // CSS生成失敗時のフォールバック
  // テーマ ID から光度を推測する（Light, Light+, Dark, Dark+ など）
  // VSCode本体のテーマには依存せず、テーマファイルの特性から判断
  warn(`[themeUtils] Failed to build CSS from theme "${theme.label}", using theme-based fallback`);
  const isDark = !theme.label.toLowerCase().includes('light');
  const vars = isDark
    ? '--vscode-editor-background:#1e1e1e;--vscode-foreground:#cccccc;--vscode-panel-border:#3c3c3c;--vscode-focusBorder:#007acc;--vscode-list-hoverBackground:#2a2d2e;--vscode-editor-lineHighlightBackground:#2a2d2e;--vscode-descriptionForeground:#9d9d9d;--vscode-input-background:#3c3c3c;--vscode-inputOption-activeBorder:#007acc;--vscode-list-activeSelectionBackground:#094771;--vscode-list-activeSelectionForeground:#ffffff;'
    : '--vscode-editor-background:#ffffff;--vscode-foreground:#333333;--vscode-panel-border:#e5e5e5;--vscode-focusBorder:#007acc;--vscode-list-hoverBackground:#f2f2f2;--vscode-editor-lineHighlightBackground:#f7f7f7;--vscode-descriptionForeground:#6e6e6e;--vscode-input-background:#f3f3f3;--vscode-inputOption-activeBorder:#007acc;--vscode-list-activeSelectionBackground:#0078d4;--vscode-list-activeSelectionForeground:#ffffff;';
  const fallback = `:root{${vars}}#mte-root{${vars}}`;
  return { cssText: fallback };
}

/**
 * Webviewにインラインstyleとして注入する <style>...</style> HTMLを生成
 */
export function createThemeStyleTag(theme: ThemeVariables): string {
  if (!theme.cssText) {return '';}
  const nonce = Date.now().toString();
  return `<style id="mte-theme-override" data-scope="#mte-root" nonce="${nonce}">${theme.cssText}</style>`;
}

/**
 * 拡張で参照する主要トークンを必ず定義するためのフォールバックを構築
 * - 選択テーマの colors に無い場合、近い意味の色や editor 背景等から埋める
 */
function buildEnsureOverrides(colors: Record<string, string>): string {
  const val = (k: string, alt?: string, alt2?: string) =>
    colors[k] || (alt ? colors[alt] : '') || (alt2 ? colors[alt2] : '') || '';

  // ベース
  const editorBg = colors['editor.background'] || '#ffffff';
  const foreground = colors['foreground'] || '#333333';
  const focusBorder = colors['focusBorder'] || '#007acc';
  const listHover = colors['list.hoverBackground'] || '#f2f2f2';
  const groupTabsBg = val('editorGroupHeader.tabsBackground', 'panelSectionHeader.background') || editorBg;
  const panelHeaderBg = colors['panelSectionHeader.background'] || groupTabsBg;

  // タブ関連（Table Editorのタブに使用）
  const ensure: Record<string, string> = {
    'tab.activeBackground': val('tab.activeBackground') || groupTabsBg,
    'tab.activeForeground': val('tab.activeForeground') || foreground,
    'tab.inactiveBackground': val('tab.inactiveBackground') || panelHeaderBg,
    'tab.inactiveForeground': val('tab.inactiveForeground') || foreground,
    'tab.hoverBackground': val('tab.hoverBackground') || listHover,
    'tab.activeBorderTop': val('tab.activeBorder', 'tab.activeBorderTop') || focusBorder,
    'editorGroupHeader.tabsBackground': groupTabsBg,
    'panelSectionHeader.background': panelHeaderBg,
    'editorWidget.background': val('editorWidget.background') || editorBg
  };

  // 文字列に直す（--vscode-<token>）
  const parts: string[] = [];
  for (const k of Object.keys(ensure)) {
    const v = ensure[k];
    /* istanbul ignore next -- ensureの全エントリにフォールバック値があるため到達不可 */
    if (!v) {continue;}
    parts.push(`--vscode-${k.replace(/\./g, '-')}:${v}`);
  }
  return parts.join(';');
} 