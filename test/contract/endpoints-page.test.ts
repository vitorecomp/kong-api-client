import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface EndpointNotesFile {
  notes: Record<string, string>;
}

interface ServedRow {
  section: string;
  tableIndex: number;
  endpoint: string;
  normalized: string;
  method: string;
  call: string;
  notes: string;
}

interface ExcludedRow {
  endpoint: string;
  normalized: string;
  reason: string;
}

function readText(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readText(relativePath)) as T;
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\{[^/}]+\}/g, '{}');
}

function stripBackticks(cell: string): string {
  const trimmed = cell.trim();
  if (trimmed.startsWith('`') && trimmed.endsWith('`') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function splitMarkdownRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let current = '';
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i];
    if (ch === '\\' && inner[i + 1] === '|') {
      current += '|';
      i += 1;
      continue;
    }
    if (ch === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function parseEndpointsPage(markdown: string): {
  servedRows: ServedRow[];
  excludedRows: ExcludedRow[];
} {
  const lines = markdown.split(/\r?\n/);
  const servedRows: ServedRow[] = [];
  const excludedRows: ExcludedRow[] = [];

  let currentSection = '';
  let tableIndex = -1;
  let tableKind: 'served' | 'excluded' | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      currentSection = line.slice(3).trim();
      tableKind = null;
      continue;
    }
    if (!line.startsWith('|')) {
      tableKind = null;
      continue;
    }

    const cells = splitMarkdownRow(line);
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) {
      continue;
    }
    if (
      cells.length === 4 &&
      cells[0] === 'Endpoint' &&
      cells[1] === 'Method' &&
      cells[2] === 'Call' &&
      cells[3] === 'Notes'
    ) {
      tableKind = 'served';
      tableIndex += 1;
      continue;
    }
    if (cells.length === 2 && cells[0] === 'Endpoint' && cells[1] === 'Reason') {
      tableKind = 'excluded';
      tableIndex += 1;
      continue;
    }

    if (tableKind === 'served') {
      expect(cells, `expected 4 columns in served table row: ${line}`).toHaveLength(4);
      const endpoint = stripBackticks(cells[0]!);
      const method = stripBackticks(cells[1]!);
      const call = stripBackticks(cells[2]!);
      const notes = cells[3]!;
      servedRows.push({
        section: currentSection,
        tableIndex,
        endpoint,
        normalized: normalizeEndpoint(endpoint),
        method,
        call,
        notes,
      });
    } else if (tableKind === 'excluded') {
      expect(cells, `expected 2 columns in excluded table row: ${line}`).toHaveLength(2);
      const endpoint = stripBackticks(cells[0]!);
      const reason = cells[1]!;
      excludedRows.push({
        endpoint,
        normalized: normalizeEndpoint(endpoint),
        reason,
      });
    }
  }

  return { servedRows, excludedRows };
}

describe('generated endpoint coverage page contract', () => {
  const pageMd = readText('../../docs/endpoints.md');
  const callsTs = readText('../../test/support/endpoint-calls.ts');
  const recorded39 = readJson<string[]>('../../schemas/kong-3.9/endpoints.json');
  const notesFile = readJson<EndpointNotesFile>('../../schemas/endpoint-notes.json');
  const { servedRows, excludedRows } = parseEndpointsPage(pageMd);

  it('has TypeDoc Guide front matter, computed counts, and no # fragment links', () => {
    expect(pageMd.startsWith('---\ntitle: Endpoint Coverage\ngroup: Guides\n---\n')).toBe(true);
    expect(pageMd).toContain('**141**');
    expect(pageMd).toContain('**125**');
    expect(pageMd).toContain('**308**');
    expect(pageMd).toContain('**16**');
    expect(pageMd).not.toMatch(/\]\(#[^)]*\)/);
  });

  it('lists every recorded Kong 3.9 endpoint exactly once (served or excluded) across 308 method rows', () => {
    expect(servedRows).toHaveLength(308);
    expect(excludedRows).toHaveLength(16);

    // Every served (method, endpoint) pair is unique.
    const seenOps = new Set<string>();
    for (const row of servedRows) {
      const opKey = `${row.method} ${row.normalized}`;
      expect(seenOps.has(opKey), `duplicate operation row: ${opKey}`).toBe(false);
      seenOps.add(opKey);
    }

    // Every served endpoint belongs to exactly one contiguous block in one table.
    const seenServedEndpoints = new Set<string>();
    let previousEndpoint: string | null = null;
    let previousTable = -1;
    for (const row of servedRows) {
      const sameBlock = row.normalized === previousEndpoint && row.tableIndex === previousTable;
      if (!sameBlock) {
        expect(
          seenServedEndpoints.has(row.normalized),
          `served endpoint appears more than once on the page: ${row.normalized}`,
        ).toBe(false);
        seenServedEndpoints.add(row.normalized);
        previousEndpoint = row.normalized;
        previousTable = row.tableIndex;
      }
    }

    // Every excluded endpoint appears once and is disjoint from served endpoints.
    const seenExcludedEndpoints = new Set<string>();
    for (const row of excludedRows) {
      expect(
        seenExcludedEndpoints.has(row.normalized),
        `duplicate excluded endpoint: ${row.normalized}`,
      ).toBe(false);
      expect(
        seenServedEndpoints.has(row.normalized),
        `endpoint appears in both served and excluded tables: ${row.normalized}`,
      ).toBe(false);
      expect(row.reason.length, `missing reason for excluded ${row.normalized}`).toBeGreaterThan(0);
      seenExcludedEndpoints.add(row.normalized);
    }

    expect(seenServedEndpoints.size).toBe(125);
    expect(seenExcludedEndpoints.size).toBe(16);

    const allPageEndpoints = [...seenServedEndpoints, ...seenExcludedEndpoints].sort();
    const expectedRecorded39 = recorded39.map(normalizeEndpoint).sort();
    expect(allPageEndpoints).toEqual(expectedRecorded39);
  });

  it('renders every pinned behaviour note from schemas/endpoint-notes.json on its operation row', () => {
    const rowByOp = new Map(servedRows.map((row) => [`${row.method} ${row.normalized}`, row]));

    for (const [opKey, expectedNote] of Object.entries(notesFile.notes)) {
      const row = rowByOp.get(opKey);
      expect(row, `missing row for noted operation: ${opKey}`).toBeDefined();
      expect(row?.notes).toBe(expectedNote);
    }
  });

  it('compiles every documented call expression verbatim in test/support/endpoint-calls.ts', () => {
    const compiledCalls = [...callsTs.matchAll(/^\s*await\s+(kong\.[^;]+);$/gm)].map(
      (match) => match[1]!,
    );
    const documentedCalls = servedRows.map((row) => row.call);

    expect(compiledCalls).toHaveLength(308);
    expect(compiledCalls).toEqual(documentedCalls);
  });
});
