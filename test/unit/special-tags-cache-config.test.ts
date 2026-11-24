import { describe, expect, it } from 'vitest';
import { KongError } from '../../src/errors.js';
import type { Page } from '../../src/pagination.js';
import { CacheApi } from '../../src/special/cache.js';
import {
  ConfigApi,
  type DeclarativeConfigResponse,
  type LoadedConfig,
} from '../../src/special/config.js';
import { TagsApi, type TagEntry } from '../../src/special/tags.js';
import { Transport } from '../../src/transport.js';
import { createFakeFetch } from '../support/fake-fetch.js';

function makeTransport() {
  const fake = createFakeFetch();
  const transport = new Transport({
    adminUrl: 'http://localhost:8001',
    fetch: fake.fetch,
  });
  return { fake, transport };
}

describe('TagsApi', () => {
  it('lists all tags with and without pagination params', async () => {
    const { fake, transport } = makeTransport();
    const tags = new TagsApi(transport);
    const page: Page<TagEntry> = {
      data: [{ tag: 'env:prod', entity_name: 'services', entity_id: 'svc-1' }],
      offset: 'cur-1',
      next: '/tags?offset=cur-1',
    };
    fake.json(page).json(page);

    const controller = new AbortController();
    await expect(tags.list()).resolves.toEqual(page);
    await expect(
      tags.list({ size: 20, offset: 'cur-0' }, { signal: controller.signal }),
    ).resolves.toEqual(page);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/tags',
    });
    const url = new URL(fake.requests[1]!.url);
    expect(url.pathname).toBe('/tags');
    expect(url.searchParams.get('size')).toBe('20');
    expect(url.searchParams.get('offset')).toBe('cur-0');
    expect(fake.requests[1]?.signal).toBeDefined();
  });

  it('lists entities for a tag, percent-encoding reserved characters in the tag segment', async () => {
    const { fake, transport } = makeTransport();
    const tags = new TagsApi(transport);
    const page: Page<TagEntry> = {
      data: [{ tag: 'managed-by:kong-api-client', entity_name: 'routes', entity_id: 'rt-1' }],
      next: null,
    };
    fake.json(page).json(page);

    const controller = new AbortController();
    await expect(tags.entities('managed-by:kong-api-client')).resolves.toEqual(page);
    await expect(
      tags.entities('team/a:b', { size: 5, offset: 'p2' }, { signal: controller.signal }),
    ).resolves.toEqual(page);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/tags/managed-by%3Akong-api-client',
    });
    const url = new URL(fake.requests[1]!.url);
    expect(url.pathname).toBe('/tags/team%2Fa%3Ab');
    expect(url.searchParams.get('size')).toBe('5');
    expect(url.searchParams.get('offset')).toBe('p2');
    expect(fake.requests[1]?.signal).toBeDefined();
  });

  it('rejects an empty tag without sending a request', async () => {
    const { fake, transport } = makeTransport();
    const tags = new TagsApi(transport);

    await expect(tags.entities('')).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });
});

describe('CacheApi', () => {
  it('purges, gets, and deletes cache entries, preserving colons in cache keys', async () => {
    const { fake, transport } = makeTransport();
    const cache = new CacheApi(transport);
    const cached = { message: '7d0b0d54' };
    fake.empty(204).json(cached).empty(204);

    const controller = new AbortController();
    await expect(cache.purge({ signal: controller.signal })).resolves.toBeUndefined();
    await expect(cache.get('router:version/v1', { signal: controller.signal })).resolves.toEqual(
      cached,
    );
    await expect(
      cache.delete('router:version/v1', { signal: controller.signal }),
    ).resolves.toBeUndefined();

    expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'DELETE http://localhost:8001/cache',
      'GET http://localhost:8001/cache/router:version%2Fv1',
      'DELETE http://localhost:8001/cache/router:version%2Fv1',
    ]);
    for (const req of fake.requests) {
      expect(req.signal).toBeDefined();
    }
  });

  it('rejects empty cache keys without sending requests', async () => {
    const { fake, transport } = makeTransport();
    const cache = new CacheApi(transport);

    await expect(cache.get('')).rejects.toThrow(KongError);
    await expect(cache.delete('')).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });
});

describe('ConfigApi', () => {
  it('fetches declarative config via GET /config', async () => {
    const { fake, transport } = makeTransport();
    const config = new ConfigApi(transport);
    const response: DeclarativeConfigResponse = {
      config: "_format_version: '3.0'\n",
    };
    fake.json(response);

    const controller = new AbortController();
    await expect(config.get({ signal: controller.signal })).resolves.toEqual(response);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/config',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('loads declarative config from an object or a YAML string with optional query flags', async () => {
    const { fake, transport } = makeTransport();
    const config = new ConfigApi(transport);
    const loaded: LoadedConfig = { services: { 'svc-1': { name: 'demo' } } };
    fake.json(loaded, 201).json(loaded, 201).json(loaded, 201).json(loaded, 201).json(loaded, 201);

    const objectPayload = { _format_version: '3.0', services: [{ name: 'demo', url: 'http://x' }] };
    const yamlPayload = '_format_version: "3.0"\nservices: []\n';
    const controller = new AbortController();

    await expect(config.load(objectPayload)).resolves.toEqual(loaded);
    await expect(
      config.load(yamlPayload, {
        checkHash: true,
        flattenErrors: true,
        signal: controller.signal,
      }),
    ).resolves.toEqual(loaded);
    await expect(
      config.load(objectPayload, { checkHash: false, flattenErrors: false }),
    ).resolves.toEqual(loaded);
    await expect(config.load(objectPayload, { checkHash: true })).resolves.toEqual(loaded);
    await expect(config.load(objectPayload, { flattenErrors: true })).resolves.toEqual(loaded);

    expect(fake.requests[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/config',
      json: objectPayload,
    });

    const url1 = new URL(fake.requests[1]!.url);
    expect(fake.requests[1]!.method).toBe('POST');
    expect(url1.pathname).toBe('/config');
    expect(url1.searchParams.get('check_hash')).toBe('1');
    expect(url1.searchParams.get('flatten_errors')).toBe('1');
    expect(fake.requests[1]!.json).toEqual({ config: yamlPayload });
    expect(fake.requests[1]!.signal).toBeDefined();

    const url2 = new URL(fake.requests[2]!.url);
    expect(url2.searchParams.get('check_hash')).toBe('0');
    expect(url2.searchParams.get('flatten_errors')).toBe('0');

    const url3 = new URL(fake.requests[3]!.url);
    expect(url3.searchParams.get('check_hash')).toBe('1');
    expect(url3.searchParams.has('flatten_errors')).toBe(false);

    const url4 = new URL(fake.requests[4]!.url);
    expect(url4.searchParams.has('check_hash')).toBe(false);
    expect(url4.searchParams.get('flatten_errors')).toBe('1');
  });
});
