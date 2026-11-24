import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_FIELDS, SET_FIELDS } from '../../src/generated/meta.js';

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

function walkPathsByType(
  node: SchemaNode | undefined,
  targetType: 'set' | 'map',
  path: string,
  out: Set<string>,
): void {
  if (!node) {
    return;
  }
  if (node.type === targetType && path.length > 0) {
    out.add(path);
  }
  if (Array.isArray(node.fields)) {
    for (const entry of node.fields) {
      for (const [name, def] of Object.entries(entry)) {
        walkPathsByType(def, targetType, path ? `${path}.${name}` : name, out);
      }
    }
  }
  if ((node.type === 'array' || node.type === 'set') && node.elements) {
    walkPathsByType(node.elements, targetType, path ? `${path}[]` : '[]', out);
  }
  if (node.type === 'map' && node.values) {
    walkPathsByType(node.values, targetType, path ? `${path}.*` : '*', out);
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

function recomputeByType(targetType: 'set' | 'map'): Record<string, string[]> {
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
    walkPathsByType(s39, targetType, '', paths);
    walkPathsByType(s314, targetType, '', paths);
    expected[entity] = [...paths].sort();
  }

  for (const plugin of pluginNames) {
    const s39 = readJson<SchemaNode>(`../../schemas/kong-3.9/plugins/${plugin}.json`);
    const s314 = readJson<SchemaNode>(`../../schemas/kong-gateway-3.14/plugins/${plugin}.json`);
    const paths = new Set<string>();
    walkPathsByType(findPluginConfigNode(s39), targetType, 'config', paths);
    walkPathsByType(findPluginConfigNode(s314), targetType, 'config', paths);
    expected[`plugin:${plugin}`] = [...paths].sort();
  }

  return expected;
}

describe('generated SET_FIELDS and MAP_FIELDS metadata contract', () => {
  it('matches all set paths recomputed independently from both recordings across all 66 keys', () => {
    const expected = recomputeByType('set');
    expect(Object.keys(expected)).toHaveLength(66);
    expect(SET_FIELDS).toEqual(expected);
  });

  it('matches all map paths recomputed independently from both recordings across all 66 keys', () => {
    const expected = recomputeByType('map');
    expect(Object.keys(expected)).toHaveLength(66);
    expect(MAP_FIELDS).toEqual(expected);
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

  it('matches hand-verified map paths for routes and plugin:http-log', () => {
    expect(MAP_FIELDS.routes).toEqual(['headers']);
    expect(MAP_FIELDS['plugin:http-log']).toEqual([
      'config.custom_fields_by_lua',
      'config.headers',
    ]);
    expect(MAP_FIELDS.sessions).toEqual([]);
  });
});
