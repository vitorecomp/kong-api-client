import { describe, expect, it } from 'vitest';
import { expandServiceInput, expandServiceUrl } from '../../src/apply/url.js';

describe('expandServiceUrl', () => {
  it.each([
    {
      url: 'http://example.com',
      expected: { protocol: 'http', host: 'example.com', port: 80, path: null },
    },
    {
      url: 'http://example.com/',
      expected: { protocol: 'http', host: 'example.com', port: 80, path: '/' },
    },
    {
      url: 'https://example.com',
      expected: { protocol: 'https', host: 'example.com', port: 443, path: null },
    },
    {
      url: 'grpc://example.com',
      expected: { protocol: 'grpc', host: 'example.com', port: 80, path: null },
    },
    {
      url: 'grpcs://example.com',
      expected: { protocol: 'grpcs', host: 'example.com', port: 80, path: null },
    },
    {
      url: 'tcp://example.com',
      expected: { protocol: 'tcp', host: 'example.com', port: 80, path: null },
    },
    {
      url: 'tls://example.com',
      expected: { protocol: 'tls', host: 'example.com', port: 80, path: null },
    },
    {
      url: 'udp://example.com',
      expected: { protocol: 'udp', host: 'example.com', port: 80, path: null },
    },
    {
      url: 'ws://example.com',
      expected: { protocol: 'ws', host: 'example.com', port: 80, path: null },
    },
    {
      url: 'wss://example.com',
      expected: { protocol: 'wss', host: 'example.com', port: 443, path: null },
    },
    {
      url: 'tcp://example.com:9000',
      expected: { protocol: 'tcp', host: 'example.com', port: 9000, path: null },
    },
    {
      url: 'http://example.com/a/../b',
      expected: { protocol: 'http', host: 'example.com', port: 80, path: '/a/../b' },
    },
    {
      url: 'http://example.com/a%20b',
      expected: { protocol: 'http', host: 'example.com', port: 80, path: '/a%20b' },
    },
    {
      url: 'http://example.com/p?x=1',
      expected: { protocol: 'http', host: 'example.com', port: 80, path: '/p' },
    },
    {
      url: 'http://example.com/p#frag',
      expected: { protocol: 'http', host: 'example.com', port: 80, path: '/p' },
    },
    {
      url: 'http://EXAMPLE.com',
      expected: { protocol: 'http', host: 'EXAMPLE.com', port: 80, path: null },
    },
    {
      url: 'http://[::1]:8080/x',
      expected: { protocol: 'http', host: '::1', port: 8080, path: '/x' },
    },
    {
      url: 'http://[::1]/x',
      expected: { protocol: 'http', host: '::1', port: 80, path: '/x' },
    },
    {
      url: 'http://user:pw@example.com/x',
      expected: { protocol: 'http', host: 'example.com', port: 80, path: '/x' },
    },
    {
      url: 'http://example.com?ignored=1',
      expected: { protocol: 'http', host: 'example.com', port: 80, path: null },
    },
    {
      url: 'HTTP://example.com/x',
      expected: { protocol: 'HTTP', host: 'example.com', port: 80, path: '/x' },
    },
    {
      url: 'ftp://example.com/file',
      expected: { protocol: 'ftp', host: 'example.com', port: 80, path: '/file' },
    },
  ])('expands $url accurately', ({ url, expected }) => {
    expect(expandServiceUrl(url)).toEqual(expected);
  });

  it.each([
    'example.com/x',
    'http://example.com:abc/x',
    'http:///only-path',
    '://missing-scheme',
    '123://bad-scheme',
    'http://[::1',
    'http://[]/x',
    'http://[::1]extra/x',
    'http://:8080/x',
  ])('returns undefined for unsplittable url %s so Kong validates it', (url) => {
    expect(expandServiceUrl(url)).toBeUndefined();
  });
});

describe('expandServiceInput', () => {
  it('returns a copy unchanged when url is absent or unsplittable', () => {
    const plain = { name: 'svc', host: 'example.com', port: 8080 };
    expect(expandServiceInput(plain)).toEqual(plain);

    const unsplittable = { name: 'svc', url: 'example.com/x' };
    expect(expandServiceInput(unsplittable)).toEqual(unsplittable);
  });

  it('expands url, drops the url key, and lets url win over protocol, host, port, and path', () => {
    expect(expandServiceInput({ name: 'svc', url: 'https://api.example.com/v1' })).toEqual({
      name: 'svc',
      protocol: 'https',
      host: 'api.example.com',
      port: 443,
      path: '/v1',
    });

    expect(
      expandServiceInput({
        name: 'svc',
        url: 'http://a.example.com:81/x',
        protocol: 'https',
        host: 'b.example.com',
        port: 99,
        path: '/y',
        retries: 3,
      }),
    ).toEqual({
      name: 'svc',
      protocol: 'http',
      host: 'a.example.com',
      port: 81,
      path: '/x',
      retries: 3,
    });
  });
});
