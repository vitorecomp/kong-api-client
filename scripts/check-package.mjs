#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const TSC_BIN = resolve(REPO_ROOT, 'node_modules/typescript/bin/tsc');

const REQUIRED_TARBALL_FILES = [
  'package.json',
  'README.md',
  'LICENSE',
  'NOTICE',
  'dist/index.js',
  'dist/index.d.ts',
];

function isAllowedTarballPath(relPath) {
  return (
    relPath === 'package.json' ||
    relPath === 'README.md' ||
    relPath === 'LICENSE' ||
    relPath === 'NOTICE' ||
    relPath.startsWith('LICENSES/') ||
    relPath.startsWith('dist/')
  );
}

function readNullTerminatedUtf8(buf, start, end) {
  let stop = start;
  while (stop < end && buf[stop] !== 0) {
    stop += 1;
  }
  return buf.subarray(start, stop).toString('utf8');
}

function readTarSize(buf, offset) {
  const firstByte = buf[offset + 124] ?? 0;
  if ((firstByte & 0x80) !== 0) {
    let value = 0;
    for (let i = 1; i < 12; i += 1) {
      value = value * 256 + (buf[offset + 124 + i] ?? 0);
    }
    return value;
  }
  const raw = readNullTerminatedUtf8(buf, offset + 124, offset + 136).trim();
  return raw.length > 0 ? Number.parseInt(raw, 8) : 0;
}

function parsePaxPath(data) {
  const text = data.toString('utf8');
  let cursor = 0;
  while (cursor < text.length) {
    const spaceIdx = text.indexOf(' ', cursor);
    if (spaceIdx === -1) {
      break;
    }
    const len = Number.parseInt(text.slice(cursor, spaceIdx), 10);
    if (!Number.isFinite(len) || len <= 0) {
      break;
    }
    const record = text.slice(spaceIdx + 1, cursor + len - 1);
    const eqIdx = record.indexOf('=');
    if (eqIdx !== -1 && record.slice(0, eqIdx) === 'path') {
      return record.slice(eqIdx + 1);
    }
    cursor += len;
  }
  return undefined;
}

function listTarGzFiles(tarballPath) {
  const tarBuf = gunzipSync(readFileSync(tarballPath));
  const files = [];
  let offset = 0;
  let paxPath;
  let gnuLongName;

  while (offset + 512 <= tarBuf.length) {
    let allZero = true;
    for (let i = 0; i < 512; i += 1) {
      if (tarBuf[offset + i] !== 0) {
        allZero = false;
        break;
      }
    }
    if (allZero) {
      break;
    }

    const name = readNullTerminatedUtf8(tarBuf, offset, offset + 100);
    const size = readTarSize(tarBuf, offset);
    const typeFlag = String.fromCharCode(tarBuf[offset + 156] ?? 0);
    const prefix = readNullTerminatedUtf8(tarBuf, offset + 345, offset + 500);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    const nextOffset = dataStart + Math.ceil(size / 512) * 512;

    if (typeFlag === 'x') {
      paxPath = parsePaxPath(tarBuf.subarray(dataStart, dataEnd));
    } else if (typeFlag === 'L') {
      gnuLongName = readNullTerminatedUtf8(tarBuf, dataStart, dataEnd);
    } else if (typeFlag === '0' || typeFlag === '\0') {
      const combined = paxPath ?? gnuLongName ?? (prefix ? `${prefix}/${name}` : name);
      files.push(combined.replace(/^\.\//, ''));
      paxPath = undefined;
      gnuLongName = undefined;
    } else if (typeFlag !== 'g') {
      paxPath = undefined;
      gnuLongName = undefined;
    }

    offset = nextOffset;
  }

  return files.sort();
}

function collectManifestTargets(pkg) {
  const targets = [];

  for (const field of ['main', 'types']) {
    const value = pkg[field];
    if (typeof value === 'string' && value.length > 0) {
      targets.push({ field, path: value.replace(/^\.\//, '') });
    }
  }

  function walkExports(value, label) {
    if (typeof value === 'string') {
      if (value.startsWith('./') && !value.includes('*')) {
        targets.push({ field: label, path: value.slice(2) });
      }
      return;
    }
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        walkExports(value[i], `${label}[${i}]`);
      }
      return;
    }
    if (value && typeof value === 'object') {
      for (const [key, nested] of Object.entries(value)) {
        const nextLabel = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)
          ? `${label}.${key}`
          : `${label}[${JSON.stringify(key)}]`;
        walkExports(nested, nextLabel);
      }
    }
  }

  if (pkg.exports !== undefined) {
    walkExports(pkg.exports, 'exports');
  }

  return targets;
}

function runCommand(command, args, options) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const details = [result.stdout?.trim(), result.stderr?.trim()].filter(Boolean).join('\n');
    throw new Error(
      `Command failed (${command} ${args.join(' ')}, exit ${result.status})${details ? `:\n${details}` : ''}`,
    );
  }
  return result;
}

