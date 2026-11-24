import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PLUGINS } from '../../src/generated/plugins.js';
import {
  PLUGIN_FIXTURES,
  PLUGIN_NAMES,
  type PluginFixturesMap,
} from '../support/plugin-fixtures.js';

function listRecordedPlugins(): string[] {
  return readdirSync(new URL('../../schemas/kong-3.9/plugins/', import.meta.url))
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
}

describe('plugin fixtures contract', () => {
  const recordedPlugins = listRecordedPlugins();

  it('provides a fixture and sorted PLUGIN_NAMES entry for every plugin in schemas/kong-3.9/plugins', () => {
    const fixtureNames = Object.keys(PLUGIN_FIXTURES).sort();
    expect(recordedPlugins).toHaveLength(45);
    expect(fixtureNames).toEqual(recordedPlugins);
    expect([...PLUGIN_NAMES]).toEqual(recordedPlugins);
  });

  it('uses an allowed scope (preferring route) and consistent update field for every fixture', () => {
    for (const name of PLUGIN_NAMES) {
      const fixture = PLUGIN_FIXTURES[name];
      const allowedScopes = PLUGINS[name].scopes;

      expect(allowedScopes, `invalid scope for ${name}`).toContain(fixture.scope);
      if (allowedScopes.includes('route')) {
        expect(fixture.scope, `${name} allows route and should prefer it`).toBe('route');
      }

      expect(
        Object.prototype.hasOwnProperty.call(fixture.update.patch, fixture.update.field),
        `update.patch for ${name} should include update.field (${fixture.update.field})`,
      ).toBe(true);
    }
  });

  it('rejects an incomplete PluginFixturesMap at compile time', () => {
    // @ts-expect-error PluginFixturesMap requires an entry for every PluginName
    const incomplete: PluginFixturesMap = {};
    expect(incomplete).toEqual({});
  });
});
