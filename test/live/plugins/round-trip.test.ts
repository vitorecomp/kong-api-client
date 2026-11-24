import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SET_FIELDS } from '../../../src/generated/meta.js';
import type { PluginName } from '../../../src/generated/plugins.js';
import type { PluginCollection } from '../../../src/plugin-collection.js';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import { getLiveEnv, liveKong, unique } from '../../support/live.js';
import { PLUGIN_FIXTURES, resolvePluginFixture } from '../../support/plugin-fixtures.js';

const pluginNames = Object.keys(PLUGIN_FIXTURES).sort() as PluginName[];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Deep-compares every field present in `expected` against `actual`,
 * treating schema `set` paths as order-insensitive while keeping array order elsewhere.
 */
function assertSubsetMatches(
  actual: unknown,
  expected: unknown,
  path: string,
  setPaths: ReadonlySet<string>,
): void {
  if (Array.isArray(expected)) {
    const expectedArr: unknown[] = expected;
    if (!Array.isArray(actual)) {
      expect.fail(`expected array at ${path}, got ${typeof actual}`);
    }
    const actualArr: unknown[] = actual;
    if (setPaths.has(path)) {
      expect(actualArr.length, `set length mismatch at ${path}`).toBe(expectedArr.length);
      expect([...actualArr].sort()).toEqual([...expectedArr].sort());
    } else {
      expect(actualArr.length, `array length mismatch at ${path}`).toBe(expectedArr.length);
      for (let i = 0; i < expectedArr.length; i += 1) {
        assertSubsetMatches(actualArr[i], expectedArr[i], `${path}[]`, setPaths);
      }
    }
    return;
  }

  if (isPlainObject(expected)) {
    if (!isPlainObject(actual)) {
      expect.fail(`expected object at ${path}, got ${typeof actual}`);
    }
    for (const [key, expectedVal] of Object.entries(expected)) {
      assertSubsetMatches(actual[key], expectedVal, `${path}.${key}`, setPaths);
    }
    return;
  }

  expect(actual, `value mismatch at ${path}`).toEqual(expected);
}

describe('live plugin round trip for all 45 plugins', () => {
  const env = getLiveEnv();
  const kong = liveKong();

  let serviceId = '';
  let routeId = '';
  let consumerId = '';

  beforeAll(async () => {
    const service = await kong.services.create({
      name: unique('plugin-rt-svc'),
      url: env.upstreamInternalUrl,
    });
    serviceId = service.id;

    const route = await kong.services.routes(serviceId).create({
      name: unique('plugin-rt-route'),
      paths: [`/${unique('rt')}`],
      protocols: ['http', 'https'],
    });
    routeId = route.id;

    const consumer = await kong.consumers.create({
      username: unique('plugin-rt-consumer'),
    });
    consumerId = consumer.id;
  });

  afterAll(async () => {
    await deleteIgnoringNotFound(() => kong.routes.delete(routeId));
    await deleteIgnoringNotFound(() => kong.services.delete(serviceId));
    await deleteIgnoringNotFound(() => kong.consumers.delete(consumerId));
  });

  function collectionForScope(scope: string): PluginCollection {
    switch (scope) {
      case 'global':
        return kong.plugins;
      case 'service':
        return kong.services.plugins(serviceId);
      case 'route':
        return kong.routes.plugins(routeId);
      case 'consumer':
        return kong.consumers.plugins(consumerId);
      default:
        throw new Error(`Unsupported plugin scope: ${scope}`);
    }
  }

  it.each(pluginNames)('round-trips %s (create, get, update, delete, find)', async (name) => {
    const fixture = resolvePluginFixture(name, env.target);
    const collection = collectionForScope(fixture.scope);
    const setPaths = new Set(SET_FIELDS[`plugin:${name}`] ?? []);
    const instanceName = unique(`rt-${name}`);

    let createdId: string | undefined;

    try {
      const created = await collection.create({
        name,
        instance_name: instanceName,
        config: fixture.config,
      });
      createdId = created.id;

      expect(created.name).toBe(name);
      expect(created.instance_name).toBe(instanceName);
      assertSubsetMatches(created.config, fixture.config, 'config', setPaths);

      const fetched = await collection.get(created.id);
      expect(fetched.id).toBe(created.id);
      expect(fetched.name).toBe(name);
      assertSubsetMatches(fetched.config, fixture.config, 'config', setPaths);

      const updated = await collection.update<PluginName>(created.id, {
        config: fixture.update.patch,
      });
      expect(updated.id).toBe(created.id);

      if (!isPlainObject(updated.config)) {
        expect.fail(`expected updated config object for ${name}`);
      }
      assertSubsetMatches(
        updated.config[fixture.update.field],
        fixture.update.value,
        `config.${fixture.update.field}`,
        setPaths,
      );

      // Every other field from the initial example config must survive PATCH intact.
      for (const [key, expectedVal] of Object.entries(fixture.config)) {
        if (key === fixture.update.field) {
          continue;
        }
        assertSubsetMatches(updated.config[key], expectedVal, `config.${key}`, setPaths);
      }

      await collection.delete(created.id);
      createdId = undefined;

      const afterDelete = await collection.find(created.id);
      expect(afterDelete).toBeUndefined();
    } finally {
      if (createdId !== undefined) {
        const idToDelete = createdId;
        await deleteIgnoringNotFound(() => collection.delete(idToDelete));
      }
    }
  });
});
