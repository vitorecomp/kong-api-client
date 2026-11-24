import { segment, type CallOptions, type Transport } from '../transport.js';

/** Schema definition returned by Kong's `/schemas/*` endpoints. */
export interface KongSchema {
  /** Ordered list of single-key field definitions. */
  fields: Array<Record<string, unknown>>;
  /** Entity-level validation rules, when present. */
  entity_checks?: unknown[];
  [key: string]: unknown;
}

/** Confirmation response returned when a schema validation endpoint succeeds. */
export interface SchemaValidationResult {
  /** Validation confirmation message from Kong. */
  message: string;
  [key: string]: unknown;
}

/** Admin API endpoints for inspecting and validating Kong entity, plugin, and vault schemas. */
export class SchemasApi {
  private readonly transport: Transport;

  /** Creates a {@link SchemasApi} bound to the given transport. */
  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Retrieves the schema of a Kong core entity (`GET /schemas/{name}`). */
  async entity(name: string, options?: CallOptions): Promise<KongSchema> {
    const encoded = segment(name);
    return this.transport.request<KongSchema>({
      method: 'GET',
      path: `/schemas/${encoded}`,
      signal: options?.signal,
    });
  }

  /** Validates a payload against a Kong core entity schema (`POST /schemas/{name}/validate`). */
  async validateEntity(
    name: string,
    body: unknown,
    options?: CallOptions,
  ): Promise<SchemaValidationResult> {
    const encoded = segment(name);
    return this.transport.request<SchemaValidationResult>({
      method: 'POST',
      path: `/schemas/${encoded}/validate`,
      body,
      signal: options?.signal,
    });
  }

  /** Retrieves the schema of a Kong plugin (`GET /schemas/plugins/{name}`). */
  async plugin(name: string, options?: CallOptions): Promise<KongSchema> {
    const encoded = segment(name);
    return this.transport.request<KongSchema>({
      method: 'GET',
      path: `/schemas/plugins/${encoded}`,
      signal: options?.signal,
    });
  }

  /** Validates a plugin configuration payload (`POST /schemas/plugins/validate`). */
  validatePlugin(body: unknown, options?: CallOptions): Promise<SchemaValidationResult> {
    return this.transport.request<SchemaValidationResult>({
      method: 'POST',
      path: '/schemas/plugins/validate',
      body,
      signal: options?.signal,
    });
  }

  /** Retrieves the schema of a Kong vault (`GET /schemas/vaults/{name}`). */
  async vault(name: string, options?: CallOptions): Promise<KongSchema> {
    const encoded = segment(name);
    return this.transport.request<KongSchema>({
      method: 'GET',
      path: `/schemas/vaults/${encoded}`,
      signal: options?.signal,
    });
  }

  /** Validates a vault configuration payload (`POST /schemas/vaults/validate`). */
  validateVault(body: unknown, options?: CallOptions): Promise<SchemaValidationResult> {
    return this.transport.request<SchemaValidationResult>({
      method: 'POST',
      path: '/schemas/vaults/validate',
      body,
      signal: options?.signal,
    });
  }
}
