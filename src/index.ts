/** Package version. */
export const VERSION = '3.0.0-rc.1';

export { Kong } from './client.js';

export {
  KongApplyError,
  KongConnectionError,
  KongError,
  KongHttpError,
  KongTimeoutError,
  type KongHttpErrorOptions,
} from './errors.js';

export type { ApplyChange, ApplyConfig, ApplyOptions, ApplyResult } from './apply/apply.js';
export type { DeleteAllOptions, DeleteAllResult } from './apply/delete-all.js';

export {
  Transport,
  segment,
  type CallOptions,
  type HttpMethod,
  type KongOptions,
  type RequestOptions,
} from './transport.js';

export type { ListParams, Page, TagFilter } from './pagination.js';

export { Collection, Singleton, type Patch } from './resource.js';
export { PluginCollection } from './plugin-collection.js';
export {
  PluginsApi,
  type EnableOptions,
  type PluginScope,
  type PluginScopeIds,
} from './plugins.js';
export {
  UpstreamsApi,
  type BalancerHealth,
  type HealthWeight,
  type TargetAddressHealth,
  type TargetHealth,
  type TargetHealthState,
  type UpstreamBalancerHealthResponse,
  type UpstreamHealthOptions,
  type UpstreamHealthResponse,
  type UpstreamTargetsHealthResponse,
} from './upstreams.js';

export {
  AcmeApi,
  type AcmeActionResult,
  type AcmeCertificate,
  type AcmeCertificateResponse,
  type AcmeCertificatesResponse,
  type CreateAcmeCertificateOptions,
  type ListAcmeCertificatesOptions,
} from './special/acme.js';
export { CacheApi } from './special/cache.js';
export {
  ClusteringApi,
  type ClusteringDataPlane,
  type ClusteringDataPlanesParams,
  type ClusteringDataPlaneStatus,
  type ClusteringStatus,
} from './special/clustering.js';
export {
  ConfigApi,
  type DeclarativeConfigResponse,
  type LoadConfigOptions,
  type LoadedConfig,
} from './special/config.js';
export {
  DebugApi,
  type LogLevel,
  type LogLevelResponse,
  type SetLogLevelOptions,
} from './special/debug.js';
export {
  NodeApi,
  type DnsStatus,
  type NodeEndpoints,
  type NodeInfo,
  type NodeInfoPids,
  type NodeInfoPlugins,
  type NodeInfoTimers,
  type NodePluginAvailability,
  type NodeStatus,
  type NodeTimers,
  type SharedDictMemory,
  type WorkerInfo,
  type WorkerLuaVmMemory,
} from './special/node.js';
export { ProxyCacheApi, type ProxyCacheEntry } from './special/proxy-cache.js';
export { SchemasApi, type KongSchema, type SchemaValidationResult } from './special/schemas.js';
export { TagsApi, type TagEntry, type TagListParams } from './special/tags.js';

export {
  AiApi,
  type AiAuth,
  type AiProvider,
  type AiRouteType,
  type AiTarget,
  type LlmRouteOptions,
  type LlmRouteResult,
} from './ai/index.js';

export type * from './generated/entities.js';
export * from './generated/plugins.js';
export * from './generated/resources.js';
