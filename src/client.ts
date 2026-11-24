import { KongResources } from './generated/resources.js';
import { Transport, type KongOptions, type RequestOptions } from './transport.js';

/** Client for the Kong Gateway Admin API. */
export class Kong extends KongResources {
  /** Creates a new Kong Admin API client configured with the given options. */
  constructor(options: KongOptions) {
    super(new Transport(options));
  }

  /**
   * Sends a low-level HTTP request to the Kong Admin API.
   * Use this escape hatch for endpoints not covered by typed resource methods.
   */
  request<T = unknown>(options: RequestOptions): Promise<T> {
    return this.transport.request<T>(options);
  }
}
