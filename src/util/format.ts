export function renderTable(headers: string[], rows: Array<Array<string | number | null | undefined>>): string {
  const stringRows = rows.map((row) => row.map((cell) => formatCell(cell)));
  const widths = headers.map((header, index) => {
    const cellWidths = stringRows.map((row) => (row[index] ?? '').length);
    return Math.max(header.length, ...cellWidths, 1);
  });

  const formatRow = (row: string[]): string =>
    row.map((cell, index) => cell.padEnd(widths[index] ?? cell.length)).join('  ').replace(/\s+$/, '');

  const lines = [formatRow(headers), formatRow(widths.map((width) => '-'.repeat(width)))];
  for (const row of stringRows) {
    lines.push(formatRow(row));
  }
  return lines.join('\n');
}

function formatCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'unknown';
  return `${Math.round(value)}%`;
}

export function formatCredits(used: number | null | undefined, available: number | null | undefined): string {
  if (used === null || used === undefined || available === null || available === undefined) return 'unknown';
  return `${used}/${used + available}`;
}

export function formatTimestamp(epochSeconds: number | null | undefined): string {
  if (!epochSeconds) return 'never';
  const seconds = Math.floor(Date.now() / 1000) - epochSeconds;
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
