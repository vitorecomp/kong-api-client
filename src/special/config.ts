import type { CallOptions, Transport } from '../transport.js';

/** Current declarative configuration returned by `GET /config` on a DB-less Kong node. */
export interface DeclarativeConfigResponse {
  /** Active declarative configuration serialized as YAML. */
  config: string;
  [key: string]: unknown;
}

/** Options for loading declarative configuration via `POST /config`. */
export interface LoadConfigOptions extends CallOptions {
  /** When `true`, sends `check_hash=1` so Kong responds with `304` when unchanged. */
  checkHash?: boolean;
  /** When `true`, sends `flatten_errors=1` for flattened validation error payloads. */
  flattenErrors?: boolean;
}

/** Entities loaded into a DB-less Kong node by `POST /config`, keyed by entity type. */
export type LoadedConfig = Record<string, unknown>;

/** Admin API endpoints for reading and loading declarative configuration on DB-less nodes. */
export class ConfigApi {
  private readonly transport: Transport;

  /** Creates a {@link ConfigApi} bound to the given transport. */
  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Exports the active declarative configuration (`GET /config`). DB-less mode only. */
  get(options?: CallOptions): Promise<DeclarativeConfigResponse> {
    return this.transport.request<DeclarativeConfigResponse>({
      method: 'GET',
      path: '/config',
      signal: options?.signal,
    });
  }

  /**
   * Replaces the active declarative configuration (`POST /config`). DB-less mode only.
   * Accepts either a YAML/JSON configuration string or a declarative config object.
   */
  load(
    config: string | Record<string, unknown>,
    options?: LoadConfigOptions,
  ): Promise<LoadedConfig> {
    const query: Record<string, string | number | boolean | undefined> | undefined =
      options?.checkHash !== undefined || options?.flattenErrors !== undefined
        ? {
            check_hash: options.checkHash !== undefined ? (options.checkHash ? 1 : 0) : undefined,
            flatten_errors:
              options.flattenErrors !== undefined ? (options.flattenErrors ? 1 : 0) : undefined,
          }
        : undefined;

    return this.transport.request<LoadedConfig>({
      method: 'POST',
      path: '/config',
      query,
      body: typeof config === 'string' ? { config } : config,
      signal: options?.signal,
    });
  }
}