function runStep(name, fn) {
  try {
    const summary = fn();
    console.log(`[ok] ${name}${summary ? ` — ${summary}` : ''}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[fail] ${name} — ${message}`);
    process.exitCode = 1;
    throw error;
  }
}

function buildSmokeScript(format) {
  if (format === 'esm') {
    return [
      "import assert from 'node:assert/strict';",
      "import { Kong, KongError, PLUGINS, VERSION } from 'kong-api-client';",
      '',
      'const expectedVersion = process.env.EXPECTED_VERSION;',
      'assert.equal(VERSION, expectedVersion, `Expected VERSION ${expectedVersion}, got ${VERSION}`);',
      'const pluginCount = Object.keys(PLUGINS).length;',
      'assert.equal(pluginCount, 45, `Expected 45 PLUGINS entries, got ${pluginCount}`);',
      "const client = new Kong({ adminUrl: 'http://localhost:8001' });",
      "assert.ok(client instanceof Kong, 'Expected Kong instance');",
      'assert.throws(',
      '  () => new Kong({}),',
      '  (error) => error instanceof KongError,',
      "  'Expected new Kong({}) to throw KongError',",
      ');',
      '',
    ].join('\n');
  }

  return [
    "'use strict';",
    "const assert = require('node:assert/strict');",
    "const { Kong, KongError, PLUGINS, VERSION } = require('kong-api-client');",
    '',
    'const expectedVersion = process.env.EXPECTED_VERSION;',
    'assert.equal(VERSION, expectedVersion, `Expected VERSION ${expectedVersion}, got ${VERSION}`);',
    'const pluginCount = Object.keys(PLUGINS).length;',
    'assert.equal(pluginCount, 45, `Expected 45 PLUGINS entries, got ${pluginCount}`);',
    "const client = new Kong({ adminUrl: 'http://localhost:8001' });",
    "assert.ok(client instanceof Kong, 'Expected Kong instance');",
    'assert.throws(',
    '  () => new Kong({}),',
    '  (error) => error instanceof KongError,',
    "  'Expected new Kong({}) to throw KongError',",
    ');',
    '',
  ].join('\n');
}

function buildTypecheckSource() {
  return [
    "import { Kong, KongError, PLUGINS, VERSION, type HttpLogConfig, type Plugin } from 'kong-api-client';",
    '',
    'const version: string = VERSION;',
    'const pluginCount: number = Object.keys(PLUGINS).length;',
    "const kong = new Kong({ adminUrl: 'http://localhost:8001' });",
    '',
    'async function verifyTypes(): Promise<void> {',
    '  const plugin = await kong.plugins.create({',
    "    name: 'http-log',",
    '    config: {',
    "      http_endpoint: 'https://logs.example.com/ingest',",
    '      timeout: 5000,',
    '    },',
    '  });',
    "  const typed: Plugin<'http-log'> = plugin;",
    '  const config: HttpLogConfig = typed.config;',
    '  const endpoint: string = config.http_endpoint;',
    '  const err = new KongError(endpoint);',
    '  void err;',
    '',
    '  await kong.plugins.create({',
    "    name: 'http-log',",
    '    // @ts-expect-error unknown config field must fail type-check',
    "    config: { http_endpoint: 'https://logs.example.com/ingest', unknown_field: true },",
    '  });',
    '}',
    '',
    'void version;',
    'void pluginCount;',
    'void verifyTypes;',
    '',
  ].join('\n');
}

