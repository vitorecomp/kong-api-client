import { describe, expect, it } from 'vitest';
import { Kong, KongError, type KongOptions, type Service } from '../../src/index.js';
import { createFakeFetch } from '../support/fake-fetch.js';

describe('2.x regression tests (unit)', () => {
  it('regression #6: listing does not add a kongUrl field and deep-equals what Kong sent', async () => {
    const rawService: Service = {
      id: '11111111-2222-3333-4444-555555555555',
      created_at: 1_700_000_000,
      updated_at: 1_700_000_000,
      name: 'billing',
      retries: 5,
      protocol: 'http',
      host: 'billing.internal',
      port: 8080,
      path: '/v1',
      connect_timeout: 60_000,
      write_timeout: 60_000,
      read_timeout: 60_000,
      tags: ['team:core'],
      client_certificate: null,
      tls_verify: null,
      tls_verify_depth: null,
      ca_certificates: null,
      enabled: true,
    };

    const fake = createFakeFetch()
      .json({ data: [rawService], next: null })
      .json({ data: [rawService], next: null })
      .json({ data: [rawService], next: null });

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    const page = await kong.services.list();
    expect(page.data).toHaveLength(1);
    expect(page.data[0]).toStrictEqual(rawService);
    expect('kongUrl' in page.data[0]!).toBe(false);

    const all = await kong.services.all();
    expect(all).toStrictEqual([rawService]);
    expect('kongUrl' in all[0]!).toBe(false);

    const iterated: Service[] = [];
    for await (const svc of kong.services.iterate()) {
      iterated.push(svc);
    }
    expect(iterated).toStrictEqual([rawService]);
    expect('kongUrl' in iterated[0]!).toBe(false);
  });

  it('regression #8: constructing Kong without adminUrl throws KongError instead of TypeError', () => {
    expect(() => new Kong({} as KongOptions)).toThrow(KongError);
    expect(() => new Kong({} as KongOptions)).not.toThrow(TypeError);
    expect(() => new Kong({ adminUrl: '' })).toThrow(KongError);
  });
});
