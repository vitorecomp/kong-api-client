import { generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { KongHttpError } from '../../../src/index.js';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import { liveKong, unique } from '../../support/live.js';

function derLength(length: number): Buffer {
  if (length < 0x80) {
    return Buffer.from([length]);
  }
  const bytes: number[] = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function derTag(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derSequence(parts: Buffer[]): Buffer {
  return derTag(0x30, Buffer.concat(parts));
}

function derInteger(bytes: Buffer): Buffer {
  const needsZeroPad = (bytes[0] ?? 0) >= 0x80;
  return derTag(0x02, needsZeroPad ? Buffer.concat([Buffer.from([0x00]), bytes]) : bytes);
}

function derBitString(bytes: Buffer): Buffer {
  return derTag(0x03, Buffer.concat([Buffer.from([0x00]), bytes]));
}

function formatUtcTime(date: Date): Buffer {
  const pad = (n: number): string => String(n).padStart(2, '0');
  const text =
    String(date.getUTCFullYear()).slice(-2) +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z';
  return derTag(0x17, Buffer.from(text, 'ascii'));
}

function createSelfSignedCert(commonName: string): { cert: string; key: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const spki = publicKey.export({ type: 'spki', format: 'der' });

  // ecdsa-with-SHA256 (OID 1.2.840.10045.4.3.2)
  const sigAlg = derSequence([
    Buffer.from([0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x04, 0x03, 0x02]),
  ]);
  // CN=<commonName> (OID 2.5.4.3)
  const cnOid = Buffer.from([0x06, 0x03, 0x55, 0x04, 0x03]);
  const name = derSequence([
    derTag(0x31, derSequence([cnOid, derTag(0x0c, Buffer.from(commonName, 'utf8'))])),
  ]);

  const now = Date.now();
  const validity = derSequence([
    formatUtcTime(new Date(now - 60 * 60 * 1000)),
    formatUtcTime(new Date(now + 24 * 60 * 60 * 1000)),
  ]);

  const serial = randomBytes(16);
  serial[0] = (serial[0] ?? 0) & 0x7f;
  if (serial[0] === 0) {
    serial[0] = 1;
  }

  const version = derTag(0xa0, derInteger(Buffer.from([2])));
  const tbs = derSequence([version, derInteger(serial), sigAlg, name, validity, name, spki]);
  const signature = sign('sha256', tbs, privateKey);
  const certDer = derSequence([tbs, sigAlg, derBitString(signature)]);

  const b64 =
    certDer
      .toString('base64')
      .match(/.{1,64}/g)
      ?.join('\n') ?? '';
  const cert = `-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----\n`;
  const key = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

  return { cert, key };
}

describe('live special: acme endpoints', () => {
  const kong = liveKong();

  it('exercises /acme, /acme/certificates, and /acme/certificates/{host} with the acme plugin enabled', async () => {
    const host = `${unique('acme')}.example.test`;
    const { cert, key } = createSelfSignedCert(host);

    let pluginId: string | undefined;
    let certId: string | undefined;
    let storageId: string | undefined;

    try {
      const storedCert = await kong.certificates.create({
        cert,
        key,
        snis: [host],
      });
      certId = storedCert.id;

      const storageEntry = await kong.acmeStorage.create({
        key: `kong_acme:renew_config:${host}`,
        value: JSON.stringify({ host }),
      });
      storageId = storageEntry.id;

      const plugin = await kong.plugins.create({
        name: 'acme',
        config: {
          account_email: 'test@example.com',
          tos_accepted: true,
          storage: 'kong',
          domains: [host],
        },
      });
      pluginId = plugin.id;

      // GET /acme/certificates -> 200 (lists the seeded renew-tracked certificate)
      const list = await kong.acme.certificates();
      expect(Array.isArray(list.data)).toBe(true);
      if (Array.isArray(list.data)) {
        const matched = list.data.find((item) => item.host === host);
        expect(matched).toBeDefined();
        expect(matched?.valid).toBe(true);
        expect(matched?.issuer_cn).toBe(host);
      }

      // GET /acme/certificates/{host} -> 200 (parses the certificate served for the SNI)
      const single = await kong.acme.certificate(host);
      expect(single.data.host).toBe(host);
      expect(single.data.issuer_cn).toBe(host);
      expect(single.data.valid).toBe(true);
      expect(typeof single.data.digest).toBe('string');
      expect(single.data.digest.length).toBeGreaterThan(0);
      expect(typeof single.data.serial_number).toBe('string');
      expect(typeof single.data.pubkey_type).toBe('string');

      // PATCH /acme -> 202
      const renewed = await kong.acme.renew();
      expect(renewed.message).toMatch(/renewal/i);

      // POST /acme with HTTP-01 challenge flow check -> 400 (no port-80 listener / public DNS)
      await expect(
        kong.acme.createCertificate(host, { testHttpChallengeFlow: true }),
      ).rejects.toSatisfy((error: unknown) => {
        expect(error).toBeInstanceOf(KongHttpError);
        expect((error as KongHttpError).status).toBe(400);
        return true;
      });
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
