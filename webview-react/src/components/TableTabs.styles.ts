import styled from '@emotion/styled'

export const TabsContainer = styled.div`
  display: flex;
  align-items: center;
  padding: 4px 0;
  overflow: visible;
  /* 色は TableTabs コンポーネントで useDynamicTheme() から inline style で設定 */
`;

export const TabsScrollArea = styled.div`
  display: flex;
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;

  scrollbar-width: thin;
  scrollbar-color: var(--vscode-scrollbarSlider-background, rgba(90, 93, 94, 0.31)) transparent;

  &::-webkit-scrollbar { height: 8px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: var(--vscode-scrollbarSlider-background, rgba(90, 93, 94, 0.31));
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--vscode-scrollbarSlider-hoverBackground, rgba(90, 93, 94, 0.50));
  }
`;

export const TabButton = styled.button`
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  font-size: var(--vscode-font-size, 14px);
  font-family: var(--vscode-font-family, 'Consolas', 'Monaco', 'Courier New', monospace);
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 背景・文字色・ボーダーは inline style で設定 */
`;

export const HamburgerButton = styled.button`
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px 8px;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.15s ease, background-color 0.15s ease;
  border-radius: 3px;
  /* 文字色は inline style で設定 */

  &:hover {
    opacity: 1;
    background-color: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground, rgba(255,255,255,0.08)));
  }

  &:active {
    background-color: var(--vscode-toolbar-activeBackground, rgba(255,255,255,0.14));
  }
`;

/* DropdownMenu・Tooltip は createPortal で document.body に描画されるため
   CSS 変数の継承に頼らず、useDynamicTheme() で取得した値を inline style で渡す */

export const DropdownMenu = styled.ul<{ top?: number; bottom?: number; left: number }>`
  position: fixed;
  ${props => props.top    !== undefined ? `top: ${props.top}px;`       : ''}
  ${props => props.bottom !== undefined ? `bottom: ${props.bottom}px;` : ''}
  left: ${props => props.left}px;
  z-index: 9999;
  border-radius: 4px;
  margin: 0;
  padding: 4px 0;
  list-style: none;
  min-width: 180px;
  max-width: 320px;
  max-height: 320px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  font-size: var(--vscode-font-size, 13px);
  font-family: var(--vscode-font-family, sans-serif);
  /* 背景・文字色・枠線は inline style で設定 */

  scrollbar-width: thin;
  scrollbar-color: var(--vscode-scrollbarSlider-background, rgba(90, 93, 94, 0.31)) transparent;
`;

export const DropdownItem = styled.li<{ active: boolean }>`
  padding: 6px 14px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* active/hover の背景・色は main.tsx が document.documentElement に設定した CSS 変数を利用 */
  background-color: ${props =>
    props.active ? 'var(--vscode-menu-selectionBackground, #094771)' : 'transparent'};
  color: ${props =>
    props.active ? 'var(--vscode-menu-selectionForeground, #ffffff)' : 'inherit'};

  &:hover {
    background-color: var(--vscode-menu-selectionBackground, rgba(255,255,255,0.08));
    color: var(--vscode-menu-selectionForeground, inherit);
  }
`;

export const Tooltip = styled.div<{ top: number; left: number }>`
  position: fixed;
  top: ${props => props.top}px;
  left: ${props => props.left}px;
  transform: translateX(-50%);
  z-index: 9999;
  border-radius: 3px;
  padding: 4px 8px;
  font-size: 12px;
  font-family: var(--vscode-font-family, sans-serif);
  white-space: nowrap;
  pointer-events: none;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  /* 背景・文字色・枠線は inline style で設定 */
`;

export const BottomChrome = styled.div`
  margin-top: auto;
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-top: 1px solid var(--vscode-terminal-tab-activeBorder, #3e3e42);
`
