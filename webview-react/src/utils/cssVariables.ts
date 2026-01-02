// cssVariables.ts
// Webview側で受け取った cssText から VS Code 互換のカスタムプロパティを抽出し、
// 指定の要素へインラインスタイルとして適用するユーティリティ。

export function applyCssVariablesInline(cssText: string, target: HTMLElement): number {
  if (!cssText || !target) {
    return 0;
  }

  const regex = /(--vscode-[\w-]+)\s*:\s*([^;}]*)/g;
  let match: RegExpExecArray | null;
  let applied = 0;

  while ((match = regex.exec(cssText)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    if (!value) {
      continue;
    }
    target.style.setProperty(name, value);
    applied += 1;
  }

  return applied;
}
