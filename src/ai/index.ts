import type { Plugin, Route, RouteInput, Service, ServiceInput } from '../generated/entities.js';
import type {
  AiPromptDecoratorConfig,
  AiPromptGuardConfig,
  AiPromptTemplateConfig,
  AiProxyConfig,
  AiRequestTransformerConfig,
  AiResponseTransformerConfig,
} from '../generated/plugins.js';
import type { RoutesResource, ServicesResource } from '../generated/resources.js';
import type { PluginsApi, PluginScope } from '../plugins.js';
import type { CallOptions } from '../transport.js';

const DEFAULT_ROUTE_TYPE: AiRouteType = 'llm/v1/chat';
const DEFAULT_SERVICE_URL = 'http://localhost:32000';

/** Scope for an AI plugin helper; `undefined` attaches the plugin globally. */
export type AiTarget = PluginScope | undefined;

/** AI provider union derived directly from the generated `ai-proxy` plugin configuration. */
export type AiProvider = AiProxyConfig['model']['provider'];

/** AI route type union derived directly from the generated `ai-proxy` plugin configuration. */
export type AiRouteType = AiProxyConfig['route_type'];

/** Authentication credentials passed to the upstream AI provider by {@link AiApi.llmRoute}. */
export type AiAuth =
  | {
      /** HTTP header name carrying the credential (for example `'Authorization'`). */
      headerName: string;
      /** Full HTTP header value (for example `'Bearer sk-...'`). */
      headerValue: string;
    }
  | {
      /** Query or body parameter name carrying the credential. */
      paramName: string;
      /** Credential value for `paramName`. */
      paramValue: string;
      /** Whether to send the credential in the URL query string or request body. */
      paramLocation: 'query' | 'body';
    };

/** Options accepted by {@link AiApi.llmRoute}. */
export interface LlmRouteOptions extends CallOptions {
  /** Shared name for the service, the route, and the `ai-proxy` plugin instance. */
  name: string;
  /** Route path prefixes matching incoming LLM requests. */
  paths: string[];
  /** Optional route host filters. */
  hosts?: string[];
  /** Optional route HTTP method filters. */
  methods?: string[];
  /** Route protocols passed to Kong untouched (Kong's default differs between versions). */
  protocols?: NonNullable<RouteInput['protocols']>;
  /** Upstream AI provider format. */
  provider: AiProvider;
  /** Model identifier sent to the provider. */
  model: string;
  /** AI route operation type. Defaults to `'llm/v1/chat'`. */
  routeType?: AiRouteType;
  /** Provider authentication credentials (header or query/body parameter). */
  auth?: AiAuth;
  /** Full upstream AI endpoint URL, mapped to `config.model.options.upstream_url`. */
  upstreamUrl?: string;
  /** Additional `ai-proxy` configuration fields merged last so they override derived defaults. */
  config?: Partial<AiProxyConfig>;
  /** Dummy service URL for the Kong service (`ai-proxy` overrides the upstream). Defaults to `'http://localhost:32000'`. */
  serviceUrl?: string;
  /** Tags applied to the created service, route, and `ai-proxy` plugin. */
  tags?: string[];
}

/** Entities created or updated together by {@link AiApi.llmRoute}. */
export interface LlmRouteResult {
  /** The upserted Kong service. */
  service: Service;
  /** The upserted Kong route. */
  route: Route;
  /** The enabled `ai-proxy` plugin bound to the route. */
  plugin: Plugin<'ai-proxy'>;
}

function mapAuth(auth: AiAuth): NonNullable<AiProxyConfig['auth']> {
  if ('headerName' in auth) {
    return {
      header_name: auth.headerName,
      header_value: auth.headerValue,
    };
  }
  return {
    param_name: auth.paramName,
    param_value: auth.paramValue,
    param_location: auth.paramLocation,
  };
}

function buildProxyConfig(options: LlmRouteOptions): AiProxyConfig {
  const extra = options.config;

  const baseModelOptions: NonNullable<AiProxyConfig['model']['options']> | undefined =
    options.upstreamUrl !== undefined ? { upstream_url: options.upstreamUrl } : undefined;
  const extraModel = extra?.model;

  let mergedModelOptions: AiProxyConfig['model']['options'];
  if (extraModel && 'options' in extraModel && extraModel.options === null) {
    mergedModelOptions = null;
  } else if (baseModelOptions || extraModel?.options) {
    mergedModelOptions = {
      ...baseModelOptions,
      ...(extraModel?.options ?? undefined),
    };
  }

  const mergedModel: AiProxyConfig['model'] = {
    provider: options.provider,
    name: options.model,
    ...(extraModel ?? undefined),
  };
  if (mergedModelOptions !== undefined) {
    mergedModel.options = mergedModelOptions;
  }

  const baseAuth = options.auth ? mapAuth(options.auth) : undefined;
  let mergedAuth: AiProxyConfig['auth'];
  if (extra && 'auth' in extra) {
    if (extra.auth === null) {
      mergedAuth = null;
    } else if (baseAuth || extra.auth) {
      mergedAuth = { ...baseAuth, ...extra.auth };
    }
  } else {
    mergedAuth = baseAuth;
  }

  const result: AiProxyConfig = {
    route_type: options.routeType ?? DEFAULT_ROUTE_TYPE,
    ...extra,
    model: mergedModel,
  };
  if (mergedAuth !== undefined) {
    result.auth = mergedAuth;
  }
  return result;
}

