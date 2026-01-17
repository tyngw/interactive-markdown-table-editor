/**
 * theme.ts
 * VSCodeテーマ変数を型安全に管理するテーマシステム
 */

/**
 * VSCodeテーマ変数の型定義
 */
export interface VSCodeTheme {
  // エディター
  editorBackground: string
  editorForeground: string
  editorLineHighlightBackground: string
  editorHoverHighlightBackground: string
  editorSelectionHighlightBackground: string

  // フォーカス
  focusBorder: string

  // ボタン
  buttonBackground: string
  buttonForeground: string
  buttonHoverBackground: string
  buttonSecondaryBackground: string
  buttonSecondaryForeground: string
  buttonSecondaryHoverBackground: string

  // 入力
  inputBackground: string
  inputForeground: string
  inputBorder: string
  inputPlaceholderForeground: string
  inputOptionActiveBorder: string

  // リスト
  listHoverBackground: string
  listActiveSelectionBackground: string
  listActiveSelectionForeground: string
  listInactiveSelectionBackground: string
  listFocusBackground: string
  listDropBackground: string

  // パネル
  panelBorder: string
  panelBackground: string

  // サイドバー
  sideBarBackground: string
  sideBarForeground: string

  // ステータスバー
  statusBarBackground: string
  statusBarForeground: string
  statusBarBorder: string
  statusBarProminentForeground: string

  // メニュー
  menuBackground: string
  menuForeground: string
  menuBorder: string
  menuSelectionBackground: string
  menuSelectionForeground: string
  menuSeparatorBackground: string

  // ツールバー
  toolbarHoverBackground: string

  // ウィジェット
  widgetShadow: string
  editorWidgetBackground: string
  editorWidgetBorder: string

  // スクロールバー
  scrollbarSliderBackground: string
  scrollbarSliderHoverBackground: string
  scrollbarSliderActiveBackground: string

  // Git装飾
  gitDecorationAddedForeground: string
  gitDecorationModifiedForeground: string
  gitDecorationDeletedForeground: string

  // チャート色
  chartsGreen: string
  chartsOrange: string
  chartsRed: string

  // エラー・警告
  errorForeground: string
  editorWarningForeground: string
  editorInfoForeground: string

  // 説明テキスト
  descriptionForeground: string
  disabledForeground: string

  // タブ
  tabActiveBackground: string
  tabActiveForeground: string
  tabActiveBorderTop: string
  tabInactiveBackground: string
  tabInactiveForeground: string
  tabHoverBackground: string

  // エディターグループ
  editorGroupHeaderTabsBackground: string
  editorGroupBorder: string

  // 検証
  inputValidationErrorBackground: string
  inputValidationErrorBorder: string

  // フォント
  fontFamily: string
  fontSize: string
  editorFontFamily: string
  editorFontSize: string

  // カスタムフォント設定
  mteFontFamily: string
  mteFontSize: string
}

/**
 * CSS変数からVSCodeテーマを取得
 */
