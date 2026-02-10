#!/usr/bin/env node

/**
 * カバレッジレポート生成スクリプト
 * Webview React側のカバレッジデータを読み込み、
 * PRコメント用のマークダウンレポートを生成します
 */

const fs = require('fs');
const path = require('path');

function generateCoverageReport() {
  const coverageDir = path.join(__dirname, '../../webview-react/coverage');
  const coverageSummaryPath = path.join(coverageDir, 'coverage-summary.json');

  let report = '## 📊 カバレッジレポート\n\n';

  if (fs.existsSync(coverageSummaryPath)) {
    try {
      const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
      const total = coverageSummary.total;

      if (total) {
        // カバレッジ率の表示
        const lines = total.lines.pct || 0;
        const statements = total.statements.pct || 0;
        const functions = total.functions.pct || 0;
        const branches = total.branches.pct || 0;

        report += '### 全体のカバレッジ率\n\n';
        report += `| 種別 | カバレッジ率 |\n`;
        report += `|------|----------|\n`;
        report += `| Statements | ${statements}% |\n`;
        report += `| Branches   | ${branches}% |\n`;
        report += `| Functions  | ${functions}% |\n`;
        report += `| Lines      | ${lines}% |\n\n`;

        // 詳細ファイルへのリンク
        report += '### 詳細\n\n';
        report += `[カバレッジ詳細レポートを表示](../../actions/runs/${process.env.GITHUB_RUN_ID})\n\n`;

        // カバレッジ率の判定
        const avgCoverage = (lines + statements + functions + branches) / 4;
        if (avgCoverage >= 80) {
          report = '✅ ' + report;
        } else if (avgCoverage >= 60) {
          report = '⚠️ ' + report;
        } else {
          report = '❌ ' + report;
        }
      }
    } catch (e) {
      console.error('カバレッジサマリーの解析に失敗しました:', e.message);
      report += '⚠️ カバレッジレポートの解析に失敗しました\n\n';
    }
  } else {
    report += '⚠️ カバレッジレポートが見つかりません\n\n';
    report += 'テストが正常に実行されているか確認してください。\n\n';
  }

  // レポートをファイルに保存
  const outputPath = path.join(__dirname, '../coverage-report.md');
  fs.writeFileSync(outputPath, report);
  console.log(`カバレッジレポートを生成しました: ${outputPath}`);
}

generateCoverageReport();
