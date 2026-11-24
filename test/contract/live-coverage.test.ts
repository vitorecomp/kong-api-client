import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const SCRIPT_PATH = fileURLToPath(new URL('../../scripts/live-coverage.mjs', import.meta.url));

interface CoverageJsonReport {
  target: string;
  mode: string;
  total: number;
  regularTotal: number;
  specialTotal: number;
  proven: string[];
  satisfiedExceptions: Array<{ operation: string; status: number; reason: string }>;
  unsatisfiedExceptions: Array<{ operation: string; expectedStatus: number; statuses: number[] }>;
  staleExceptions: Array<{ operation: string; exceptionStatus: number; statuses: number[] }>;
  unknownExceptions: string[];
  missing: Array<{ operation: string; statuses: number[] }>;
}

interface FixtureLogEntry {
  method: string;
  path: string;
  status: number;
}

interface FixtureException {
  method: string;
  template: string;
  status: number;
  reason: string;
}

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

function runCoverageScript(options: {
  requests: FixtureLogEntry[];
  exceptions?: FixtureException[];
  mode: 'strict' | 'report';
  json?: boolean;
}) {
  const dir = mkdtempSync(join(tmpdir(), 'kac-live-cov-'));
  tempDirs.push(dir);

  const logPath = join(dir, 'requests.jsonl');
  const exceptionsPath = join(dir, 'exceptions.json');

  writeFileSync(
    logPath,
    options.requests.map((entry) => JSON.stringify(entry)).join('\n') +
      (options.requests.length > 0 ? '\n' : ''),
    'utf8',
  );
  writeFileSync(exceptionsPath, JSON.stringify(options.exceptions ?? [], null, 2), 'utf8');

  const args = [
    SCRIPT_PATH,
    'oss-3.9',
    '--log',
    logPath,
    '--exceptions',
    exceptionsPath,
    ...(options.json ? ['--json'] : []),
  ];

  const proc = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      LIVE_COVERAGE: options.mode,
    },
  });

  return {
    status: proc.status,
    stdout: proc.stdout,
    stderr: proc.stderr,
    parsed: options.json ? (JSON.parse(proc.stdout) as CoverageJsonReport) : undefined,
  };
}

function concretePathForTemplate(template: string): string {
  if (template === '/') {
    return '/';
  }
  let idx = 0;
  return template.replace(/\{\}/g, () => `sample-${++idx}`);
}

