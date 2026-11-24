#!/usr/bin/env node
/**
 * Records a running Kong Admin API into schemas/<target>/.
 *
 * Usage:
 *   node scripts/record-schemas.mjs \
 *     --admin-url <url> \
 *     --target <kong-3.9|kong-gateway-3.14> \
 *     [--structure-only] \
 *     [--only-from <dir>] \
 *     [--image <image>]
 */

import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const STRUCTURAL_KEYS = new Set([
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

const TARGET_IMAGE_PREFIX = {
  'kong-3.9': 'kong',
  'kong-gateway-3.14': 'kong/kong-gateway',
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function compareScalars(a, b) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), 'en');
}

function fieldEntryName(entry) {
  if (!isPlainObject(entry)) {
    return '';
  }
  const keys = Object.keys(entry);
  return keys[0] ?? '';
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeysDeep(value[key]);
  }
  return sorted;
}

/**
 * Normalizes a Kong schema node so repeated recordings against fresh Kong
 * instances produce byte-identical output:
 * - sorts `one_of` and `not_one_of` (Kong builds some of these from Lua hash tables)
 * - sorts nested record `fields` and `shorthand_fields` by field name (Kong builds
 *   some nested record field lists such as `upstreams.healthchecks` from Lua hash tables)
 * - when `structureOnly` is true, keeps only the 13 structural keys needed for code
 *   generation and drops all prose, constraints, and metadata.
 */
