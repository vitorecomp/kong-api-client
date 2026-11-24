#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');

function splitPath(pathname) {
  const withoutQuery = pathname.split('?', 1)[0] ?? '/';
  const trimmed = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/, '') : withoutQuery || '/';
  if (trimmed === '/') {
    return [];
  }
  return trimmed.slice(1).split('/');
}

function operationKey(method, template) {
  return `${method.toUpperCase()} ${template}`;
}

export function loadSupportedOperations(repoRoot = REPO_ROOT) {
  const resourcesDoc = JSON.parse(
    readFileSync(resolve(repoRoot, 'schemas/resources.json'), 'utf8'),
  );
  const endpointsDoc = JSON.parse(
    readFileSync(resolve(repoRoot, 'schemas/endpoints.json'), 'utf8'),
  );

  const operations = [];
  const seen = new Set();

  const add = (method, template, kind) => {
    const upper = method.toUpperCase();
    const key = operationKey(upper, template);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    operations.push({ method: upper, template, kind, key });
  };

  for (const resource of Object.values(resourcesDoc.resources)) {
    if (resource.topLevel === false) {
      continue;
    }
    const base = `/${resource.path}`;
    add('GET', base, 'regular');
    add('POST', base, 'regular');
    add('GET', `${base}/{}`, 'regular');
    add('PATCH', `${base}/{}`, 'regular');
    add('PUT', `${base}/{}`, 'regular');
    add('DELETE', `${base}/{}`, 'regular');

    if (resource.nested) {
      for (const nested of Object.values(resource.nested)) {
        const nestedBase = `${base}/{}/${nested.path}`;
        add('GET', nestedBase, 'regular');
        add('POST', nestedBase, 'regular');
        add('GET', `${nestedBase}/{}`, 'regular');
        add('PATCH', `${nestedBase}/{}`, 'regular');
        add('PUT', `${nestedBase}/{}`, 'regular');
        add('DELETE', `${nestedBase}/{}`, 'regular');
      }
    }

    if (resource.single) {
      for (const single of Object.values(resource.single)) {
        const singlePath = `${base}/{}/${single.path}`;
        add('GET', singlePath, 'regular');
        add('PATCH', singlePath, 'regular');
        add('PUT', singlePath, 'regular');
      }
    }
  }

  for (const [template, spec] of Object.entries(endpointsDoc.special)) {
    for (const method of spec.methods) {
      add(method, template, 'special');
    }
  }

  return operations;
}

export function buildTemplateMatcher(operations) {
  const byTemplate = new Map();
  for (const op of operations) {
    let entry = byTemplate.get(op.template);
    if (!entry) {
      const segments = splitPath(op.template);
      const literalCount = segments.filter((seg) => seg !== '{}').length;
      entry = {
        template: op.template,
        segments,
        literalCount,
        methods: new Set(),
      };
      byTemplate.set(op.template, entry);
    }
    entry.methods.add(op.method);
  }

  const templates = [...byTemplate.values()];

  return function matchTemplate(method, pathname) {
    const upperMethod = method.toUpperCase();
    const pathSegments = splitPath(pathname);
    let best = null;

    for (const candidate of templates) {
      if (candidate.segments.length !== pathSegments.length) {
        continue;
      }
      let matched = true;
      for (let i = 0; i < candidate.segments.length; i += 1) {
        const expected = candidate.segments[i];
        const actual = pathSegments[i];
        if (expected === '{}') {
          if (!actual) {
            matched = false;
            break;
          }
        } else if (expected !== actual) {
          matched = false;
          break;
        }
      }
      if (!matched) {
        continue;
      }

      if (best === null) {
        best = candidate;
        continue;
      }
      if (candidate.literalCount !== best.literalCount) {
        if (candidate.literalCount > best.literalCount) {
          best = candidate;
        }
        continue;
      }
      const candidateHasMethod = candidate.methods.has(upperMethod);
      const bestHasMethod = best.methods.has(upperMethod);
      if (candidateHasMethod && !bestHasMethod) {
        best = candidate;
      }
    }

    return best ? best.template : null;
  };
}

