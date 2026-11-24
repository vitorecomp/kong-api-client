import { describe, expect, it } from 'vitest';
import { runDeleteAll } from '../../src/apply/delete-all.js';
import {
  Collection,
  Kong,
  KongError,
  KongResources,
  Transport,
  type DeleteAllOptions,
} from '../../src/index.js';
import { createFakeFetch } from '../support/fake-fetch.js';

describe('Kong.deleteAll unit tests', () => {
  it('covers every top-level Collection property on KongResources', async () => {
    const fake = createFakeFetch();
    const resources = new KongResources(
      new Transport({ adminUrl: 'http://localhost:8001', fetch: fake.fetch }),
    );

    const collectionProps = Object.entries(resources)
      .filter(([, value]) => value instanceof Collection)
      .map(([name]) => name)
      .sort();

    expect(collectionProps.length).toBeGreaterThan(0);
    for (let i = 0; i < collectionProps.length; i += 1) {
      fake.json({ data: [], next: null });
    }

    const result = await runDeleteAll(resources, { confirm: 'delete-everything' });
    expect(Object.keys(result.deleted).sort()).toEqual(collectionProps);
  });
  it('throws KongError before making any request when confirmation is missing or wrong', async () => {
    const fake = createFakeFetch();
    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });

    await expect(kong.deleteAll(undefined as unknown as DeleteAllOptions)).rejects.toThrow(
      KongError,
    );
    await expect(kong.deleteAll({} as unknown as DeleteAllOptions)).rejects.toThrow(KongError);
    await expect(
      kong.deleteAll({ confirm: 'nope' } as unknown as DeleteAllOptions),
    ).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });

  it('deletes every first-class collection in children-before-parents order across multiple pages', async () => {
    const fake = createFakeFetch();

    // 1. plugins (2 items on page 1, 1 item on page 2, then empty)
    fake
      .json({ data: [{ id: 'p1' }, { id: 'p2' }], offset: 'o1' })
      .empty(204)
      .empty(204)
      .json({ data: [{ id: 'p3' }], next: null })
      .empty(204)
      .json({ data: [], next: null });

    // 2. oauth2Tokens (1 item, then empty)
    fake
      .json({ data: [{ id: 'ot1' }], next: null })
      .empty(204)
      .json({ data: [], next: null });

    // 3. routes (1 item, then empty)
    fake
      .json({ data: [{ id: 'r1' }], next: null })
      .empty(204)
      .json({ data: [], next: null });

    // 4. services (1 item, then empty)
    fake
      .json({ data: [{ id: 's1' }], next: null })
      .empty(204)
      .json({ data: [], next: null });

    // 5..20: remaining 16 resources empty
    for (let i = 0; i < 16; i += 1) {
      fake.json({ data: [], next: null });
    }

    const kong = new Kong({ adminUrl: 'http://localhost:8001', fetch: fake.fetch });
    const result = await kong.deleteAll({ confirm: 'delete-everything' });

    expect(result.deleted).toEqual({
      plugins: 3,
      oauth2Tokens: 1,
      routes: 1,
      services: 1,
      snis: 0,
      upstreams: 0,
      acls: 0,
      basicAuths: 0,
      hmacAuths: 0,
      jwts: 0,
      keyAuths: 0,
      oauth2: 0,
      consumers: 0,
      keys: 0,
      keySets: 0,
      certificates: 0,
      caCertificates: 0,
      vaults: 0,
      sessions: 0,
      acmeStorage: 0,
    });

    const paths = fake.requests.map((r) => `${r.method} ${new URL(r.url).pathname}`);
    expect(paths.indexOf('DELETE /plugins/p1')).toBeLessThan(paths.indexOf('DELETE /routes/r1'));
    expect(paths.indexOf('DELETE /routes/r1')).toBeLessThan(paths.indexOf('DELETE /services/s1'));
    expect(paths.indexOf('GET /keys')).toBeLessThan(paths.indexOf('GET /key-sets'));
    expect(paths.indexOf('GET /acls')).toBeLessThan(paths.indexOf('GET /consumers'));
    expect(paths.indexOf('GET /snis')).toBeLessThan(paths.indexOf('GET /certificates'));
  });
});
