/** Minimal, dependency-free CSV reader/writer (RFC 4180 style, ; or , delimited). */

export type CsvRow = Record<string, string>;

/** Escapes a value and neutralises spreadsheet formula injection. */
function escapeCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[";\n\r]/.test(guarded)) {
    return `"${guarded.replace(/"/g, '""')}"`;
  }
  return guarded;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(escapeCell).join(';')];
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(';'));
  }
  // BOM keeps accents readable when the file is opened in Excel pt-BR.
  return `﻿${lines.join('\r\n')}\r\n`;
}

function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/)[0] || '';
  let inQuotes = false;
  let semis = 0;
  let commas = 0;
  let tabs = 0;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char === ';') semis += 1;
    else if (!inQuotes && char === ',') commas += 1;
    else if (!inQuotes && char === '\t') tabs += 1;
  }
  if (semis >= commas && semis >= tabs && semis > 0) return ';';
  if (tabs > commas && tabs > 0) return '\t';
  if (commas > 0) return ',';
  return ';';
}

/** Parses CSV text into a header list plus raw rows. */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const clean = text.replace(/^﻿/, '');
  if (!clean.trim()) return { headers: [], rows: [] };
  const delimiter = detectDelimiter(clean);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    if (inQuotes) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (char === '\r') {
      // handled by the \n branch
    } else {
      cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  const nonEmpty = rows.filter((candidate) => candidate.some((value) => value.trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = (nonEmpty[0] as string[]).map((header) => header.trim());
  return { headers, rows: nonEmpty.slice(1) };
}

/** Triggers a client-side download without contacting any server. */
export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** File-name friendly timestamp: 2026-10-15_14-30. */
export function fileStamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(
    date.getHours(),
  )}-${pad(date.getMinutes())}`;
}
