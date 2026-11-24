import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RESOURCE_TEMPLATES } from '../../src/generated/resources.js';

interface NestedOrSingleDecl {
  path: string;
  resource: string;
}

interface CollectionClassDecl {
  name: string;
  module: string;
}

interface ResourceDecl {
  path: string;
  entity: string;
  type: string;
  topLevel?: boolean;
  collectionClass?: CollectionClassDecl;
  nested?: Record<string, NestedOrSingleDecl>;
  single?: Record<string, NestedOrSingleDecl>;
}

interface ResourcesFile {
  resources: Record<string, ResourceDecl>;
}

interface SpecialEndpointDecl {
  methods: string[];
  call: string;
}

interface EndpointsFile {
  special: Record<string, SpecialEndpointDecl>;
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

function normalizeEndpointTemplate(endpoint: string): string {
  return endpoint.replace(/\{[^/}]+\}/g, '{}');
}

function deriveResourceTemplates(resources: Record<string, ResourceDecl>): string[] {
  const templates: string[] = [];
  for (const def of Object.values(resources)) {
    if (def.topLevel === false) {
      continue;
    }
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

describe('schema declarations and generated resource templates', () => {
  const resourcesFile = readSchemaJson<ResourcesFile>('../../schemas/resources.json');
  const endpointsFile = readSchemaJson<EndpointsFile>('../../schemas/endpoints.json');
  const pluginCategoriesFile = readSchemaJson<PluginCategoriesFile>(
    '../../schemas/plugin-categories.json',
  );
  const endpoints39 = readSchemaJson<string[]>('../../schemas/kong-3.9/endpoints.json');
  const endpoints314 = readSchemaJson<string[]>('../../schemas/kong-gateway-3.14/endpoints.json');

  it('matches RESOURCE_TEMPLATES to schemas/resources.json and keeps regular, special, and excluded disjoint', () => {
    const derivedList = deriveResourceTemplates(resourcesFile.resources);
    expect(RESOURCE_TEMPLATES).toEqual(derivedList);
    expect(RESOURCE_TEMPLATES).toHaveLength(89);

    const resourceSet = new Set(RESOURCE_TEMPLATES);
    expect(RESOURCE_TEMPLATES.length).toBe(resourceSet.size);

    const specialSet = new Set(Object.keys(endpointsFile.special));
    const excludedSet = new Set(Object.keys(endpointsFile.excluded));

    expect(intersection(resourceSet, specialSet)).toEqual([]);
    expect(intersection(resourceSet, excludedSet)).toEqual([]);
    expect(intersection(specialSet, excludedSet)).toEqual([]);

    for (const [template, entry] of Object.entries(endpointsFile.special)) {
      expect(entry.methods.length, `missing methods for ${template}`).toBeGreaterThan(0);
      expect(entry.call.trim().length, `missing call for ${template}`).toBeGreaterThan(0);
    }
  });

  it('accounts for every recorded kong-3.9 endpoint via RESOURCE_TEMPLATES, special, and excluded', () => {
    const specialTemplates = Object.keys(endpointsFile.special);
    const excludedTemplates = Object.keys(endpointsFile.excluded);

    const declared = [...RESOURCE_TEMPLATES, ...specialTemplates, ...excludedTemplates].sort();
    const recorded39 = endpoints39.map(normalizeEndpointTemplate).sort();

    expect(declared).toEqual(recorded39);
  });

  it('has every supported template (RESOURCE_TEMPLATES and special) in the kong-gateway-3.14 recording', () => {
    const specialTemplates = Object.keys(endpointsFile.special);
    const supported = [...RESOURCE_TEMPLATES, ...specialTemplates];

    const recorded314Set = new Set(endpoints314.map(normalizeEndpointTemplate));
    const missingIn314 = supported.filter((template) => !recorded314Set.has(template));

    expect(missingIn314).toEqual([]);
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