describe('scripts/live-coverage.mjs contract', () => {
  it('counts all 308 supported operations (267 regular + 41 special) and separates proven vs missing', () => {
    const requests: FixtureLogEntry[] = [
      { method: 'GET', path: '/services', status: 200 },
      { method: 'POST', path: '/services', status: 201 },
      { method: 'GET', path: '/services/billing', status: 200 },
      { method: 'DELETE', path: '/services/billing', status: 404 },
    ];

    const reportRun = runCoverageScript({ requests, mode: 'report', json: true });
    expect(reportRun.status).toBe(0);
    expect(reportRun.parsed?.total).toBe(308);
    expect(reportRun.parsed?.regularTotal).toBe(267);
    expect(reportRun.parsed?.specialTotal).toBe(41);
    expect(reportRun.parsed?.proven).toEqual([
      'GET /services',
      'POST /services',
      'GET /services/{}',
    ]);

    const deleteMissing = reportRun.parsed?.missing.find(
      (m) => m.operation === 'DELETE /services/{}',
    );
    expect(deleteMissing).toEqual({ operation: 'DELETE /services/{}', statuses: [404] });
    expect(reportRun.parsed?.missing).toHaveLength(305);

    const strictRun = runCoverageScript({ requests, mode: 'strict', json: true });
    expect(strictRun.status).toBe(1);
  });

  it('tracks satisfied and unsatisfied exceptions accurately', () => {
    const exceptions: FixtureException[] = [
      {
        method: 'GET',
        template: '/clustering/status',
        status: 400,
        reason: 'requires hybrid control plane mode',
      },
      {
        method: 'GET',
        template: '/clustering/data-planes',
        status: 400,
        reason: 'requires hybrid control plane mode',
      },
    ];

    const requests: FixtureLogEntry[] = [
      { method: 'GET', path: '/clustering/status', status: 400 },
      { method: 'GET', path: '/clustering/data-planes', status: 500 },
    ];

    const run = runCoverageScript({ requests, exceptions, mode: 'report', json: true });
    expect(run.status).toBe(0);
    expect(run.parsed?.satisfiedExceptions).toEqual([
      {
        operation: 'GET /clustering/status',
        status: 400,
        reason: 'requires hybrid control plane mode',
      },
    ]);
    expect(run.parsed?.unsatisfiedExceptions).toEqual([
      {
        operation: 'GET /clustering/data-planes',
        expectedStatus: 400,
        statuses: [500],
      },
    ]);
    expect(run.parsed?.missing.some((m) => m.operation === 'GET /clustering/status')).toBe(false);
    expect(run.parsed?.missing.some((m) => m.operation === 'GET /clustering/data-planes')).toBe(
      false,
    );
  });

  it('passes strict mode when all 308 operations are proven or satisfied exceptions, and fails on a stale exception that got 2xx', () => {
    // Get the full list of 308 operations from a dry report run
    const emptyRun = runCoverageScript({ requests: [], mode: 'report', json: true });
    expect(emptyRun.status).toBe(0);
    const allOps = emptyRun.parsed!.missing.map((m) => m.operation);
    expect(allOps).toHaveLength(308);

    const fullRequests: FixtureLogEntry[] = allOps.map((op) => {
      const spaceIdx = op.indexOf(' ');
      const method = op.slice(0, spaceIdx);
      const template = op.slice(spaceIdx + 1);
      if (method === 'GET' && template === '/clustering/status') {
        return { method, path: '/clustering/status', status: 400 };
      }
      return { method, path: concretePathForTemplate(template), status: 200 };
    });

    const validExceptions: FixtureException[] = [
      {
        method: 'GET',
        template: '/clustering/status',
        status: 400,
        reason: 'not a control plane',
      },
    ];

    const cleanStrict = runCoverageScript({
      requests: fullRequests,
      exceptions: validExceptions,
      mode: 'strict',
      json: true,
    });
    expect(cleanStrict.status).toBe(0);
    expect(cleanStrict.parsed?.proven).toHaveLength(307);
    expect(cleanStrict.parsed?.satisfiedExceptions).toHaveLength(1);
    expect(cleanStrict.parsed?.missing).toHaveLength(0);
    expect(cleanStrict.parsed?.staleExceptions).toHaveLength(0);

    // Adding an exception for an operation that received 2xx must fail strict mode
    const staleStrict = runCoverageScript({
      requests: fullRequests,
      exceptions: [
        ...validExceptions,
        {
          method: 'GET',
          template: '/services',
          status: 400,
          reason: 'stale exception',
        },
      ],
      mode: 'strict',
      json: true,
    });
    expect(staleStrict.status).toBe(1);
    expect(staleStrict.parsed?.staleExceptions).toEqual([
      {
        operation: 'GET /services',
        exceptionStatus: 400,
        statuses: [200],
      },
    ]);
  });

  it('matches request paths to the template with the most literal segments', () => {
    const requests: FixtureLogEntry[] = [
      { method: 'GET', path: '/plugins/enabled', status: 200 },
      { method: 'GET', path: '/upstreams/u1/targets/all', status: 200 },
      { method: 'POST', path: '/schemas/plugins/validate', status: 200 },
      { method: 'GET', path: '/', status: 200 },
    ];

    const run = runCoverageScript({ requests, mode: 'report', json: true });
    expect(run.status).toBe(0);
    expect(run.parsed?.proven).toEqual([
      'GET /',
      'POST /schemas/plugins/validate',
      'GET /plugins/enabled',
      'GET /upstreams/{}/targets/all',
    ]);

    const missingOps = new Set(run.parsed?.missing.map((m) => m.operation));
    expect(missingOps.has('GET /plugins/{}')).toBe(true);
    expect(missingOps.has('GET /upstreams/{}/targets/{}')).toBe(true);
    expect(missingOps.has('POST /schemas/{}/validate')).toBe(true);
  });

  it('prints human-readable text output listing proven operations', () => {
    const run = runCoverageScript({
      requests: [{ method: 'GET', path: '/services', status: 200 }],
      mode: 'report',
      json: false,
    });
    expect(run.status).toBe(0);
    expect(run.stdout).toContain('Total operations: 308 (267 regular, 41 special)');
    expect(run.stdout).toContain('[ok] GET /services');
    expect(run.stdout).toContain('[missing] POST /services');
  });
});
