import { segment, type CallOptions, type Transport } from '../transport.js';

/** Kong runtime log level names accepted by the dynamic log-level debug endpoints. */
export type LogLevel =
  | 'debug'
  | 'info'
  | 'notice'
  | 'warn'
  | 'error'
  | 'crit'
  | 'alert'
  | 'emerg'
  | (string & {});

/** Response returned by Kong's dynamic log-level endpoints. */
export interface LogLevelResponse {
  /** Status or confirmation message from Kong. */
  message: string;
  [key: string]: unknown;
}

/** Options for changing the dynamic log level on a node or cluster. */
export interface SetLogLevelOptions extends CallOptions {
  /** Duration in seconds before Kong reverts to its configured default log level. */
  timeout?: number;
}

/** Admin API endpoints for inspecting and dynamically adjusting Kong log levels. */
export class DebugApi {
  private readonly transport: Transport;

  /** Creates a {@link DebugApi} bound to the given transport. */
  constructor(transport: Transport) {
    this.transport = transport;
  }

  /** Retrieves the current log level of this Kong node (`GET /debug/node/log-level`). */
  getLogLevel(options?: CallOptions): Promise<LogLevelResponse> {
    return this.transport.request<LogLevelResponse>({
      method: 'GET',
      path: '/debug/node/log-level',
      signal: options?.signal,
    });
  }

  /** Sets the runtime log level of this Kong node (`PUT /debug/node/log-level/{level}`). */
  async setLogLevel(level: LogLevel, options?: SetLogLevelOptions): Promise<LogLevelResponse> {
    const encoded = segment(level);
    return this.transport.request<LogLevelResponse>({
      method: 'PUT',
      path: `/debug/node/log-level/${encoded}`,
      query: options?.timeout !== undefined ? { timeout: options.timeout } : undefined,
      signal: options?.signal,
    });
  }

  /** Broadcasts a runtime log level change across the cluster (`PUT /debug/cluster/log-level/{level}`). */
  async setClusterLogLevel(
    level: LogLevel,
    options?: SetLogLevelOptions,
  ): Promise<LogLevelResponse> {
    const encoded = segment(level);
    return this.transport.request<LogLevelResponse>({
      method: 'PUT',
      path: `/debug/cluster/log-level/${encoded}`,
      query: options?.timeout !== undefined ? { timeout: options.timeout } : undefined,
      signal: options?.signal,
    });
  }
}
