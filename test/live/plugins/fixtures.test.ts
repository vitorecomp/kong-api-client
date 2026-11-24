import { describe, expect, it } from 'vitest';
import { Transport } from '../../../src/transport.js';
import { captureHttpError } from '../../support/errors.js';
import { getLiveEnv } from '../../support/live.js';
import { PLUGIN_NAMES, resolvePluginFixture } from '../../support/plugin-fixtures.js';

interface ValidationResponse {
  message: string;
}

describe('plugin fixtures validation against live Kong', () => {
  const env = getLiveEnv();
  const transport = new Transport({ adminUrl: env.adminUrl });

  it('rejects a deliberately invalid plugin config so the endpoint is proven to validate', async () => {
    const error = await captureHttpError(
      transport.request<ValidationResponse>({
        method: 'POST',
        path: '/schemas/plugins/validate',
        body: {
          name: 'http-log',
          config: {
            http_endpoint: 'http://upstream:8080/collect',
            not_a_real_config_field: true,
          },
        },
      }),
    );

    expect(error.status).toBe(400);
    expect(error.kongName).toBe('schema violation');
    expect(typeof error.code).toBe('number');
    expect(error.fields).toBeDefined();
    expect(typeof error.fields).toBe('object');
  });

  it.each(PLUGIN_NAMES)('accepts %s fixture config and updated config', async (name) => {
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
