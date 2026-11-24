import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import { captureHttpError } from '../../support/errors.js';
import { TLS_FIXTURES } from '../../support/fixtures/tls/index.js';
import { liveKong, unique } from '../../support/live.js';

describe('live special: acme endpoints', () => {
  const kong = liveKong();

  it('exercises /acme, /acme/certificates, and /acme/certificates/{host} with the acme plugin enabled', async () => {
    const sniHost = `${unique('acme')}.example.test`;
    const certCn = 'rsa-leaf.example.invalid';

    let pluginId: string | undefined;
    let certId: string | undefined;
    let storageId: string | undefined;

    try {
      const storedCert = await kong.certificates.create({
        cert: TLS_FIXTURES.rsaCert,
        key: TLS_FIXTURES.rsaKey,
        snis: [sniHost],
      });
      certId = storedCert.id;

      const storageEntry = await kong.acmeStorage.create({
        key: `kong_acme:renew_config:${sniHost}`,
        value: JSON.stringify({ host: sniHost }),
      });
      storageId = storageEntry.id;

      const plugin = await kong.plugins.create({
        name: 'acme',
        config: {
          account_email: 'test@example.com',
          tos_accepted: true,
          storage: 'kong',
          domains: [sniHost],
        },
      });
      pluginId = plugin.id;

      // GET /acme/certificates -> 200 (lists the seeded renew-tracked certificate)
      const list = await kong.acme.certificates();
      expect(Array.isArray(list.data)).toBe(true);
      if (Array.isArray(list.data)) {
        const matched = list.data.find((item) => item.host === certCn);
        expect(matched).toBeDefined();
        expect(matched?.valid).toBe(true);
        expect(matched?.issuer_cn).toBe(certCn);
      }

      // GET /acme/certificates/{host} -> 200 (parses the certificate served for the SNI)
      const single = await kong.acme.certificate(sniHost);
      expect(single.data.host).toBe(certCn);
      expect(single.data.issuer_cn).toBe(certCn);
      expect(single.data.valid).toBe(true);
      expect(typeof single.data.digest).toBe('string');
      expect(single.data.digest.length).toBeGreaterThan(0);
      expect(typeof single.data.serial_number).toBe('string');
      expect(single.data.pubkey_type).toBe('rsaEncryption');

      // PATCH /acme -> 202
      const renewed = await kong.acme.renew();
      expect(renewed.message).toMatch(/renewal/i);

      // POST /acme with HTTP-01 challenge flow check -> 400 (no port-80 listener / public DNS)
      const error = await captureHttpError(
        kong.acme.createCertificate(sniHost, { testHttpChallengeFlow: true }),
      );
      expect(error.status).toBe(400);
      expect(error.message).toMatch(/problem found running sanity check/);
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      if (storageId) {
        await deleteIgnoringNotFound(() => kong.acmeStorage.delete(storageId!));
      }
      if (certId) {
        await deleteIgnoringNotFound(() => kong.certificates.delete(certId!));
      }
    }
  });
});
