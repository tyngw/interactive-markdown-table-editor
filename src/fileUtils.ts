/**
 * Split content into normalized lines for table replacement.
 * Trims trailing empty lines while preserving intentional empty lines within content.
 */
export function normalizeTableLines(content: string): string[] {
    const rawLines = content.split(/\r?\n/);
    const filtered = rawLines.filter(line => line.trim() !== '' || line === '');
    while (filtered.length > 0 && filtered[filtered.length - 1].trim() === '') {
        filtered.pop();
    }
    return filtered;
}

export function contentEndsWithLineBreak(content: string, eol: string): boolean {
    if (!content.length) {
        return false;
    }
    return content.endsWith(eol);
}

/**
 * Build updated document content by replacing lines between startLine..endLine (inclusive)
 * with replacementLines. Validates bounds and preserves EOL behaviour.
 */
export function buildUpdatedContent(
    originalContent: string,
    startLine: number,
    endLine: number,
    replacementLines: string[],
    eol: string
): string {
    const lines = originalContent.split(/\r?\n/);

    if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
        throw new RangeError(`Invalid start/end lines: ${startLine}-${endLine} (total ${lines.length})`);
    }

    const beforeTable = lines.slice(0, startLine);
    const afterTable = lines.slice(endLine + 1);
    const updatedLines = [...beforeTable, ...replacementLines, ...afterTable];

    let updatedContent = updatedLines.join(eol);
    const originalEndsWithBreak = contentEndsWithLineBreak(originalContent, eol);

    if (originalEndsWithBreak && !updatedContent.endsWith(eol)) {
        updatedContent += eol;
    } else if (!originalEndsWithBreak && updatedContent.endsWith(eol)) {
        // strip final eol to match original
        updatedContent = updatedContent.slice(0, -eol.length);
    }

    return updatedContent;
}
