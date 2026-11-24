import { describe, expect, it } from 'vitest';
import { KongHttpError } from '../../../src/errors.js';
import type { PluginName } from '../../../src/generated/plugins.js';
import { Transport } from '../../../src/transport.js';
import { getLiveEnv } from '../../support/live.js';
import { PLUGIN_FIXTURES, resolvePluginFixture } from '../../support/plugin-fixtures.js';

interface ValidationResponse {
  message: string;
}

const pluginNames = Object.keys(PLUGIN_FIXTURES).sort() as PluginName[];

describe('plugin fixtures validation against live Kong', () => {
  const env = getLiveEnv();
  const transport = new Transport({ adminUrl: env.adminUrl });

  it('rejects a deliberately invalid plugin config so the endpoint is proven to validate', async () => {
    const request = transport.request<ValidationResponse>({
      method: 'POST',
      path: '/schemas/plugins/validate',
      body: {
        name: 'http-log',
        config: {
          http_endpoint: 'http://upstream:8080/collect',
          not_a_real_config_field: true,
        },
      },
    });

    await expect(request).rejects.toBeInstanceOf(KongHttpError);
    await expect(request).rejects.toMatchObject({
      status: 400,
      kongName: 'schema violation',
      code: expect.any(Number) as unknown,
      fields: expect.any(Object) as unknown,
    });
  });

  it.each(pluginNames)('accepts %s fixture config and updated config', async (name) => {
    const fixture = resolvePluginFixture(name, env.target);

    const initial = await transport.request<ValidationResponse>({
      method: 'POST',
      path: '/schemas/plugins/validate',
      body: {
        name,
        config: fixture.config,
      },
    });
    expect(initial.message).toBe('schema validation successful');

    const updated = await transport.request<ValidationResponse>({
      method: 'POST',
      path: '/schemas/plugins/validate',
      body: {
        name,
        config: {
          ...fixture.config,
          ...fixture.update.patch,
        },
      },
    });
    expect(updated.message).toBe('schema validation successful');
  });
});
