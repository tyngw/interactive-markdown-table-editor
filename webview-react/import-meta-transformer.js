/**
 * import-meta-transformer.js
 * ts-jestをラップして、import.meta を Jest (CommonJS) で動作する形に変換するカスタムトランスフォーマー
 * ts-jest がTypeScriptをコンパイルした後、出力JSの import.meta を process.env ベースの式に置換する
 */
const { TsJestTransformer } = require('ts-jest')

class ImportMetaTransformer extends TsJestTransformer {
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
