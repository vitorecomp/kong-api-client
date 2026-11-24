import { readFileSync } from 'node:fs';

function readPem(filename: string): string {
  return readFileSync(new URL(`./${filename}`, import.meta.url), 'utf8');
}

/** Throwaway PEM certificates and keys for live Kong Admin API tests. */
export const TLS_FIXTURES = {
  ca1: readPem('ca-1.pem'),
  ca2: readPem('ca-2.pem'),
  ca3: readPem('ca-3.pem'),
  rsaCert: readPem('rsa-cert.pem'),
  rsaKey: readPem('rsa-key.pem'),
  rsaPub: readPem('rsa-pub.pem'),
  rsa2Cert: readPem('rsa-2-cert.pem'),
  rsa2Key: readPem('rsa-2-key.pem'),
  rsa2Pub: readPem('rsa-2-pub.pem'),
  ecdsaCert: readPem('ecdsa-cert.pem'),
  ecdsaKey: readPem('ecdsa-key.pem'),
} as const;