export function readRequestLog(logPath) {
  if (!existsSync(logPath)) {
    return [];
  }
  const raw = readFileSync(logPath, 'utf8');
  const entries = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const parsed = JSON.parse(trimmed);
    entries.push({
      method: String(parsed.method).toUpperCase(),
      path: String(parsed.path),
      status: Number(parsed.status),
    });
  }
  return entries;
}

export function readExceptions(exceptionsPath) {
  if (!existsSync(exceptionsPath)) {
    return [];
  }
  const parsed = JSON.parse(readFileSync(exceptionsPath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error(`Expected JSON array in ${exceptionsPath}`);
  }
  return parsed.map((item) => ({
    method: String(item.method).toUpperCase(),
    template: String(item.template),
    status: Number(item.status),
    reason: String(item.reason ?? ''),
  }));
}

export function evaluateCoverage({ operations, requests, exceptions }) {
  const matchTemplate = buildTemplateMatcher(operations);
  const statusesByOp = new Map();
  const unmatchedRequests = [];

  for (const req of requests) {
    const template = matchTemplate(req.method, req.path);
    if (!template) {
      unmatchedRequests.push(req);
      continue;
    }
    const key = operationKey(req.method, template);
    let statuses = statusesByOp.get(key);
    if (!statuses) {
      statuses = new Set();
      statusesByOp.set(key, statuses);
    }
    statuses.add(req.status);
  }

  const supportedKeys = new Set(operations.map((op) => op.key));
  const exceptionByKey = new Map();
  const unknownExceptions = [];

  for (const exc of exceptions) {
    const key = operationKey(exc.method, exc.template);
    if (!supportedKeys.has(key)) {
      unknownExceptions.push(exc);
      continue;
    }
    exceptionByKey.set(key, exc);
  }

  const proven = [];
  const satisfiedExceptions = [];
  const unsatisfiedExceptions = [];
  const staleExceptions = [];
  const missing = [];

  for (const op of operations) {
    const statuses = statusesByOp.get(op.key) ?? new Set();
    const has2xx = [...statuses].some((s) => s >= 200 && s < 300);
    const exc = exceptionByKey.get(op.key);

    if (has2xx) {
      proven.push(op);
      if (exc) {
        staleExceptions.push({ operation: op, exception: exc, statuses: [...statuses] });
      }
      continue;
    }

    if (exc) {
      if (statuses.has(exc.status)) {
        satisfiedExceptions.push({ operation: op, exception: exc });
      } else {
        unsatisfiedExceptions.push({ operation: op, exception: exc, statuses: [...statuses] });
      }
      continue;
    }

    missing.push({ operation: op, statuses: [...statuses] });
  }

  return {
    total: operations.length,
    regularTotal: operations.filter((o) => o.kind === 'regular').length,
    specialTotal: operations.filter((o) => o.kind === 'special').length,
    proven,
    satisfiedExceptions,
    unsatisfiedExceptions,
    staleExceptions,
    unknownExceptions,
    missing,
    unmatchedRequests,
  };
}

function formatReport(target, mode, result) {
  const lines = [];
  lines.push(`Live API coverage for ${target} (${mode} mode):`);
  lines.push(
    `  Total operations: ${result.total} (${result.regularTotal} regular, ${result.specialTotal} special)`,
  );
  lines.push(`  Proven (2xx):     ${result.proven.length}`);
  lines.push(
    `  Exceptions:       ${result.satisfiedExceptions.length} satisfied, ${result.unsatisfiedExceptions.length} unsatisfied, ${result.staleExceptions.length} stale (got 2xx), ${result.unknownExceptions.length} unknown`,
  );
  lines.push(`  Missing:          ${result.missing.length}`);

  if (result.proven.length > 0) {
    lines.push('');
    lines.push(`Proven operations (${result.proven.length}):`);
    for (const op of result.proven) {
      lines.push(`  [ok] ${op.key}`);
    }
  }

  if (result.satisfiedExceptions.length > 0) {
    lines.push('');
    lines.push(`Satisfied exceptions (${result.satisfiedExceptions.length}):`);
    for (const { operation, exception } of result.satisfiedExceptions) {
      lines.push(`  [exc ${exception.status}] ${operation.key} — ${exception.reason}`);
    }
  }

  if (result.staleExceptions.length > 0) {
    lines.push('');
    lines.push(`Stale exceptions (got 2xx) (${result.staleExceptions.length}):`);
    for (const { operation, exception } of result.staleExceptions) {
      lines.push(
        `  [stale] ${operation.key} (listed exception for ${exception.status}, but got 2xx)`,
      );
    }
  }

  if (result.unsatisfiedExceptions.length > 0) {
    lines.push('');
    lines.push(`Unsatisfied exceptions (${result.unsatisfiedExceptions.length}):`);
    for (const { operation, exception, statuses } of result.unsatisfiedExceptions) {
      const seen = statuses.length > 0 ? statuses.join(', ') : 'none';
      lines.push(`  [unsatisfied] ${operation.key} (expected ${exception.status}, saw: ${seen})`);
    }
  }

  if (result.unknownExceptions.length > 0) {
    lines.push('');
    lines.push(`Unknown exceptions (${result.unknownExceptions.length}):`);
    for (const exc of result.unknownExceptions) {
      lines.push(`  [unknown] ${operationKey(exc.method, exc.template)}`);
    }
  }

  if (result.missing.length > 0) {
    lines.push('');
    lines.push(`Missing operations (${result.missing.length}):`);
    for (const { operation, statuses } of result.missing) {
      const suffix = statuses.length > 0 ? ` (saw: ${statuses.join(', ')})` : '';
      lines.push(`  [missing] ${operation.key}${suffix}`);
    }
  }

  return lines.join('\n');
}

function parseArgs(argv) {
  let target = null;
  let logPath = null;
  let exceptionsPath = null;
  let mode = process.env.LIVE_COVERAGE || 'report';
  let json = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--log') {
      logPath = argv[++i] ?? null;
    } else if (arg === '--exceptions') {
      exceptionsPath = argv[++i] ?? null;
    } else if (arg === '--mode') {
      mode = argv[++i] ?? mode;
    } else if (arg === '--json') {
      json = true;
    } else if (!arg.startsWith('-') && !target) {
      target = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!target) {
    throw new Error(
      'Usage: node scripts/live-coverage.mjs <target> [--log <path>] [--exceptions <path>] [--mode <strict|report>] [--json]',
    );
  }
  if (mode !== 'strict' && mode !== 'report') {
    throw new Error(`Unsupported LIVE_COVERAGE mode '${mode}'; expected 'strict' or 'report'`);
  }

  return {
    target,
    logPath: logPath
      ? resolve(logPath)
      : resolve(REPO_ROOT, `coverage/live-requests-${target}.jsonl`),
    exceptionsPath: exceptionsPath
      ? resolve(exceptionsPath)
      : resolve(REPO_ROOT, 'test/live/coverage-exceptions.json'),
    mode,
    json,
  };
}

