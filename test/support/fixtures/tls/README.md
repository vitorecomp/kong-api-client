# Throwaway TLS Test Fixtures

These PEM certificates and keys are **throwaway self-signed test fixtures** used exclusively by the live Admin API test suite to exercise `/certificates`, `/ca_certificates`, `/keys`, and related endpoints. They are not trusted by any authority and must never be used outside tests.

## Generation Commands

Generated with OpenSSL (valid for 10,000 days):

```bash
# Three distinct self-signed CA certificates (for /ca_certificates pagination)
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 10000 \
  -subj "/CN=test-ca-1.example.invalid/O=kong-api-client test fixture" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -keyout /tmp/ca-1.key -out test/support/fixtures/tls/ca-1.pem

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 10000 \
  -subj "/CN=test-ca-2.example.invalid/O=kong-api-client test fixture" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -keyout /tmp/ca-2.key -out test/support/fixtures/tls/ca-2.pem

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 10000 \
  -subj "/CN=test-ca-3.example.invalid/O=kong-api-client test fixture" \
  -addext "basicConstraints=critical,CA:TRUE" \
  -keyout /tmp/ca-3.key -out test/support/fixtures/tls/ca-3.pem

# Two RSA leaf certificates and keys (primary + replacement)
openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 10000 \
  -subj "/CN=rsa-leaf.example.invalid/O=kong-api-client test fixture" \
  -keyout test/support/fixtures/tls/rsa-key.pem -out test/support/fixtures/tls/rsa-cert.pem

openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 10000 \
  -subj "/CN=rsa-leaf-2.example.invalid/O=kong-api-client test fixture" \
  -keyout test/support/fixtures/tls/rsa-2-key.pem -out test/support/fixtures/tls/rsa-2-cert.pem

# ECDSA leaf certificate and key (for cert_alt / key_alt)
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -sha256 -days 10000 \
  -subj "/CN=ecdsa-leaf.example.invalid/O=kong-api-client test fixture" \
  -keyout test/support/fixtures/tls/ecdsa-key.pem -out test/support/fixtures/tls/ecdsa-cert.pem

# Public keys extracted from the RSA private keys (for /keys PEM payloads)
openssl pkey -in test/support/fixtures/tls/rsa-key.pem -pubout \
  -out test/support/fixtures/tls/rsa-pub.pem

openssl pkey -in test/support/fixtures/tls/rsa-2-key.pem -pubout \
  -out test/support/fixtures/tls/rsa-2-pub.pem
```
