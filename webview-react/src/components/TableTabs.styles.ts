import styled from '@emotion/styled'

export const TabsContainer = styled.div`
  display: flex;
  align-items: center;
  border-top: 1px solid var(--vscode-panel-border, #3e3e42);
  background-color: var(--vscode-panel-background, #252526);
  padding: 4px 0;
  overflow: visible;
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

export const TabButton = styled.button<{ active: boolean }>`
  background: ${props =>
    props.active
      ? 'var(--vscode-tab-activeBackground, #1e1e1e)'
      : 'var(--vscode-tab-inactiveBackground, transparent)'};
  border: none;
  padding: 8px 16px;
  cursor: pointer;
  color: ${props =>
    props.active
      ? 'var(--vscode-foreground, #ffffff)'
      : 'var(--vscode-tab-inactiveForeground, #a6a6a6)'};
  border-bottom: 2px solid ${props =>
    props.active ? 'var(--tab-border-top-color, #007acc)' : 'transparent'};
  font-size: var(--vscode-font-size, 14px);
  font-family: var(--vscode-font-family, 'Consolas', 'Monaco', 'Courier New', monospace);
  white-space: nowrap;
  transition: all 0.2s ease;
  flex-shrink: 0;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const HamburgerButton = styled.button`
  flex-shrink: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--vscode-foreground, #cccccc);
  padding: 6px 8px;
  font-size: 16px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.7;
  transition: opacity 0.15s ease, background-color 0.15s ease;

  &:hover {
    opacity: 1;
    background-color: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground, rgba(255,255,255,0.08)));
    border-radius: 4px;
  }

  &:active {
    background-color: var(--vscode-toolbar-activeBackground, rgba(255,255,255,0.14));
  }
`;

/* ドロップダウン・ツールチップは createPortal で document.body に描画 */

export const DropdownMenu = styled.ul<{ top?: number; bottom?: number; left: number }>`
  position: fixed;
  ${props => props.top    !== undefined ? `top: ${props.top}px;`       : ''}
  ${props => props.bottom !== undefined ? `bottom: ${props.bottom}px;` : ''}
  left: ${props => props.left}px;
  z-index: 9999;
  background-color: var(--vscode-menu-background, var(--vscode-panel-background, #252526));
  color: var(--vscode-menu-foreground, var(--vscode-foreground, #cccccc));
  border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border, #454545));
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

  scrollbar-width: thin;
  scrollbar-color: var(--vscode-scrollbarSlider-background, rgba(90, 93, 94, 0.31)) transparent;
`;

export const DropdownItem = styled.li<{ active: boolean }>`
  padding: 6px 14px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background-color: ${props =>
    props.active ? 'var(--vscode-menu-selectionBackground, var(--vscode-list-activeSelectionBackground, #094771))' : 'transparent'};
  color: ${props =>
    props.active ? 'var(--vscode-menu-selectionForeground, var(--vscode-list-activeSelectionForeground, #ffffff))' : 'inherit'};

  &:hover {
    background-color: var(--vscode-menu-selectionBackground, var(--vscode-list-hoverBackground, rgba(255,255,255,0.08)));
    color: var(--vscode-menu-selectionForeground, var(--vscode-foreground, #cccccc));
  }
`;

export const Tooltip = styled.div<{ top: number; left: number }>`
  position: fixed;
  top: ${props => props.top}px;
  left: ${props => props.left}px;
  transform: translateX(-50%);
  z-index: 9999;
  background-color: var(--vscode-editorHoverWidget-background, var(--vscode-panel-background, #252526));
  color: var(--vscode-editorHoverWidget-foreground, var(--vscode-foreground, #cccccc));
  border: 1px solid var(--vscode-editorHoverWidget-border, var(--vscode-panel-border, #454545));
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
`;

export const BottomChrome = styled.div`
  margin-top: auto;
  display: flex;
  flex-direction: column;
  background-color: var(--vscode-editor-background, #1e1e1e);
  border-top: 1px solid var(--vscode-terminal-tab-activeBorder, #3e3e42);
`