function main() {
  const { target, logPath, exceptionsPath, mode, json } = parseArgs(process.argv.slice(2));
  const operations = loadSupportedOperations(REPO_ROOT);
  const requests = readRequestLog(logPath);
  const exceptions = readExceptions(exceptionsPath);
  const result = evaluateCoverage({ operations, requests, exceptions });

  if (json) {
    console.log(
      JSON.stringify(
        {
          target,
          mode,
          total: result.total,
          regularTotal: result.regularTotal,
          specialTotal: result.specialTotal,
          proven: result.proven.map((o) => o.key),
          satisfiedExceptions: result.satisfiedExceptions.map((x) => ({
            operation: x.operation.key,
            status: x.exception.status,
            reason: x.exception.reason,
          })),
          unsatisfiedExceptions: result.unsatisfiedExceptions.map((x) => ({
            operation: x.operation.key,
            expectedStatus: x.exception.status,
            statuses: x.statuses,
          })),
          staleExceptions: result.staleExceptions.map((x) => ({
            operation: x.operation.key,
            exceptionStatus: x.exception.status,
            statuses: x.statuses,
          })),
          unknownExceptions: result.unknownExceptions.map((x) =>
            operationKey(x.method, x.template),
          ),
          missing: result.missing.map((x) => ({
            operation: x.operation.key,
            statuses: x.statuses,
          })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(formatReport(target, mode, result));
  }

  const hasFailures =
    result.missing.length > 0 ||
    result.unsatisfiedExceptions.length > 0 ||
    result.staleExceptions.length > 0 ||
    result.unknownExceptions.length > 0;

  if (mode === 'strict' && hasFailures) {
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
