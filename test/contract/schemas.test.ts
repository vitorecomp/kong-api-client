import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface NestedOrSingleDecl {
  path: string;
  resource: string;
}

interface ResourceDecl {
  path: string;
  entity: string;
  type: string;
  nested?: Record<string, NestedOrSingleDecl>;
  single?: Record<string, NestedOrSingleDecl>;
}

interface ResourcesFile {
  resources: Record<string, ResourceDecl>;
}

interface EndpointsFile {
  special: Record<string, string>;
  excluded: Record<string, string>;
}

interface PluginCategoryDecl {
  category: string;
  title: string;
}

interface PluginCategoriesFile {
  plugins: Record<string, PluginCategoryDecl>;
}

function readSchemaJson<T>(relativePath: string): T {
  const raw = readFileSync(new URL(relativePath, import.meta.url), 'utf8');
  return JSON.parse(raw) as T;
}

function deriveResourceTemplates(resources: Record<string, ResourceDecl>): string[] {
  const templates: string[] = [];
  for (const def of Object.values(resources)) {
    templates.push(`/${def.path}`);
    templates.push(`/${def.path}/{}`);
    for (const nested of Object.values(def.nested ?? {})) {
      templates.push(`/${def.path}/{}/${nested.path}`);
      templates.push(`/${def.path}/{}/${nested.path}/{}`);
    }
    for (const single of Object.values(def.single ?? {})) {
      templates.push(`/${def.path}/{}/${single.path}`);
    }
  }
  return templates;
}

function intersection(a: ReadonlySet<string>, b: ReadonlySet<string>): string[] {
  return [...a].filter((item) => b.has(item));
}

describe('schema declarations', () => {
  const resourcesFile = readSchemaJson<ResourcesFile>('../../schemas/resources.json');
  const endpointsFile = readSchemaJson<EndpointsFile>('../../schemas/endpoints.json');
  const pluginCategoriesFile = readSchemaJson<PluginCategoriesFile>(
    '../../schemas/plugin-categories.json',
  );

  it('derives unique resource templates that are pairwise disjoint from special and excluded endpoints', () => {
    const derivedList = deriveResourceTemplates(resourcesFile.resources);
    const derivedSet = new Set(derivedList);
    expect(derivedList.length).toBe(derivedSet.size);

    const specialSet = new Set(Object.keys(endpointsFile.special));
    const excludedSet = new Set(Object.keys(endpointsFile.excluded));

    expect(intersection(derivedSet, specialSet)).toEqual([]);
    expect(intersection(derivedSet, excludedSet)).toEqual([]);
    expect(intersection(specialSet, excludedSet)).toEqual([]);
  });

  it('references only declared resources in nested and single entries', () => {
    const declaredResources = new Set(Object.keys(resourcesFile.resources));
    const missing: string[] = [];

    for (const [resourceName, def] of Object.entries(resourcesFile.resources)) {
      for (const [nestedName, nested] of Object.entries(def.nested ?? {})) {
        if (!declaredResources.has(nested.resource)) {
          missing.push(`${resourceName}.nested.${nestedName} -> ${nested.resource}`);
        }
      }
      for (const [singleName, single] of Object.entries(def.single ?? {})) {
        if (!declaredResources.has(single.resource)) {
          missing.push(`${resourceName}.single.${singleName} -> ${single.resource}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('defines a non-empty category and title for every declared plugin', () => {
    const entries = Object.entries(pluginCategoriesFile.plugins);
    expect(entries.length).toBeGreaterThan(0);

    for (const [name, meta] of entries) {
      expect(name.trim().length).toBeGreaterThan(0);
      expect(meta.category.trim().length).toBeGreaterThan(0);
      expect(meta.title.trim().length).toBeGreaterThan(0);
    }
  });
});
