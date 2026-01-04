/**
 * シンプルな共通ロガー
 * - `debug` は開発モードまたは `MTE_KEEP_CONSOLE=1`/`DEBUG=true` のときのみ出力
 * - `info/warn/error` は通常通り出力
 */
const env = typeof process !== 'undefined' ? (process.env || {}) : {};
const keepConsole = Boolean(
  env.NODE_ENV === 'development' ||
  env.MTE_KEEP_CONSOLE === '1' ||
  env.MTE_KEEP_CONSOLE === 'true' ||
  env.DEBUG === 'true'
);

export function debug(...args: any[]) {
  if (keepConsole) {
    // debug は console.log を利用
    // tslint:disable-next-line:no-console
    console.log(...args);
  }
}

export function info(...args: any[]) {
  // tslint:disable-next-line:no-console
  console.log(...args);
}

export function warn(...args: any[]) {
  // tslint:disable-next-line:no-console
  console.warn(...args);
}

export function error(...args: any[]) {
  // tslint:disable-next-line:no-console
  console.error(...args);
}

export default {
  debug,
  info,
  warn,
  error
};
