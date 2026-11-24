import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Kong } from '../../src/index.js';
import { createFakeFetch } from '../support/fake-fetch.js';
import { SPECIAL_ENDPOINTS } from '../support/special-manifest.js';

interface SpecialEndpointDecl {
  methods: string[];
  call: string;
}

interface EndpointsFile {
  special: Record<string, SpecialEndpointDecl>;
}

function readEndpointsFile(): EndpointsFile {
  const raw = readFileSync(new URL('../../schemas/endpoints.json', import.meta.url), 'utf8');
  return JSON.parse(raw) as EndpointsFile;
}

function templateToRegex(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function matchMostLiteralTemplate(pathname: string, templates: readonly string[]): string | null {
  const pathSegments = pathname === '/' ? [] : pathname.slice(1).split('/');
  let best: { template: string; literalCount: number } | null = null;

  for (const template of templates) {
    const tmplSegments = template === '/' ? [] : template.slice(1).split('/');
    if (tmplSegments.length !== pathSegments.length) {
      continue;
    }
    let literalCount = 0;
    let matches = true;
    for (let i = 0; i < tmplSegments.length; i += 1) {
      const expected = tmplSegments[i];
      const actual = pathSegments[i];
      if (expected === '{}') {
        if (!actual) {
          matches = false;
          break;
        }
      } else if (expected === actual) {
        literalCount += 1;
      } else {
        matches = false;
        break;
      }
    }
    if (matches && (!best || literalCount > best.literalCount)) {
      best = { template, literalCount };
    }
  }

  return best ? best.template : null;
}

describe('SPECIAL_ENDPOINTS contract', () => {
  const endpointsFile = readEndpointsFile();
  const declaredTemplates = Object.keys(endpointsFile.special);

  it('matches the exact set of templates and methods in schemas/endpoints.json without duplicates', () => {
    const expectedOps = Object.entries(endpointsFile.special)
      .flatMap(([template, decl]) => decl.methods.map((method) => `${method} ${template}`))
      .sort();

    const actualOps = SPECIAL_ENDPOINTS.map((entry) => `${entry.method} ${entry.template}`);
    expect(new Set(actualOps).size).toBe(actualOps.length);
    expect([...actualOps].sort()).toEqual(expectedOps);
    expect(SPECIAL_ENDPOINTS).toHaveLength(41);
  });

  it('invokes each entry on Kong with fake fetch and sends one matching request', async () => {
    for (const entry of SPECIAL_ENDPOINTS) {
      const fake = createFakeFetch();
      if (entry.template === '/metrics') {
        fake.text('kong_datastore_reachable 1\n');
      } else if (entry.template === '/plugins/enabled') {
        fake.json({ enabled_plugins: [] });
      } else if (
        entry.method === 'DELETE' ||
        entry.template.startsWith('/upstreams/{}/targets/{}/')
      ) {
        fake.empty(204);
      } else {
        fake.json({});
      }

      const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
      await entry.invoke(kong);

      expect(fake.requests, `${entry.method} ${entry.template}`).toHaveLength(1);
      const req = fake.requests[0]!;
      expect(req.method, `${entry.method} ${entry.template}`).toBe(entry.method);

      const pathname = new URL(req.url).pathname;
      expect(pathname, `${entry.method} ${entry.template}`).toMatch(
        templateToRegex(entry.template),
      );
      expect(
        matchMostLiteralTemplate(pathname, declaredTemplates),
        `most-literal template for ${entry.method} ${pathname}`,
      ).toBe(entry.template);
    }
  });
});
