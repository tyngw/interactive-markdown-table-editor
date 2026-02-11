#!/usr/bin/env node

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

  let report = '## 📊 Coverage Report\n\n';

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

        report += '### Overall Coverage Rates\n\n';
        report += `| Type | Coverage Rate |\n`;
        report += `|------|----------|\n`;
        report += `| Statements | ${statements}% |\n`;
        report += `| Branches   | ${branches}% |\n`;
        report += `| Functions  | ${functions}% |\n`;
        report += `| Lines      | ${lines}% |\n\n`;

        // Coverage rate evaluation
        const avgCoverage = (lines + statements + functions + branches) / 4;
        let statusIcon = '✅';
        if (avgCoverage < 80) {
          statusIcon = '⚠️';
        }
        if (avgCoverage < 60) {
          statusIcon = '❌';
        }

        // File-wise coverage details (foldable)
        report += '### File-wise Coverage Details\n\n';
        report += '<details>\n';
        report += '<summary>Details (click to expand)</summary>\n\n';

        // Collect and sort file information
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

        // Sort by average coverage (ascending)
        fileDetails.sort((a, b) => a.avgCov - b.avgCov);

        // Always show per-file results as collapsible sections. Also provide a compact summary table.
        report += `| File | Avg | Lines | Statements | Functions | Branches |\n`;
        report += `|------|-----:|-----:|---------:|---------:|--------:|\n`;
        fileDetails.forEach(file => {
          const displayPath = file.path.replace(/^.*?webview-react\//, '') || file.path;
          const avg = file.avgCov.toFixed(1);
          const icon = file.avgCov >= 80 ? '✅' : file.avgCov >= 60 ? '⚠️' : '❌';
          report += `| ${icon} ${displayPath} | ${avg}% | ${file.lines.toFixed(1)}% | ${file.statements.toFixed(1)}% | ${file.functions.toFixed(1)}% | ${file.branches.toFixed(1)}% |\n`;
        });

        report += '\n';

        // Close foldable section
        report += '</details>\n\n';

        // Append overall status line
        const statusLine = `\n${statusIcon} Average Coverage: ${avgCoverage.toFixed(1)}%\n\n`;
        report = report + statusLine;
      } else {
        console.error('[ERROR] No "total" field found in coverage summary');
        report += '❌ Failed to parse coverage summary (no "total" field)\n\n';
      }
    } catch (e) {
      console.error('Failed to parse coverage summary:', e.message);
      console.error('Stack:', e.stack);
      report += '❌ Failed to parse coverage report\n\n';
      report += `Error: ${e.message}\n\n`;
    }
  } else {
    console.error(`[ERROR] Coverage summary file not found at: ${coverageSummaryPath}`);
    report += '⚠️ Coverage report not found\n\n';
    report += 'Please ensure that the tests are running correctly.\n\n';
  }

  // Save the report to a file
  const outputPath = path.join(__dirname, '../coverage-report.md');
  fs.writeFileSync(outputPath, report);
  console.log(`[SUCCESS] Coverage report generated: ${outputPath}`);
}

generateCoverageReport();
