/** Package version. */
export const VERSION = '3.0.0-rc.1';

export { Kong } from './client.js';

export {
  KongConnectionError,
  KongError,
  KongHttpError,
  KongTimeoutError,
  type KongHttpErrorOptions,
} from './errors.js';

export {
  Transport,
  segment,
  type CallOptions,
  type HttpMethod,
  type KongOptions,
  type RequestOptions,
} from './transport.js';

export type { ListParams, Page, TagFilter } from './pagination.js';

export { Collection, Singleton } from './resource.js';
export { PluginCollection } from './plugin-collection.js';

export type * from './generated/entities.js';
export * from './generated/plugins.js';
export * from './generated/resources.js';
