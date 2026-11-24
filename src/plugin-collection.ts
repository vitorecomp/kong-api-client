import type { Plugin, PluginInput } from './generated/entities.js';
import { Collection, type Patch } from './resource.js';
import { segment, type CallOptions } from './transport.js';

/** A collection of plugins. The plugin name selects the type of `config`. */
export class PluginCollection extends Collection<Plugin, PluginInput> {
  /** Creates a new plugin in this collection (`POST`). */
  override create<const N extends string>(
    input: PluginInput<N>,
    options?: CallOptions,
  ): Promise<Plugin<N>> {
    return this.transport.request<Plugin<N>>({
      method: 'POST',
      path: this.basePath,
      body: input,
      signal: options?.signal,
    });
  }

  /** Creates or replaces a plugin at the given key (`PUT`). */
  override async upsert<const N extends string>(
    key: string,
    input: PluginInput<N>,
    options?: CallOptions,
  ): Promise<Plugin<N>> {
    const encoded = segment(key);
    return this.transport.request<Plugin<N>>({
      method: 'PUT',
      path: `${this.basePath}/${encoded}`,
      body: input,
      signal: options?.signal,
    });
  }

  /** Partially updates an existing plugin by key (`PATCH`). */
  override async update<const N extends string = string>(
    key: string,
    patch: Patch<PluginInput<N>>,
    options?: CallOptions,
  ): Promise<Plugin<N>> {
    const encoded = segment(key);
    return this.transport.request<Plugin<N>>({
      method: 'PATCH',
      path: `${this.basePath}/${encoded}`,
      body: patch,
      signal: options?.signal,
    });
  }
}
