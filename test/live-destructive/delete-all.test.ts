import { describe, expect, it } from 'vitest';
import { TLS_FIXTURES } from '../support/fixtures/tls/index.js';
import { liveKong, unique } from '../support/live.js';

describe('Kong.deleteAll destructive live test', () => {
  const kong = liveKong();

  it('empties every first-class resource collection (including >100 consumers) and reports exact counts', async () => {
    // Ensure a clean starting baseline before seeding exact counts
    await kong.deleteAll({ confirm: 'delete-everything' });

    // Seed 105 consumers (spans multiple pages of Kong's default 100-item page size)
    const consumerIds: string[] = [];
    const totalConsumers = 105;
    const batchSize = 15;
    for (let start = 0; start < totalConsumers; start += batchSize) {
      const count = Math.min(batchSize, totalConsumers - start);
      const batch = await Promise.all(
        Array.from({ length: count }, (_, offset) =>
          kong.consumers.create({ username: unique(`delall-c-${start + offset}`) }),
        ),
      );
      for (const consumer of batch) {
        consumerIds.push(consumer.id);
      }
    }
    const primaryConsumerId = consumerIds[0]!;

    // Seed at least one entity for every other first-class resource
    const cert = await kong.certificates.create({
      cert: TLS_FIXTURES.rsaCert,
      key: TLS_FIXTURES.rsaKey,
    });
    await kong.caCertificates.create({ cert: TLS_FIXTURES.ca1 });
    await kong.snis.create({
      name: `${unique('delall-sni')}.example.invalid`,
      certificate: { id: cert.id },
    });
    await kong.vaults.create({
      name: 'env',
      prefix: unique('delall-vlt').toLowerCase(),
      config: { prefix: 'KONG_DELALL_' },
    });
    const upstream = await kong.upstreams.create({
      name: `${unique('delall-up')}.example.invalid`,
      client_certificate: { id: cert.id },
    });
    await kong.upstreams.targets(upstream.id).create({ target: '10.0.5.1:8080', weight: 100 });

    const service = await kong.services.create({
      name: unique('delall-svc'),
      protocol: 'https',
      host: 'upstream',
      port: 8443,
      client_certificate: { id: cert.id },
    });
    const route = await kong.services.routes(service.id).create({
      name: unique('delall-route'),
      paths: [`/${unique('delall')}`],
      protocols: ['http', 'https'],
    });

    await kong.consumers.acls(primaryConsumerId).create({ group: 'admins' });
    await kong.consumers
      .basicAuth(primaryConsumerId)
      .create({ username: unique('ba'), password: 'secret-password' });
    await kong.consumers.hmacAuth(primaryConsumerId).create({ username: unique('hmac') });
    await kong.consumers.jwt(primaryConsumerId).create({});
    await kong.consumers.keyAuth(primaryConsumerId).create({});
    const oauthApp = await kong.consumers.oauth2(primaryConsumerId).create({
      name: unique('oauth-app'),
      redirect_uris: ['https://app.example.invalid/callback'],
    });
    await kong.oauth2Tokens.create({
      credential: { id: oauthApp.id },
      service: { id: service.id },
      expires_in: 3600,
    });

    await kong.plugins.create({
      name: 'correlation-id',
      instance_name: unique('delall-plug'),
      service: { id: service.id },
      route: { id: route.id },
      consumer: { id: primaryConsumerId },
    });

    const keySet = await kong.keySets.create({ name: unique('delall-ks') });
    await kong.keys.create({
      name: unique('delall-key'),
      kid: unique('delall-kid'),
      set: { id: keySet.id },
      pem: {
        private_key: TLS_FIXTURES.rsaKey,
        public_key: TLS_FIXTURES.rsaPub,
      },
    });

    await kong.sessions.create({ session_id: unique('delall-sess') });
    await kong.acmeStorage.create({ key: unique('delall-acme'), value: 'v1' });

    // Execute deleteAll
    const result = await kong.deleteAll({ confirm: 'delete-everything' });

    expect(result.deleted).toEqual({
      plugins: 1,
      oauth2Tokens: 1,
      routes: 1,
      services: 1,
      snis: 1,
      upstreams: 1,
      acls: 1,
      basicAuths: 1,
      hmacAuths: 1,
      jwts: 1,
      keyAuths: 1,
      oauth2: 1,
      consumers: totalConsumers,
      keys: 1,
      keySets: 1,
      certificates: 1,
      caCertificates: 1,
      vaults: 1,
      sessions: 1,
      acmeStorage: 1,
    });

    // Verify every single first-class collection is empty
    const collections = [
      kong.plugins,
      kong.oauth2Tokens,
      kong.routes,
      kong.services,
      kong.snis,
      kong.upstreams,
      kong.acls,
      kong.basicAuths,
      kong.hmacAuths,
      kong.jwts,
      kong.keyAuths,
      kong.oauth2,
      kong.consumers,
      kong.keys,
      kong.keySets,
      kong.certificates,
      kong.caCertificates,
      kong.vaults,
      kong.sessions,
      kong.acmeStorage,
    ];
    for (const col of collections) {
      const page = await col.list();
      expect(page.data).toEqual([]);
    }
  });
});
