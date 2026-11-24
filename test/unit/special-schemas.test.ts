import { describe, expect, it } from 'vitest';
import { KongError } from '../../src/errors.js';
import type { PluginInput, ServiceInput, VaultInput } from '../../src/generated/entities.js';
import {
  SchemasApi,
  type KongSchema,
  type SchemaValidationResult,
} from '../../src/special/schemas.js';
import { Transport } from '../../src/transport.js';
import { createFakeFetch } from '../support/fake-fetch.js';

function makeSchemasApi() {
  const fake = createFakeFetch();
  const transport = new Transport({
    adminUrl: 'http://localhost:8001',
    fetch: fake.fetch,
  });
  return { fake, schemas: new SchemasApi(transport) };
}

describe('SchemasApi', () => {
  it('fetches entity, plugin, and vault schemas with encoded names', async () => {
    const { fake, schemas } = makeSchemasApi();
    const schema: KongSchema = {
      fields: [{ id: { type: 'string', uuid: true } }],
      entity_checks: [],
    };
    fake.json(schema).json(schema).json(schema);

    const controller = new AbortController();
    await expect(schemas.entity('ca_certificates', { signal: controller.signal })).resolves.toEqual(
      schema,
    );
    await expect(schemas.plugin('key-auth/v1', { signal: controller.signal })).resolves.toEqual(
      schema,
    );
    await expect(schemas.vault('aws/ssm', { signal: controller.signal })).resolves.toEqual(schema);

    expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET http://localhost:8001/schemas/ca_certificates',
      'GET http://localhost:8001/schemas/plugins/key-auth%2Fv1',
      'GET http://localhost:8001/schemas/vaults/aws%2Fssm',
    ]);
    for (const req of fake.requests) {
      expect(req.signal).toBeDefined();
    }
  });

  it('validates entity, plugin, and vault payloads via POST', async () => {
    const { fake, schemas } = makeSchemasApi();
    const ok: SchemaValidationResult = { message: 'schema validation successful' };
    fake.json(ok).json(ok).json(ok);

    const serviceBody: ServiceInput = { host: 'example.com' };
    const pluginBody: PluginInput<'key-auth'> = { name: 'key-auth', config: {} };
    const vaultBody: VaultInput = { name: 'env', prefix: 'my-env', config: {} };

    const controller = new AbortController();
    await expect(
      schemas.validateEntity('services/custom', serviceBody, { signal: controller.signal }),
    ).resolves.toEqual(ok);
    await expect(
      schemas.validatePlugin(pluginBody, { signal: controller.signal }),
    ).resolves.toEqual(ok);
    await expect(schemas.validateVault(vaultBody, { signal: controller.signal })).resolves.toEqual(
      ok,
    );

    expect(fake.requests).toHaveLength(3);
    expect(fake.requests[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/schemas/services%2Fcustom/validate',
      json: serviceBody,
    });
    expect(fake.requests[1]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/schemas/plugins/validate',
      json: pluginBody,
    });
    expect(fake.requests[2]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/schemas/vaults/validate',
      json: vaultBody,
    });
    for (const req of fake.requests) {
      expect(req.signal).toBeDefined();
    }
  });

  it('rejects empty schema names without sending requests', async () => {
    const { fake, schemas } = makeSchemasApi();

    await expect(schemas.entity('')).rejects.toThrow(KongError);
    await expect(schemas.validateEntity('', { host: 'example.com' })).rejects.toThrow(KongError);
    await expect(schemas.plugin('')).rejects.toThrow(KongError);
    await expect(schemas.vault('')).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });
});
