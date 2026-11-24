import { describe, expect, it } from 'vitest';
import { captureHttpError } from '../../support/errors.js';
import { liveKong, unique } from '../../support/live.js';

function fieldNames(fields: Array<Record<string, unknown>>): string[] {
  return fields.flatMap((entry) => Object.keys(entry));
}

describe('live special: schema inspection and validation endpoints', () => {
  const kong = liveKong();

  it('fetches and validates entity schemas via /schemas/{name} and /schemas/{name}/validate', async () => {
    const schema = await kong.schemas.entity('services');
    const names = fieldNames(schema.fields);
    expect(names).toContain('host');
    expect(names).toContain('protocol');
    expect(names).toContain('port');

    const valid = await kong.schemas.validateEntity('services', {
      host: 'example.com',
      port: 80,
    });
    expect(valid.message).toBe('schema validation successful');

    const error = await captureHttpError(kong.schemas.validateEntity('services', { port: -1 }));
    expect(error.status).toBe(400);
    expect(error.kongName).toBe('schema violation');
    expect(typeof error.code).toBe('number');
    expect(error.fields).toBeDefined();
    expect(error.fields?.port).toBeDefined();
  });

  it('fetches and validates plugin schemas via /schemas/plugins/{name} and /schemas/plugins/validate', async () => {
    const schema = await kong.schemas.plugin('key-auth');
    expect(fieldNames(schema.fields)).toContain('config');

    const valid = await kong.schemas.validatePlugin({ name: 'key-auth', config: {} });
    expect(valid.message).toBe('schema validation successful');

    const error = await captureHttpError(
      kong.schemas.validatePlugin({ name: 'key-auth', config: { unknown_field: true } }),
    );
    expect(error.status).toBe(400);
    expect(error.kongName).toBe('schema violation');
  });

  it('fetches and validates vault schemas via /schemas/vaults/{name} and /schemas/vaults/validate', async () => {
    const schema = await kong.schemas.vault('env');
    expect(fieldNames(schema.fields)).toContain('config');

    const valid = await kong.schemas.validateVault({
      name: 'env',
      prefix: unique('vault-valid'),
      config: {},
    });
    expect(valid.message).toBe('schema validation successful');

    const error = await captureHttpError(
      kong.schemas.validateVault({ name: 'env', config: { unknown_field: true } }),
    );
    expect(error.status).toBe(400);
    expect(error.kongName).toBe('schema violation');
  });
});