export const getVSCodeTheme = (): VSCodeTheme => {
  const getVar = (name: string, fallback: string = ''): string => {
    if (typeof window === 'undefined') return fallback
    // #mte-root があればそこから取得（テーマスコープが優先），なければ#rootまたはdocumentElementから取得
    // これにより、extension から注入されたテーマ CSS が正確に読み込まれる
    const el = (document.getElementById('mte-root') || document.getElementById('root') || document.documentElement) as HTMLElement
    const value = getComputedStyle(el)
      .getPropertyValue(name)
      .trim() || fallback
    return value
  }

  return {
    // エディター
    editorBackground: getVar('--vscode-editor-background', '#1e1e1e'),
    editorForeground: getVar('--vscode-editor-foreground', '#d4d4d4'),
    editorLineHighlightBackground: getVar('--vscode-editor-lineHighlightBackground', 'rgba(255, 255, 255, 0.04)'),
    editorHoverHighlightBackground: getVar('--vscode-editor-hoverHighlightBackground', 'rgba(38, 79, 120, 0.25)'),
    editorSelectionHighlightBackground: getVar('--vscode-editor-selectionHighlightBackground', 'rgba(38, 79, 120, 0.25)'),

    // フォーカス
    focusBorder: getVar('--vscode-focusBorder', '#007acc'),

    // ボタン
    buttonBackground: getVar('--vscode-button-background', '#0e639c'),
    buttonForeground: getVar('--vscode-button-foreground', '#ffffff'),
    buttonHoverBackground: getVar('--vscode-button-hoverBackground', '#1177bb'),
    buttonSecondaryBackground: getVar('--vscode-button-secondaryBackground', 'rgba(90, 93, 94, 0.31)'),
    buttonSecondaryForeground: getVar('--vscode-button-secondaryForeground', '#ffffff'),
    buttonSecondaryHoverBackground: getVar('--vscode-button-secondaryHoverBackground', 'rgba(90, 93, 94, 0.50)'),

    // 入力
    inputBackground: getVar('--vscode-input-background', '#3c3c3c'),
    inputForeground: getVar('--vscode-input-foreground', '#cccccc'),
    inputBorder: getVar('--vscode-input-border', 'transparent'),
    inputPlaceholderForeground: getVar('--vscode-input-placeholderForeground', '#a6a6a6'),
    inputOptionActiveBorder: getVar('--vscode-inputOption-activeBorder', '#007acc'),

    // リスト
    listHoverBackground: getVar('--vscode-list-hoverBackground', '#2a2d2e'),
    listActiveSelectionBackground: getVar('--vscode-list-activeSelectionBackground', '#094771'),
    listActiveSelectionForeground: getVar('--vscode-list-activeSelectionForeground', '#ffffff'),
    listInactiveSelectionBackground: getVar('--vscode-list-inactiveSelectionBackground', '#37373d'),
    listFocusBackground: getVar('--vscode-list-focusBackground', '#062f4a'),
    listDropBackground: getVar('--vscode-list-dropBackground', '#383b3d'),

    // パネル
    panelBorder: getVar('--vscode-panel-border', '#3e3e42'),
    panelBackground: getVar('--vscode-panel-background', '#1e1e1e'),

    // サイドバー
    sideBarBackground: getVar('--vscode-sideBar-background', '#252526'),
    sideBarForeground: getVar('--vscode-sideBar-foreground', '#cccccc'),

    // ステータスバー
    statusBarBackground: getVar('--vscode-statusBar-background', '#007acc'),
    statusBarForeground: getVar('--vscode-statusBar-foreground', '#ffffff'),
    statusBarBorder: getVar('--vscode-statusBar-border', 'rgba(0, 0, 0, 0.6)'),
    statusBarProminentForeground: getVar('--vscode-statusBarItem-prominentForeground', '#ffffff'),

    // メニュー
    menuBackground: getVar('--vscode-menu-background', '#252526'),
    menuForeground: getVar('--vscode-menu-foreground', '#cccccc'),
    menuBorder: getVar('--vscode-menu-border', '#454545'),
    menuSelectionBackground: getVar('--vscode-menu-selectionBackground', '#094771'),
    menuSelectionForeground: getVar('--vscode-menu-selectionForeground', '#ffffff'),
    menuSeparatorBackground: getVar('--vscode-menu-separatorBackground', '#454545'),

    // ツールバー
    toolbarHoverBackground: getVar('--vscode-toolbar-hoverBackground', 'rgba(90, 93, 94, 0.31)'),

    // ウィジェット
    widgetShadow: getVar('--vscode-widget-shadow', 'rgba(0, 0, 0, 0.36)'),
    editorWidgetBackground: getVar('--vscode-editorWidget-background', '#252526'),
    editorWidgetBorder: getVar('--vscode-editorWidget-border', '#454545'),

    // スクロールバー
    scrollbarSliderBackground: getVar('--vscode-scrollbarSlider-background', 'rgba(90, 93, 94, 0.31)'),
    scrollbarSliderHoverBackground: getVar('--vscode-scrollbarSlider-hoverBackground', 'rgba(90, 93, 94, 0.50)'),
    scrollbarSliderActiveBackground: getVar('--vscode-scrollbarSlider-activeBackground', 'rgba(90, 93, 94, 0.80)'),

    // Git装飾
    gitDecorationAddedForeground: getVar('--vscode-gitDecoration-addedResourceForeground', '#81b88b'),
    gitDecorationModifiedForeground: getVar('--vscode-gitDecoration-modifiedResourceForeground', '#e2c08d'),
    gitDecorationDeletedForeground: getVar('--vscode-gitDecoration-deletedResourceForeground', '#c74e39'),

    // チャート色
    chartsGreen: getVar('--vscode-charts-green', '#89d185'),
    chartsOrange: getVar('--vscode-charts-orange', '#d18616'),
    chartsRed: getVar('--vscode-charts-red', '#f48771'),

    // エラー・警告
    errorForeground: getVar('--vscode-errorForeground', '#f48771'),
    editorWarningForeground: getVar('--vscode-editorWarning-foreground', '#cca700'),
    editorInfoForeground: getVar('--vscode-editorInfo-foreground', '#3794ff'),

    // 説明テキスト
    descriptionForeground: getVar('--vscode-descriptionForeground', '#a6a6a6'),
    disabledForeground: getVar('--vscode-disabledForeground', '#656565'),

    // タブ
    tabActiveBackground: getVar('--vscode-tab-activeBackground', '#1e1e1e'),
    tabActiveForeground: getVar('--vscode-tab-activeForeground', '#ffffff'),
    tabActiveBorderTop: getVar('--vscode-tab-activeBorderTop', '#007acc'),
    tabInactiveBackground: getVar('--vscode-tab-inactiveBackground', 'transparent'),
    tabInactiveForeground: getVar('--vscode-tab-inactiveForeground', '#a6a6a6'),
    tabHoverBackground: getVar('--vscode-tab-hoverBackground', '#2a2d2e'),

    // エディターグループ（正しい CSS 変数名を参照し、フォールバックを確保）
    editorGroupHeaderTabsBackground: getVar('--vscode-editorGroupHeader-tabsBackground', getVar('--vscode-panel-background', '#252526')),
    editorGroupBorder: getVar('--vscode-editorGroup-border', '#3e3e42'),

    // 検証
    inputValidationErrorBackground: getVar('--vscode-inputValidation-errorBackground', '#5a1d1d'),
    inputValidationErrorBorder: getVar('--vscode-inputValidation-errorBorder', '#be1100'),

    // フォント
    fontFamily: getVar('--vscode-font-family', "'Consolas', 'Monaco', 'Courier New', monospace"),
    fontSize: getVar('--vscode-font-size', '14px'),
    editorFontFamily: getVar('--vscode-editor-font-family', "'Consolas', 'Monaco', 'Courier New', monospace"),
    editorFontSize: getVar('--vscode-editor-font-size', '14px'),

    // カスタムフォント設定
    mteFontFamily: getVar('--mte-font-family', getVar('--vscode-editor-font-family', "'Consolas', 'Monaco', 'Courier New', monospace")),
    mteFontSize: getVar('--mte-font-size', getVar('--vscode-editor-font-size', '14px')),
  }
}

/**
 * Emotion Theme型の拡張
 */
declare module '@emotion/react' {
  export interface Theme extends VSCodeTheme {}}