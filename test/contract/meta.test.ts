import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SET_FIELDS } from '../../src/generated/meta.js';

interface ResourceDecl {
  entity: string;
}

interface ResourcesFile {
  resources: Record<string, ResourceDecl>;
}

interface SchemaNode {
  type?: string;
  fields?: Array<Record<string, SchemaNode>>;
  elements?: SchemaNode;
  values?: SchemaNode;
}

function readJson<T>(relativePath: string): T {
  const raw = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  return JSON.parse(raw) as T;
}

function listJsonNames(relativeDir: string): string[] {
  return readdirSync(new URL(relativeDir, import.meta.url))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
}

function walkSetPaths(node: SchemaNode | undefined, path: string, out: Set<string>): void {
  if (!node) {
    return;
  }
  if (node.type === 'set' && path.length > 0) {
    out.add(path);
  }
  if (Array.isArray(node.fields)) {
    for (const entry of node.fields) {
      for (const [name, def] of Object.entries(entry)) {
        walkSetPaths(def, path ? `${path}.${name}` : name, out);
      }
    }
  }
  if ((node.type === 'array' || node.type === 'set') && node.elements) {
    walkSetPaths(node.elements, path ? `${path}[]` : '[]', out);
  }
  if (node.type === 'map' && node.values) {
    walkSetPaths(node.values, path ? `${path}.*` : '*', out);
  }
}

function findPluginConfigNode(schema: SchemaNode): SchemaNode | undefined {
  for (const entry of schema.fields ?? []) {
    if ('config' in entry) {
      return entry.config;
    }
  }
  return undefined;
}

describe('generated SET_FIELDS metadata contract', () => {
  it('matches all set paths recomputed independently from both recordings across all 66 keys', () => {
    const resourcesFile = readJson<ResourcesFile>('../../schemas/resources.json');
    const entityNames = [
      ...new Set(Object.values(resourcesFile.resources).map((r) => r.entity)),
    ].sort();
    const pluginNames = listJsonNames('../../schemas/kong-3.9/plugins/');

    const expected: Record<string, string[]> = {};

    for (const entity of entityNames) {
      const s39 = readJson<SchemaNode>(`../../schemas/kong-3.9/entities/${entity}.json`);
      const s314 = readJson<SchemaNode>(`../../schemas/kong-gateway-3.14/entities/${entity}.json`);
      const paths = new Set<string>();
      walkSetPaths(s39, '', paths);
      walkSetPaths(s314, '', paths);
      expected[entity] = [...paths].sort();
    }

    for (const plugin of pluginNames) {
      const s39 = readJson<SchemaNode>(`../../schemas/kong-3.9/plugins/${plugin}.json`);
      const s314 = readJson<SchemaNode>(`../../schemas/kong-gateway-3.14/plugins/${plugin}.json`);
      const paths = new Set<string>();
      walkSetPaths(findPluginConfigNode(s39), 'config', paths);
      walkSetPaths(findPluginConfigNode(s314), 'config', paths);
      expected[`plugin:${plugin}`] = [...paths].sort();
    }

    expect(Object.keys(expected)).toHaveLength(66);
    expect(SET_FIELDS).toEqual(expected);
  });

  it('matches hand-verified set paths for routes, plugins, and sessions', () => {
    expect(SET_FIELDS.routes).toEqual([
      'destinations',
      'methods',
      'protocols',
      'snis',
      'sources',
      'tags',
    ]);
    expect(SET_FIELDS.plugins).toEqual(['protocols', 'tags']);
    expect(SET_FIELDS.sessions).toEqual([]);
  });
});
