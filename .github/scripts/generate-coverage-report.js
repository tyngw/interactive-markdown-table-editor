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

  console.log(`[DEBUG] Current directory: ${process.cwd()}`);
  console.log(`[DEBUG] Coverage directory: ${coverageDir}`);
  console.log(`[DEBUG] Coverage summary path: ${coverageSummaryPath}`);
  console.log(`[DEBUG] Coverage directory exists: ${fs.existsSync(coverageDir)}`);
  
  if (fs.existsSync(coverageDir)) {
    const files = fs.readdirSync(coverageDir).filter(f => !f.startsWith('.')).slice(0, 20);
    console.log(`[DEBUG] Files in coverage directory (first 20): ${files.join(', ')}`);
  } else {
    console.error(`[ERROR] Coverage directory does not exist at: ${coverageDir}`);
  }

  let report = '## 📊 カバレッジレポート\n\n';

  if (fs.existsSync(coverageSummaryPath)) {
    try {
      const fileContent = fs.readFileSync(coverageSummaryPath, 'utf8');
      console.log(`[DEBUG] Coverage summary file size: ${fileContent.length} bytes`);
      
      const coverageSummary = JSON.parse(fileContent);
      const total = coverageSummary.total;

      console.log(`[DEBUG] Total coverage data found: ${!!total}`);

      if (total) {
        // カバレッジ率の表示
        const lines = total.lines.pct || 0;
        const statements = total.statements.pct || 0;
        const functions = total.functions.pct || 0;
        const branches = total.branches.pct || 0;

        console.log(`[DEBUG] Coverage rates - Lines: ${lines}%, Statements: ${statements}%, Functions: ${functions}%, Branches: ${branches}%`);

        report += '### 全体のカバレッジ率\n\n';
        report += `| 種別 | カバレッジ率 |\n`;
        report += `|------|----------|\n`;
        report += `| Statements | ${statements}% |\n`;
        report += `| Branches   | ${branches}% |\n`;
        report += `| Functions  | ${functions}% |\n`;
        report += `| Lines      | ${lines}% |\n\n`;

        // カバレッジ率の判定
        const avgCoverage = (lines + statements + functions + branches) / 4;
        let statusIcon = '✅';
        if (avgCoverage < 80) {
          statusIcon = '⚠️';
        }
        if (avgCoverage < 60) {
          statusIcon = '❌';
        }

        // ファイル別カバレッジの詳細
        report += '### ファイル別カバレッジ詳細\n\n';
        
        // ファイル情報を収集してソート
        const fileDetails = [];
        for (const [filePath, coverage] of Object.entries(coverageSummary)) {
          if (filePath === 'total') continue;
          
          const linesCov = coverage.lines.pct || 0;
          const statementsCov = coverage.statements.pct || 0;
          const functionsCov = coverage.functions.pct || 0;
          const branchesCov = coverage.branches.pct || 0;
          const avgFileCov = (linesCov + statementsCov + functionsCov + branchesCov) / 4;
          
          fileDetails.push({
            path: filePath,
            avgCov: avgFileCov,
            lines: linesCov,
            statements: statementsCov,
            functions: functionsCov,
            branches: branchesCov
          });
        }

        // 平均カバレッジでソート（低い順）
        fileDetails.sort((a, b) => a.avgCov - b.avgCov);

        // カバレッジが100%未満のファイルを表示
        const lowCoverageFiles = fileDetails.filter(f => f.avgCov < 100);
        
        if (lowCoverageFiles.length > 0) {
          report += `#### カバレッジが100%未満のファイル (${lowCoverageFiles.length}個)\n\n`;
          report += `| ファイル | Lines | Statements | Functions | Branches | 平均 |\n`;
          report += `|---------|-------|-----------|-----------|----------|------|\n`;
          
          lowCoverageFiles.forEach(file => {
            const displayPath = file.path.replace(/^\/.*\/webview-react\//, '');
            const avg = file.avgCov.toFixed(1);
            const icon = file.avgCov >= 80 ? '✅' : file.avgCov >= 60 ? '⚠️' : '❌';
            report += `| ${icon} ${displayPath} | ${file.lines.toFixed(1)}% | ${file.statements.toFixed(1)}% | ${file.functions.toFixed(1)}% | ${file.branches.toFixed(1)}% | ${avg}% |\n`;
          });
          report += '\n';
        } else {
          report += '#### 🎉 すべてのファイルで100%のカバレッジを達成しています！\n\n';
        }

        // サマリー — 見出し行が先頭に来るよう、ステータスアイコンは見出しの直下に挿入する
        const statusLine = `\n${statusIcon} 平均カバレッジ: ${avgCoverage.toFixed(1)}%\n\n`;
        report = report + statusLine;
      } else {
        console.error('[ERROR] No "total" field found in coverage summary');
        report += '⚠️ カバレッジサマリーの解析に失敗しました（totalフィールドなし）\n\n';
      }
    } catch (e) {
      console.error('カバレッジサマリーの解析に失敗しました:', e.message);
      console.error('Stack:', e.stack);
      report += '⚠️ カバレッジレポートの解析に失敗しました\n\n';
      report += `エラー: ${e.message}\n\n`;
    }
  } else {
    console.error(`[ERROR] Coverage summary file not found at: ${coverageSummaryPath}`);
    report += '⚠️ カバレッジレポートが見つかりません\n\n';
    report += 'テストが正常に実行されているか確認してください。\n\n';
  }

  // レポートをファイルに保存
  const outputPath = path.join(__dirname, '../coverage-report.md');
  fs.writeFileSync(outputPath, report);
  console.log(`[SUCCESS] カバレッジレポートを生成しました: ${outputPath}`);
}

generateCoverageReport();