function normalizeSchemaNode(node, structureOnly, depth = 0) {
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (structureOnly && !STRUCTURAL_KEYS.has(key)) {
      continue;
    }
    if ((key === 'fields' || key === 'shorthand_fields') && Array.isArray(value)) {
      const normalized = value.map((entry) => {
        if (!isPlainObject(entry)) {
          return entry;
        }
        const nextEntry = {};
        for (const [fieldName, fieldDef] of Object.entries(entry)) {
          nextEntry[fieldName] = isPlainObject(fieldDef)
            ? normalizeSchemaNode(fieldDef, structureOnly, depth + 1)
            : fieldDef;
        }
        return nextEntry;
      });
      if (depth > 0) {
        normalized.sort((a, b) => fieldEntryName(a).localeCompare(fieldEntryName(b), 'en'));
      }
      out[key] = normalized;
    } else if ((key === 'elements' || key === 'keys' || key === 'values') && isPlainObject(value)) {
      out[key] = normalizeSchemaNode(value, structureOnly, depth + 1);
    } else if ((key === 'one_of' || key === 'not_one_of') && Array.isArray(value)) {
      out[key] = [...value].sort(compareScalars);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Removes startup-random defaults emitted by Kong so recordings are deterministic.
 * Currently only `plugins/session` `config.secret` has a random default generated on
 * every Kong boot (the field has `required: false`).
 */
function stripEphemeralDefaults(kind, name, schema) {
  if (kind !== 'plugin' || name !== 'session' || !Array.isArray(schema.fields)) {
    return;
  }
  for (const entry of schema.fields) {
    if (!isPlainObject(entry) || !isPlainObject(entry.config)) {
      continue;
    }
    const configFields = entry.config.fields;
    if (!Array.isArray(configFields)) {
      continue;
    }
    for (const cfgEntry of configFields) {
      if (isPlainObject(cfgEntry) && isPlainObject(cfgEntry.secret)) {
        delete cfgEntry.secret.default;
      }
    }
  }
}

async function fetchJson(adminUrl, endpointPath) {
  const url = `${adminUrl}${endpointPath}`;
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`GET ${url} failed with HTTP ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function writeStableJson(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const text = `${JSON.stringify(sortKeysDeep(data), null, 2)}\n`;
  await writeFile(filePath, text, 'utf8');
}

function extractAvailablePlugins(root) {
  const available = root?.plugins?.available_on_server;
  if (Array.isArray(available)) {
    return [...available].sort();
  }
  if (isPlainObject(available)) {
    return Object.keys(available).sort();
  }
  throw new Error('Could not find plugins.available_on_server in GET / response');
}

function defaultImageForTarget(target, version) {
  const prefix = TARGET_IMAGE_PREFIX[target];
  if (prefix) {
    return `${prefix}:${version}`;
  }
  return `${target}:${version}`;
}

function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv,
    options: {
      'admin-url': { type: 'string' },
      target: { type: 'string' },
      'structure-only': { type: 'boolean', default: false },
      'only-from': { type: 'string' },
      image: { type: 'string' },
    },
    strict: true,
  });

  if (!values['admin-url'] || !values.target) {
    throw new Error(
      'Usage: node scripts/record-schemas.mjs --admin-url <url> --target <target> [--structure-only] [--only-from <dir>] [--image <image>]',
    );
  }

  return {
    adminUrl: values['admin-url'].replace(/\/+$/, ''),
    target: values.target,
    structureOnly: Boolean(values['structure-only']),
    onlyFrom: values['only-from'] ? path.resolve(process.cwd(), values['only-from']) : undefined,
    image: values.image,
  };
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  const outDir = path.join(REPO_ROOT, 'schemas', args.target);

  const resourcesJson = JSON.parse(
    await readFile(path.join(REPO_ROOT, 'schemas', 'resources.json'), 'utf8'),
  );
  const entityNames = [
    ...new Set(Object.values(resourcesJson.resources).map((resource) => resource.entity)),
  ].sort();

  const root = await fetchJson(args.adminUrl, '/');
  const version = String(root.version ?? '');
  const edition = String(root.edition ?? '');
  if (!version || !edition) {
    throw new Error('GET / response did not contain version and edition');
  }

  const availablePlugins = extractAvailablePlugins(root);
  const availablePluginSet = new Set(availablePlugins);

  const endpointsResponse = await fetchJson(args.adminUrl, '/endpoints');
  if (!Array.isArray(endpointsResponse?.data)) {
    throw new Error('GET /endpoints response did not contain a data array');
  }
  const liveEndpoints = [...endpointsResponse.data].sort();

  let endpointsToWrite = liveEndpoints;
  let pluginsToRecord = availablePlugins;
  let otherEndpointsCount;

  if (args.onlyFrom) {
    const baseEndpoints = JSON.parse(
      await readFile(path.join(args.onlyFrom, 'endpoints.json'), 'utf8'),
    );
    const baseEndpointSet = new Set(baseEndpoints);
    endpointsToWrite = liveEndpoints.filter((ep) => baseEndpointSet.has(ep));
    otherEndpointsCount = liveEndpoints.length - endpointsToWrite.length;

    const basePluginFiles = await readdir(path.join(args.onlyFrom, 'plugins'));
    pluginsToRecord = basePluginFiles
      .filter((file) => file.endsWith('.json'))
      .map((file) => file.slice(0, -'.json'.length))
      .sort();

    const missingPlugins = pluginsToRecord.filter((name) => !availablePluginSet.has(name));
    if (missingPlugins.length > 0) {
      throw new Error(
        `Target ${args.target} is missing plugins present in ${args.onlyFrom}: ${missingPlugins.join(', ')}`,
      );
    }
  }

  const entitiesDir = path.join(outDir, 'entities');
  const pluginsDir = path.join(outDir, 'plugins');
  await rm(entitiesDir, { recursive: true, force: true });
  await rm(pluginsDir, { recursive: true, force: true });
  await mkdir(entitiesDir, { recursive: true });
  await mkdir(pluginsDir, { recursive: true });

  const info = {
    edition,
    image: args.image ?? defaultImageForTarget(args.target, version),
    target: args.target,
    version,
  };
  if (otherEndpointsCount !== undefined) {
    info.other_endpoints = otherEndpointsCount;
  }

  await writeStableJson(path.join(outDir, 'info.json'), info);
  await writeStableJson(path.join(outDir, 'endpoints.json'), endpointsToWrite);

  for (const entity of entityNames) {
    const schema = await fetchJson(args.adminUrl, `/schemas/${encodeURIComponent(entity)}`);
    const normalized = normalizeSchemaNode(schema, args.structureOnly);
    stripEphemeralDefaults('entity', entity, normalized);
    await writeStableJson(path.join(entitiesDir, `${entity}.json`), normalized);
  }

  for (const plugin of pluginsToRecord) {
    const schema = await fetchJson(args.adminUrl, `/schemas/plugins/${encodeURIComponent(plugin)}`);
    const normalized = normalizeSchemaNode(schema, args.structureOnly);
    stripEphemeralDefaults('plugin', plugin, normalized);
    await writeStableJson(path.join(pluginsDir, `${plugin}.json`), normalized);
  }

  console.log(
    `Recorded ${args.target} (${edition} ${version}): ${endpointsToWrite.length} endpoints, ${entityNames.length} entities, ${pluginsToRecord.length} plugins`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
