import { PluginsResource } from './generated/resources.js';
import { segment, type CallOptions } from './transport.js';

interface EnabledPluginsResponse {
  enabled_plugins: string[];
}

/** Extended `/plugins` resource adding enabled plugin listing and legacy schema lookup. */
export class PluginsApi extends PluginsResource {
  /** Lists the names of all plugins enabled on the Kong node (`GET /plugins/enabled`). */
  async enabledNames(options?: CallOptions): Promise<string[]> {
    const response = await this.transport.request<EnabledPluginsResponse>({
      method: 'GET',
      path: '/plugins/enabled',
      signal: options?.signal,
    });
    return response.enabled_plugins;
  }

  /** Retrieves a plugin's config schema via the legacy endpoint (`GET /plugins/schema/{name}`). */
  async schema(name: string, options?: CallOptions): Promise<unknown> {
    const encoded = segment(name);
    return this.transport.request<unknown>({
      method: 'GET',
      path: `/plugins/schema/${encoded}`,
      signal: options?.signal,
    });
  }
}
