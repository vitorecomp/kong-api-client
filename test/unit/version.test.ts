import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { VERSION } from '../../src/index.js';

interface PackageJson {
  version: string;
}

describe('VERSION', () => {
  it('matches the version in package.json', () => {
    const raw = readFileSync(new URL('../../package.json', import.meta.url), 'utf8');
    const pkg = JSON.parse(raw) as PackageJson;
    expect(VERSION).toBe(pkg.version);
  });
});
