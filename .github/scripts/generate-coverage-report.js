#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function getStatusIcon(coverage) {
  if (coverage >= 80) return '✅';
  if (coverage >= 60) return '⚠️';
  return '❌';
}

function normalizeFilePath(filePath) {
  return filePath.replace(/^.*?(?:webview-react\/|out\/)/, '');
}

function formatCoverageSection(title, coverageSummary) {
  if (!coverageSummary || !coverageSummary.total) {
    return `\n### ${title}\n❌ Coverage data not available\n\n`;
  }

  const total = coverageSummary.total;
  const lines = total.lines.pct || 0;
  const statements = total.statements.pct || 0;
  const functions = total.functions.pct || 0;
  const branches = total.branches.pct || 0;

  let section = `\n### ${title}\n\n`;
  section += `| Type | Coverage Rate |\n`;
  section += `|------|--------:|\n`;
  section += `| Statements | ${statements}% |\n`;
  section += `| Branches   | ${branches}% |\n`;
  section += `| Functions  | ${functions}% |\n`;
  section += `| Lines      | ${lines}% |\n\n`;

  const fileDetails = [];
  for (const [filePath, coverage] of Object.entries(coverageSummary)) {
    if (filePath === 'total') continue;
    
    const linesCov = coverage.lines.pct || 0;
    const statementsCov = coverage.statements.pct || 0;
    const functionsCov = coverage.functions.pct || 0;
    const branchesCov = coverage.branches.pct || 0;
    const avgFileCov = (linesCov + statementsCov + functionsCov + branchesCov) / 4;
    
    fileDetails.push({
      path: normalizeFilePath(filePath),
      avgCov: avgFileCov,
      lines: linesCov,
      statements: statementsCov,
      functions: functionsCov,
      branches: branchesCov
    });
  }

  if (fileDetails.length > 0) {
    section += '<details>\n';
    section += '<summary>File-wise Details (click to expand)</summary>\n\n';
    
    fileDetails.sort((a, b) => a.avgCov - b.avgCov);

    section += `| File | Avg | Lines | Statements | Functions | Branches |\n`;
    section += `|------|-----:|-----:|----------:|----------:|----------:|\n`;
    fileDetails.forEach(file => {
      const avg = file.avgCov.toFixed(1);
      const icon = getStatusIcon(file.avgCov);
      section += `| ${icon} ${file.path || 'Unknown'} | ${avg}% | ${file.lines.toFixed(1)}% | ${file.statements.toFixed(1)}% | ${file.functions.toFixed(1)}% | ${file.branches.toFixed(1)}% |\n`;
    });

    section += '\n</details>\n';
  }

  const avgCoverage = (lines + statements + functions + branches) / 4;
  const statusIcon = getStatusIcon(avgCoverage);
  section += `\n${statusIcon} Average Coverage: ${avgCoverage.toFixed(1)}%\n`;

  return {
    section,
    avgCoverage
  };
}

function readCoverageJson(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[WARN] Coverage file missing at: ${filePath}`);
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to parse coverage JSON at ${filePath}:`, error.message);
    return null;
  }
}

function generateCoverageReport() {
  console.log('[DEBUG] Starting coverage report generation');

  const extensionCoveragePath = path.join(__dirname, '../../coverage/coverage-summary.json');
  const webviewCoveragePath = path.join(__dirname, '../../webview-react/coverage/coverage-summary.json');

  const extensionCoverage = readCoverageJson(extensionCoveragePath);
  const webviewCoverage = readCoverageJson(webviewCoveragePath);

  let report = '## 📊 Coverage Report\n';

  const sections = [];
  const averages = [];

  if (extensionCoverage) {
    // extensionCoverage is actually from unit tests (test:coverage)
    const { section, avgCoverage } = formatCoverageSection('Unit Tests Coverage', extensionCoverage);
    sections.push(section);
    averages.push({ name: 'Unit Tests', value: avgCoverage });
  } else {
    sections.push('\n### Unit Tests Coverage\n❌ Coverage data not available\n\n');
  }

  if (webviewCoverage) {
    const { section, avgCoverage } = formatCoverageSection('Webview Coverage', webviewCoverage);
    sections.push(section);
    averages.push({ name: 'Webview', value: avgCoverage });
  } else {
    sections.push('\n### Webview Coverage\n❌ Coverage data not available\n\n');
  }

  report += sections.join('\n');

  if (averages.length >= 1) {
    const overall = averages.reduce((sum, item) => sum + item.value, 0) / averages.length;
    const statusIcon = getStatusIcon(overall);

    report += '\n---\n\n';
    report += '### Overall Combined Coverage\n\n';
    report += `| Area | Average Coverage |\n`;
    report += `|------|--------:|\n`;
    averages.forEach(entry => {
      report += `| ${entry.name} | ${entry.value.toFixed(1)}% |\n`;
    });
    report += `| **Overall** | **${overall.toFixed(1)}%** |\n\n`;
    report += `${statusIcon} **Combined Status**: ${overall.toFixed(1)}%\n`;
  }

  const outputPath = path.join(__dirname, '../coverage-report.md');
  fs.writeFileSync(outputPath, report);
  console.log(`[SUCCESS] Coverage report generated at ${outputPath}`);
}

generateCoverageReport();