/** High-level helpers for configuring Kong AI Gateway routes and AI plugins. */
export class AiApi {
  private readonly services: ServicesResource;
  private readonly routes: RoutesResource;
  private readonly plugins: PluginsApi;

  /** Creates an {@link AiApi} backed by the given Kong resources. */
  constructor(services: ServicesResource, routes: RoutesResource, plugins: PluginsApi) {
    this.services = services;
    this.routes = routes;
    this.plugins = plugins;
  }

  /**
   * Creates or updates a service, a route, and an `ai-proxy` plugin together.
   * Safe to call repeatedly: calling again with the same `name` updates the three entities in place.
   */
  async llmRoute(options: LlmRouteOptions): Promise<LlmRouteResult> {
    const callOptions: CallOptions | undefined = options.signal
      ? { signal: options.signal }
      : undefined;

    const serviceInput: ServiceInput = {
      name: options.name,
      url: options.serviceUrl ?? DEFAULT_SERVICE_URL,
    };
    if (options.tags !== undefined) {
      serviceInput.tags = options.tags;
    }
    const service = await this.services.upsert(options.name, serviceInput, callOptions);

    const routeInput: RouteInput = {
      name: options.name,
      service: { id: service.id },
      paths: options.paths,
    };
    if (options.hosts !== undefined) {
      routeInput.hosts = options.hosts;
    }
    if (options.methods !== undefined) {
      routeInput.methods = options.methods;
    }
    if (options.protocols !== undefined) {
      routeInput.protocols = options.protocols;
    }
    if (options.tags !== undefined) {
      routeInput.tags = options.tags;
    }
    const route = await this.routes.upsert(options.name, routeInput, callOptions);

    const plugin = await this.plugins.enable('ai-proxy', {
      on: { route: route.id },
      instanceName: options.name,
      config: buildProxyConfig(options),
      tags: options.tags,
      signal: options.signal,
    });

    return { service, route, plugin };
  }

  /** Enables the `ai-proxy` plugin on the given scope (or globally when `on` is `undefined`). */
  proxy(on: AiTarget, config: AiProxyConfig, options?: CallOptions): Promise<Plugin<'ai-proxy'>> {
    return this.plugins.enable('ai-proxy', { on, config, signal: options?.signal });
  }

  /** Enables the `ai-prompt-guard` plugin on the given scope (or globally when `on` is `undefined`). */
  promptGuard(
    on: AiTarget,
    config: AiPromptGuardConfig,
    options?: CallOptions,
  ): Promise<Plugin<'ai-prompt-guard'>> {
    return this.plugins.enable('ai-prompt-guard', { on, config, signal: options?.signal });
  }

  /** Enables the `ai-prompt-decorator` plugin on the given scope (or globally when `on` is `undefined`). */
  promptDecorator(
    on: AiTarget,
    config: AiPromptDecoratorConfig,
    options?: CallOptions,
  ): Promise<Plugin<'ai-prompt-decorator'>> {
    return this.plugins.enable('ai-prompt-decorator', { on, config, signal: options?.signal });
  }

  /** Enables the `ai-prompt-template` plugin on the given scope (or globally when `on` is `undefined`). */
  promptTemplate(
    on: AiTarget,
    config: AiPromptTemplateConfig,
    options?: CallOptions,
  ): Promise<Plugin<'ai-prompt-template'>> {
    return this.plugins.enable('ai-prompt-template', { on, config, signal: options?.signal });
  }

  /** Enables the `ai-request-transformer` plugin on the given scope (or globally when `on` is `undefined`). */
  requestTransformer(
    on: AiTarget,
    config: AiRequestTransformerConfig,
    options?: CallOptions,
  ): Promise<Plugin<'ai-request-transformer'>> {
    return this.plugins.enable('ai-request-transformer', { on, config, signal: options?.signal });
  }

  /** Enables the `ai-response-transformer` plugin on the given scope (or globally when `on` is `undefined`). */
  responseTransformer(
    on: AiTarget,
    config: AiResponseTransformerConfig,
    options?: CallOptions,
  ): Promise<Plugin<'ai-response-transformer'>> {
    return this.plugins.enable('ai-response-transformer', { on, config, signal: options?.signal });
  }
}
