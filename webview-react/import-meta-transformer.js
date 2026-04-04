/**
 * import-meta-transformer.js
 * ts-jestをラップして、import.meta を Jest (CommonJS) で動作する形に変換するカスタムトランスフォーマー
 * ts-jest がTypeScriptをコンパイルした後、出力JSの import.meta を process.env ベースの式に置換する
 *
 * ts-jest v29 では _configsFor() が transformOptions.config（Jestプロジェクト設定）を参照する。
 * コンストラクタに渡した tsJestConfig が globals['ts-jest'] にマージされ、
 * diagnostics 抑制や module 設定が正しく適用される。
 */
const { TsJestTransformer } = require('ts-jest')

class ImportMetaTransformer extends TsJestTransformer {
  constructor() {
    // diagnostics: false で TS1343 (import.meta) 等のコンパイルエラーをテスト環境で抑制する
    // ts-jest は module を内部で 'commonjs' に強制するため、module 指定は不要
    super({
      diagnostics: false,
      tsconfig: {
        noUnusedLocals: false,
        noUnusedParameters: false,
      },
    })
  }

  process(sourceText, sourcePath, transformOptions) {
    // まず ts-jest で TypeScript → JavaScript に変換
    const result = super.process(sourceText, sourcePath, transformOptions)
    
    // 変換結果の code 文字列を取得
    const code = typeof result === 'string' ? result : result.code

    // import.meta.env パターンを process.env に置換
    const transformedCode = code
      .replace(/import\.meta\.env\?\.\s*DEV/g, '(process.env.NODE_ENV === "development")')
      .replace(/import\.meta\.env\.\s*DEV/g, '(process.env.NODE_ENV === "development")')
      .replace(/import\.meta\.env/g, '(process.env)')
      .replace(/import\.meta/g, '({ env: process.env })')

    if (typeof result === 'string') {
      return transformedCode
    }
    return { ...result, code: transformedCode }
  }
}

module.exports = new ImportMetaTransformer()
