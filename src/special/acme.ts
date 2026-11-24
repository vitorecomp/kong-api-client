import { segment, type CallOptions, type Transport } from '../transport.js';

/** Metadata for a certificate managed by Kong's ACME plugin. */
export interface AcmeCertificate {
  /** Colon-separated hex digest of the certificate. */
  digest: string;
  /** Certificate Common Name (host). */
  host: string;
  /** Certificate issuer Common Name. */
  issuer_cn: string;
  /** Start of the certificate validity window (`YYYY-MM-DD HH:MM:SS`). */
  not_before: string;
  /** End of the certificate validity window (`YYYY-MM-DD HH:MM:SS`). */
  not_after: string;
  /** Whether the certificate is currently valid. */
  valid: boolean;
  /** Colon-separated hex serial number. */
  serial_number: string;
  /** Public key algorithm short name. */
  pubkey_type: string;
  [key: string]: unknown;
}

/** Confirmation response returned by `POST /acme` and `PATCH /acme`. */
export interface AcmeActionResult {
  /** Status message from the ACME plugin. */
  message: string;
  [key: string]: unknown;
}

/** Response returned by `GET /acme/certificates`. */
export interface AcmeCertificatesResponse {
  /** Certificates managed by the ACME plugin (Kong returns `{}` when empty). */
  data: AcmeCertificate[] | Record<string, never>;
  [key: string]: unknown;
}

/** Response returned by `GET /acme/certificates/{host}`. */
export interface AcmeCertificateResponse {
  /** Metadata for the requested host's ACME certificate. */
  data: AcmeCertificate;
  [key: string]: unknown;
}

/** Options for creating or sanity-testing an ACME certificate via `POST /acme`. */
export interface CreateAcmeCertificateOptions extends CallOptions {
  /** When `true`, runs Kong's HTTP-01 challenge sanity check instead of issuing a certificate. */
  testHttpChallengeFlow?: boolean;
}

/** Options for listing ACME certificates via `GET /acme/certificates`. */
export interface ListAcmeCertificatesOptions extends CallOptions {
  /** When `true`, includes only expired or not-yet-valid certificates (`invalid_only=true`). */
  invalidOnly?: boolean;
}

/** Admin API endpoints exposed by Kong's ACME plugin. */
export class AcmeApi {
  private readonly transport: Transport;

  /** Creates an {@link AcmeApi} bound to the given transport. */
  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Creates a certificate for `host` or runs the HTTP-01 challenge sanity check (`POST /acme`). */
  createCertificate(
    host: string,
    options?: CreateAcmeCertificateOptions,
  ): Promise<AcmeActionResult> {
    const body: Record<string, unknown> = { host };
    if (options?.testHttpChallengeFlow !== undefined) {
      body.test_http_challenge_flow = options.testHttpChallengeFlow;
    }
    return this.transport.request<AcmeActionResult>({
      method: 'POST',
      path: '/acme',
      body,
      signal: options?.signal,
    });
  }

  /** Triggers an asynchronous renewal of ACME-managed certificates (`PATCH /acme`). */
  renew(options?: CallOptions): Promise<AcmeActionResult> {
    return this.transport.request<AcmeActionResult>({
      method: 'PATCH',
      path: '/acme',
      signal: options?.signal,
    });
  }

  /** Lists certificates managed by the ACME plugin (`GET /acme/certificates`). */
  certificates(options?: ListAcmeCertificatesOptions): Promise<AcmeCertificatesResponse> {
    return this.transport.request<AcmeCertificatesResponse>({
      method: 'GET',
      path: '/acme/certificates',
      query: options?.invalidOnly !== undefined ? { invalid_only: options.invalidOnly } : undefined,
      signal: options?.signal,
    });
  }

  /** Retrieves metadata for one ACME certificate by host (`GET /acme/certificates/{host}`). */
  async certificate(host: string, options?: CallOptions): Promise<AcmeCertificateResponse> {
    const encoded = segment(host);
    return this.transport.request<AcmeCertificateResponse>({
      method: 'GET',
      path: `/acme/certificates/${encoded}`,
      signal: options?.signal,
    });
  }
}