function main() {
  const pkg = JSON.parse(readFileSync(resolve(REPO_ROOT, 'package.json'), 'utf8'));
  const pkgName = String(pkg.name);
  const pkgVersion = String(pkg.version);

  if (!existsSync(TSC_BIN)) {
    console.error(`[fail] setup — TypeScript compiler not found at ${TSC_BIN}`);
    process.exit(1);
  }

  const tempDir = mkdtempSync(join(tmpdir(), 'kong-api-client-pkg-'));
  const packDir = join(tempDir, 'pack');
  const consumerDir = join(tempDir, 'consumer');
  mkdirSync(packDir, { recursive: true });
  mkdirSync(consumerDir, { recursive: true });

  let tarballPath = '';

  try {
    runStep('build and pack tarball', () => {
      runCommand('npm', ['run', 'build'], { cwd: REPO_ROOT });
      runCommand('npm', ['pack', '--pack-destination', packDir], { cwd: REPO_ROOT });
      const tarballs = readdirSync(packDir).filter((file) => file.endsWith('.tgz'));
      if (tarballs.length !== 1) {
        throw new Error(`Expected 1 tarball in pack directory, found ${tarballs.length}`);
      }
      tarballPath = join(packDir, tarballs[0]);
      return tarballs[0];
    });

    runStep('verify tarball contents', () => {
      const entries = listTarGzFiles(tarballPath);
      const nonPrefixed = entries.filter((entry) => !entry.startsWith('package/'));
      if (nonPrefixed.length > 0) {
        throw new Error(`Tarball entries missing package/ prefix: ${nonPrefixed.join(', ')}`);
      }

      const relPaths = entries.map((entry) => entry.slice('package/'.length));
      const relSet = new Set(relPaths);

      const unexpected = relPaths.filter((rel) => !isAllowedTarballPath(rel));
      if (unexpected.length > 0) {
        throw new Error(`Unexpected files in tarball: ${unexpected.join(', ')}`);
      }

      const missing = REQUIRED_TARBALL_FILES.filter((req) => !relSet.has(req));
      if (missing.length > 0) {
        throw new Error(`Missing required files in tarball: ${missing.join(', ')}`);
      }

      if (!relPaths.some((rel) => rel.startsWith('LICENSES/'))) {
        throw new Error('Missing required LICENSES/** files in tarball');
      }

      const missingTargets = collectManifestTargets(pkg).filter(
        (target) => !relSet.has(target.path),
      );
      if (missingTargets.length > 0) {
        const formatted = missingTargets.map((t) => `${t.field} -> ${t.path}`).join(', ');
        throw new Error(`Package manifest points to missing files in tarball: ${formatted}`);
      }

      return `${relPaths.length} files verified`;
    });

    runStep('install tarball into empty project', () => {
      writeFileSync(
        join(consumerDir, 'package.json'),
        `${JSON.stringify({ name: 'consumer-check', private: true, type: 'module' }, null, 2)}\n`,
        'utf8',
      );
      runCommand(
        'npm',
        ['install', '--offline', '--no-audit', '--no-fund', '--ignore-scripts', tarballPath],
        { cwd: consumerDir },
      );

      const nodeModulesDir = join(consumerDir, 'node_modules');
      const installed = readdirSync(nodeModulesDir)
        .filter((entry) => entry !== '.package-lock.json')
        .sort();
      if (installed.length !== 1 || installed[0] !== pkgName) {
        throw new Error(
          `Expected only '${pkgName}' in node_modules, found: ${installed.join(', ') || '(none)'}`,
        );
      }

      const nestedNodeModules = join(nodeModulesDir, pkgName, 'node_modules');
      if (existsSync(nestedNodeModules)) {
        throw new Error(
          `Unexpected nested dependencies under node_modules/${pkgName}/node_modules`,
        );
      }

      return `only ${pkgName} installed`;
    });

    const smokeEnv = { ...process.env, EXPECTED_VERSION: pkgVersion };

    runStep('ESM runtime smoke test', () => {
      const esmFile = join(consumerDir, 'smoke.mjs');
      writeFileSync(esmFile, buildSmokeScript('esm'), 'utf8');
      runCommand(process.execPath, [esmFile], { cwd: consumerDir, env: smokeEnv });
      return `VERSION=${pkgVersion}, 45 plugins, KongError thrown`;
    });

    runStep('CommonJS runtime smoke test', () => {
      const cjsFile = join(consumerDir, 'smoke.cjs');
      writeFileSync(cjsFile, buildSmokeScript('cjs'), 'utf8');
      runCommand(process.execPath, [cjsFile], { cwd: consumerDir, env: smokeEnv });
      return `VERSION=${pkgVersion}, 45 plugins, KongError thrown`;
    });

    const typecheckSource = buildTypecheckSource();

    runStep('ESM consumer type-check', () => {
      writeFileSync(join(consumerDir, 'consumer.ts'), typecheckSource, 'utf8');
      writeFileSync(
        join(consumerDir, 'tsconfig.esm.json'),
        `${JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
              strict: true,
              skipLibCheck: false,
              noEmit: true,
            },
            files: ['consumer.ts'],
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      runCommand(process.execPath, [TSC_BIN, '-p', 'tsconfig.esm.json'], { cwd: consumerDir });
      return 'consumer.ts compiled cleanly (skipLibCheck=false)';
    });

    runStep('CommonJS consumer type-check', () => {
      writeFileSync(join(consumerDir, 'consumer.cts'), typecheckSource, 'utf8');
      writeFileSync(
        join(consumerDir, 'tsconfig.cjs.json'),
        `${JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2022',
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
              strict: true,
              skipLibCheck: false,
              noEmit: true,
            },
            files: ['consumer.cts'],
          },
          null,
          2,
        )}\n`,
        'utf8',
      );
      runCommand(process.execPath, [TSC_BIN, '-p', 'tsconfig.cjs.json'], { cwd: consumerDir });
      return 'consumer.cts compiled cleanly (skipLibCheck=false)';
    });
  } catch {
    process.exitCode = 1;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
