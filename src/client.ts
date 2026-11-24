import { KongResources } from './generated/resources.js';
import { PluginsApi } from './plugins.js';
import { AcmeApi } from './special/acme.js';
import { CacheApi } from './special/cache.js';
import { ClusteringApi } from './special/clustering.js';
import { ConfigApi } from './special/config.js';
import { DebugApi } from './special/debug.js';
import { NodeApi } from './special/node.js';
import { ProxyCacheApi } from './special/proxy-cache.js';
import { SchemasApi } from './special/schemas.js';
import { TagsApi } from './special/tags.js';
import { Transport, type KongOptions, type RequestOptions } from './transport.js';
import { UpstreamsApi } from './upstreams.js';

/** Client for the Kong Gateway Admin API. */
export class Kong extends KongResources {
  /** Extended `/plugins` resource adding enabled plugin listing and legacy schema lookup. */
  override readonly plugins: PluginsApi;
  /** Extended `/upstreams` resource adding health inspection, full target history, and manual health overrides. */
  override readonly upstreams: UpstreamsApi;
  /** Node metadata, status, endpoints, timers, and metrics endpoints. */
  readonly node: NodeApi;
  /** Entity, plugin, and vault schema inspection and validation endpoints. */
  readonly schemas: SchemasApi;
  /** Tag listing and tagged entity lookup endpoints. */
  readonly tags: TagsApi;
  /** Node-level database cache inspection and invalidation endpoints. */
  readonly cache: CacheApi;
  /** Declarative configuration endpoints for DB-less Kong nodes. */
  readonly config: ConfigApi;
  /** Runtime debug and dynamic log-level endpoints. */
  readonly debug: DebugApi;
  /** Hybrid-mode Control Plane clustering endpoints. */
  readonly clustering: ClusteringApi;
  /** ACME plugin certificate management endpoints. */
  readonly acme: AcmeApi;
  /** Proxy-cache plugin inspection and purge endpoints. */
  readonly proxyCache: ProxyCacheApi;

  /** Creates a new Kong Admin API client configured with the given options. */
  constructor(options: KongOptions) {
    const transport = new Transport(options);
    super(transport);
    this.plugins = new PluginsApi(transport);
    this.upstreams = new UpstreamsApi(transport);
    this.node = new NodeApi(transport);
    this.schemas = new SchemasApi(transport);
    this.tags = new TagsApi(transport);
    this.cache = new CacheApi(transport);
    this.config = new ConfigApi(transport);
    this.debug = new DebugApi(transport);
    this.clustering = new ClusteringApi(transport);
    this.acme = new AcmeApi(transport);
    this.proxyCache = new ProxyCacheApi(transport);
  }

  /**
   * Sends a low-level HTTP request to the Kong Admin API.
   * Use this escape hatch for endpoints not covered by typed resource methods.
   */
  request<T = unknown>(options: RequestOptions): Promise<T> {
    return this.transport.request<T>(options);
  }
}
