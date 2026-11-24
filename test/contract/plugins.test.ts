import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLUGINS, type PluginName } from '../../src/generated/plugins.js';

interface PluginCategoryEntry {
  category: string;
  title: string;
}

interface PluginCategoriesFile {
  plugins: Record<string, PluginCategoryEntry>;
}

interface RecordingInfo {
  target: string;
  image: string;
  version: string;
  edition: string;
  other_endpoints?: number;
}

const ALLOWED_STRUCTURE_ONLY_KEYS = new Set([
  'fields',
  'shorthand_fields',
  'type',
  'elements',
  'keys',
  'values',
  'reference',
  'abstract',
  'required',
  'auto',
  'default',
  'one_of',
  'eq',
]);

function readJson<T>(relativePath: string): T {
  const raw = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  return JSON.parse(raw) as T;
}

function listJsonBasenames(relativeDir: string): string[] {
  return readdirSync(new URL(relativeDir, import.meta.url))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
}

function pluginConfigInterfaceName(pluginName: string): string {
  return (
    pluginName
      .split('-')
      .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : ''))
      .join('') + 'Config'
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function findDisallowedSchemaKeys(node: unknown, path: string): string[] {
  if (!isPlainObject(node)) {
    return [];
  }

  const violations: string[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (!ALLOWED_STRUCTURE_ONLY_KEYS.has(key)) {
      violations.push(`${path}.${key}`);
      continue;
    }

    if ((key === 'fields' || key === 'shorthand_fields') && Array.isArray(value)) {
      for (let i = 0; i < value.length; i += 1) {
        const entry: unknown = value[i];
        if (!isPlainObject(entry)) {
          continue;
        }
        for (const [fieldName, fieldDef] of Object.entries(entry)) {
          violations.push(
            ...findDisallowedSchemaKeys(fieldDef, `${path}.${key}[${i}].${fieldName}`),
          );
        }
      }
    } else if ((key === 'elements' || key === 'keys' || key === 'values') && isPlainObject(value)) {
      violations.push(...findDisallowedSchemaKeys(value, `${path}.${key}`));
    }
    // `default` holds runtime default values (not schema nodes), so its nested keys are not schema keys.
  }

  return violations;
}

describe('recorded schemas and generated plugins contract', () => {
  const plugins39 = listJsonBasenames('../../schemas/kong-3.9/plugins/');
  const plugins314 = listJsonBasenames('../../schemas/kong-gateway-3.14/plugins/');
  const entities39 = listJsonBasenames('../../schemas/kong-3.9/entities/');
  const entities314 = listJsonBasenames('../../schemas/kong-gateway-3.14/entities/');

  it('gives every plugin in schemas/kong-3.9/plugins a category and a generated config type', () => {
    const categoriesFile = readJson<PluginCategoriesFile>('../../schemas/plugin-categories.json');
    const generatedPluginsSource = readFileSync(
      new URL('../../src/generated/plugins.ts', import.meta.url),
      'utf8',
    );

    expect(plugins39).toHaveLength(45);
    expect(Object.keys(PLUGINS).sort()).toEqual(plugins39);

    for (const pluginName of plugins39) {
      const declared = categoriesFile.plugins[pluginName];
      expect(declared, `missing category for ${pluginName}`).toBeDefined();
      expect(declared!.category.trim().length).toBeGreaterThan(0);
      expect(declared!.title.trim().length).toBeGreaterThan(0);

      const info = PLUGINS[pluginName as PluginName];
      expect(info.category).toBe(declared!.category);
      expect(info.title).toBe(declared!.title);
      expect(info.targets).toContain('kong-3.9');
      expect(info.scopes.length).toBeGreaterThan(0);
      expect(info.protocols.length).toBeGreaterThan(0);

      const ifaceName = pluginConfigInterfaceName(pluginName);
      expect(generatedPluginsSource).toContain(`export interface ${ifaceName}`);
    }
  });

  it('keeps kong-gateway-3.14 restricted to the exact 45 plugins and 21 entities of kong-3.9', () => {
    expect(entities39).toHaveLength(21);
    expect(entities314).toEqual(entities39);
    expect(plugins314).toEqual(plugins39);
  });

  it('keeps only the allowed 13 structural keys in schemas/kong-gateway-3.14', () => {
    const violations: string[] = [];

    for (const entity of entities314) {
      const schema = readJson<unknown>(`../../schemas/kong-gateway-3.14/entities/${entity}.json`);
      violations.push(...findDisallowedSchemaKeys(schema, `entities/${entity}.json`));
    }

    for (const plugin of plugins314) {
      const schema = readJson<unknown>(`../../schemas/kong-gateway-3.14/plugins/${plugin}.json`);
      violations.push(...findDisallowedSchemaKeys(schema, `plugins/${plugin}.json`));
    }

    expect(violations).toEqual([]);
  });

  it('stores only non-environmental metadata in info.json for both targets', () => {
    const info39 = readJson<RecordingInfo>('../../schemas/kong-3.9/info.json');
    const info314 = readJson<RecordingInfo>('../../schemas/kong-gateway-3.14/info.json');

    expect(Object.keys(info39).sort()).toEqual(['edition', 'image', 'target', 'version']);
    expect(info39.target).toBe('kong-3.9');
    expect(info39.edition).toBe('community');

    expect(Object.keys(info314).sort()).toEqual([
      'edition',
      'image',
      'other_endpoints',
      'target',
      'version',
    ]);
    expect(info314.target).toBe('kong-gateway-3.14');
    expect(info314.edition).toBe('enterprise');
    expect(typeof info314.other_endpoints).toBe('number');
    expect(info314.other_endpoints).toBeGreaterThan(0);
  });
});
