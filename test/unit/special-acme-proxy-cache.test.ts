import { describe, expect, it } from 'vitest';
import { KongError } from '../../src/errors.js';
import {
  AcmeApi,
  type AcmeActionResult,
  type AcmeCertificate,
  type AcmeCertificateResponse,
  type AcmeCertificatesResponse,
} from '../../src/special/acme.js';
import { ProxyCacheApi, type ProxyCacheEntry } from '../../src/special/proxy-cache.js';
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

describe('AcmeApi', () => {
  const sampleCert: AcmeCertificate = {
    digest: 'AA:BB',
    host: 'example.com',
    issuer_cn: 'Test CA',
    not_before: '2026-01-01 00:00:00',
    not_after: '2026-04-01 00:00:00',
    valid: true,
    serial_number: '01:02',
    pubkey_type: 'rsaEncryption',
  };

  it('creates a certificate and supports testHttpChallengeFlow', async () => {
    const { fake, transport } = makeTransport();
    const acme = new AcmeApi(transport);
    const created: AcmeActionResult = { message: 'certificate for host example.com is created' };
    const checked: AcmeActionResult = { message: 'sanity test for host example.com passed' };
    fake.json(created, 201).json(checked, 200);

    const controller = new AbortController();
    await expect(acme.createCertificate('example.com')).resolves.toEqual(created);
    await expect(
      acme.createCertificate('example.com', {
        testHttpChallengeFlow: true,
        signal: controller.signal,
      }),
    ).resolves.toEqual(checked);

    expect(fake.requests[0]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/acme',
      json: { host: 'example.com' },
    });
    expect(fake.requests[1]).toMatchObject({
      method: 'POST',
      url: 'http://localhost:8001/acme',
      json: { host: 'example.com', test_http_challenge_flow: true },
    });
    expect(fake.requests[1]?.signal).toBeDefined();
  });

  it('triggers certificate renewal via PATCH /acme', async () => {
    const { fake, transport } = makeTransport();
    const acme = new AcmeApi(transport);
    const response: AcmeActionResult = { message: 'Renewal process started successfully' };
    fake.json(response, 202);

    const controller = new AbortController();
    await expect(acme.renew({ signal: controller.signal })).resolves.toEqual(response);

    expect(fake.requests[0]).toMatchObject({
      method: 'PATCH',
      url: 'http://localhost:8001/acme',
      body: undefined,
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('lists ACME certificates with and without invalidOnly filter', async () => {
    const { fake, transport } = makeTransport();
    const acme = new AcmeApi(transport);
    const empty: AcmeCertificatesResponse = { data: {} };
    const populated: AcmeCertificatesResponse = { data: [sampleCert] };
    fake.json(empty).json(populated);

    const controller = new AbortController();
    await expect(acme.certificates()).resolves.toEqual(empty);
    await expect(
      acme.certificates({ invalidOnly: true, signal: controller.signal }),
    ).resolves.toEqual(populated);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/acme/certificates',
    });
    const url = new URL(fake.requests[1]!.url);
    expect(url.pathname).toBe('/acme/certificates');
    expect(url.searchParams.get('invalid_only')).toBe('true');
    expect(fake.requests[1]?.signal).toBeDefined();
  });

  it('fetches one ACME certificate by encoded host and rejects an empty host', async () => {
    const { fake, transport } = makeTransport();
    const acme = new AcmeApi(transport);
    const response: AcmeCertificateResponse = { data: sampleCert };
    fake.json(response);

    const controller = new AbortController();
    await expect(
      acme.certificate('*.example.com/path', { signal: controller.signal }),
    ).resolves.toEqual(response);

    expect(fake.requests[0]).toMatchObject({
      method: 'GET',
      url: 'http://localhost:8001/acme/certificates/*.example.com%2Fpath',
    });
    expect(fake.requests[0]?.signal).toBeDefined();

    await expect(acme.certificate('')).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(1);
  });
});

describe('ProxyCacheApi', () => {
  const sampleEntry: ProxyCacheEntry = {
    body: '{"ok":true}',
    body_len: 11,
    headers: { 'content-type': 'application/json' },
    status: 200,
    timestamp: 1700000000,
    ttl: 300,
    version: 1,
    req_body: '',
  };

  it('purges all proxy-cache entries via DELETE /proxy-cache', async () => {
    const { fake, transport } = makeTransport();
    const proxyCache = new ProxyCacheApi(transport);
    fake.empty(204);

    const controller = new AbortController();
    await expect(proxyCache.purge({ signal: controller.signal })).resolves.toBeUndefined();

    expect(fake.requests[0]).toMatchObject({
      method: 'DELETE',
      url: 'http://localhost:8001/proxy-cache',
    });
    expect(fake.requests[0]?.signal).toBeDefined();
  });

  it('gets and deletes entries globally or scoped by pluginId', async () => {
    const { fake, transport } = makeTransport();
    const proxyCache = new ProxyCacheApi(transport);
    fake.json(sampleEntry).json(sampleEntry).empty(204).empty(204);

    const controller = new AbortController();
    await expect(proxyCache.get('key/1', { signal: controller.signal })).resolves.toEqual(
      sampleEntry,
    );
    await expect(
      proxyCache.get('key/1', 'plugin/1', { signal: controller.signal }),
    ).resolves.toEqual(sampleEntry);
    await expect(
      proxyCache.delete('key/1', { signal: controller.signal }),
    ).resolves.toBeUndefined();
    await expect(
      proxyCache.delete('key/1', 'plugin/1', { signal: controller.signal }),
    ).resolves.toBeUndefined();

    expect(fake.requests.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET http://localhost:8001/proxy-cache/key%2F1',
      'GET http://localhost:8001/proxy-cache/plugin%2F1/caches/key%2F1',
      'DELETE http://localhost:8001/proxy-cache/key%2F1',
      'DELETE http://localhost:8001/proxy-cache/plugin%2F1/caches/key%2F1',
    ]);
    for (const req of fake.requests) {
      expect(req.signal).toBeDefined();
    }
  });

  it('rejects empty cacheKey or empty pluginId without sending requests', async () => {
    const { fake, transport } = makeTransport();
    const proxyCache = new ProxyCacheApi(transport);

    await expect(proxyCache.get('')).rejects.toThrow(KongError);
    await expect(proxyCache.get('k', '')).rejects.toThrow(KongError);
    await expect(proxyCache.delete('')).rejects.toThrow(KongError);
    await expect(proxyCache.delete('k', '')).rejects.toThrow(KongError);
    expect(fake.requests).toHaveLength(0);
  });
});
