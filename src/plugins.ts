import { KongHttpError } from './errors.js';
import type { Plugin, PluginInput } from './generated/entities.js';
import type { ConfigOf } from './generated/plugins.js';
import { PluginsResource } from './generated/resources.js';
import { PluginCollection } from './plugin-collection.js';
import type { KongSchema } from './special/schemas.js';
import { segment, type CallOptions } from './transport.js';

interface EnabledPluginsResponse {
  enabled_plugins: string[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ASCII_INSTANCE_CHAR_RE = /^[A-Za-z0-9._~-]$/;

/** Scope attaching a plugin to a specific service, route, and/or consumer. */
export interface PluginScope {
  /** Service ID (UUID) or name. */
  service?: string;
  /** Route ID (UUID) or name. */
  route?: string;
  /** Consumer ID (UUID) or username. */
  consumer?: string;
}

/** Resolved entity IDs identifying the exact scope of a plugin (`null` or omitted for unscoped). */
export interface PluginScopeIds {
  /** Service UUID, or `null`/omitted if not scoped to a service. */
  service?: string | null;
  /** Route UUID, or `null`/omitted if not scoped to a route. */
  route?: string | null;
  /** Consumer UUID, or `null`/omitted if not scoped to a consumer. */
  consumer?: string | null;
}

/** Options accepted by {@link PluginsApi.enable}. */
export interface EnableOptions<N extends string> extends CallOptions {
  /** Scope to attach the plugin to. Omit for a global plugin. */
  on?: PluginScope;
  /** Plugin configuration, typed from the plugin name when known. */
  config?: ConfigOf<N>;
  /** Explicit Kong `instance_name`. Defaults to a name derived from the plugin name and scope. */
  instanceName?: string;
  /** Whether the plugin is enabled. */
  enabled?: boolean;
  /** Protocols on which the plugin runs. */
  protocols?: NonNullable<PluginInput['protocols']>;
  /** Tags attached to the plugin entity. */
  tags?: string[];
}

function sanitizeInstanceName(raw: string): string {
  // Kong's utf8_name validator accepts ASCII [A-Za-z0-9._~-] and non-ASCII UTF-8 bytes.
  // Replace only disallowed ASCII characters with '-'.
  let result = '';
  for (const ch of raw) {
    const code = ch.charCodeAt(0);
    if (code <= 0x7f && !ALLOWED_ASCII_INSTANCE_CHAR_RE.test(ch)) {
      result += '-';
    } else {
      result += ch;
    }
  }
  return result;
}

function deriveInstanceName(name: string, scope?: PluginScope): string {
  const parts = [name];
  if (scope?.service !== undefined) {
    parts.push('service', scope.service);
  }
  if (scope?.route !== undefined) {
    parts.push('route', scope.route);
  }
  if (scope?.consumer !== undefined) {
    parts.push('consumer', scope.consumer);
  }
  return sanitizeInstanceName(parts.join('.'));
}

function namedRef(value: string): { id: string } | { name: string } {
  return UUID_RE.test(value) ? { id: value } : { name: value };
}

function consumerRef(value: string): { id: string } | { username: string } {
  return UUID_RE.test(value) ? { id: value } : { username: value };
}

function extractRefId(value: unknown): string | null | undefined {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return undefined;
}

function parseScopeConflict(
  name: string,
  fields: Record<string, unknown> | undefined,
): PluginScopeIds | undefined {
  if (!fields || 'instance_name' in fields || fields.name !== name) {
    return undefined;
  }
  const service = extractRefId(fields.service);
  const route = extractRefId(fields.route);
  const consumer = extractRefId(fields.consumer);
  if (service === undefined || route === undefined || consumer === undefined) {
    return undefined;
  }
  return { service, route, consumer };
}

/** Extended `/plugins` resource adding idempotent `enable()`, scope lookup, enabled plugin listing, and legacy schema lookup. */
export class PluginsApi extends PluginsResource {
  /**
   * Finds an existing plugin matching `name` and the exact resolved scope IDs,
   * or returns `undefined` when no such plugin exists.
   *
   * Lists the narrowest nested collection (route, else service, else consumer) or
   * `/plugins` across all pages for a global plugin.
   */
  async findOnScope(
    name: string,
    scope: PluginScopeIds,
    options?: CallOptions,
  ): Promise<Plugin | undefined> {
    const targetService = scope.service ?? null;
    const targetRoute = scope.route ?? null;
    const targetConsumer = scope.consumer ?? null;

    const nestedPath =
      targetRoute !== null
        ? `/routes/${segment(targetRoute)}/plugins`
        : targetService !== null
          ? `/services/${segment(targetService)}/plugins`
          : targetConsumer !== null
            ? `/consumers/${segment(targetConsumer)}/plugins`
            : undefined;

    const collection =
      nestedPath !== undefined ? new PluginCollection(this.transport, nestedPath) : this;

    for await (const plugin of collection.iterate(undefined, options)) {
      const pluginService = plugin.service?.id ?? null;
      const pluginRoute = plugin.route?.id ?? null;
      const pluginConsumer = plugin.consumer?.id ?? null;
      if (
        plugin.name === name &&
        pluginService === targetService &&
        pluginRoute === targetRoute &&
        pluginConsumer === targetConsumer
      ) {
        return plugin;
      }
    }
    return undefined;
  }

  /**
   * Creates the plugin, or updates it when it already exists (`PUT /plugins/{instanceName}`).
   * If a plugin with the same name and scope already exists without that instance name,
   * adopts and replaces it via `PUT /plugins/{id}`. Safe to call repeatedly.
   */
  async enable<const N extends string>(name: N, options?: EnableOptions<N>): Promise<Plugin<N>> {
    const instanceName = options?.instanceName ?? deriveInstanceName(name, options?.on);
    const input: PluginInput<N> = {
      name,
      instance_name: instanceName,
    };

    if (options?.on?.service !== undefined) {
      input.service = namedRef(options.on.service);
    }
    if (options?.on?.route !== undefined) {
      input.route = namedRef(options.on.route);
    }
    if (options?.on?.consumer !== undefined) {
      input.consumer = consumerRef(options.on.consumer);
    }
    if (options?.config !== undefined) {
      input.config = options.config;
    }
    if (options?.enabled !== undefined) {
      input.enabled = options.enabled;
    }
    if (options?.protocols !== undefined) {
      input.protocols = options.protocols;
    }
    if (options?.tags !== undefined) {
      input.tags = options.tags;
    }

    const callOptions = options?.signal ? { signal: options.signal } : undefined;

    try {
      return await this.upsert(instanceName, input, callOptions);
    } catch (error) {
      if (
        !(error instanceof KongHttpError) ||
        error.status !== 409 ||
        error.kongName !== 'unique constraint violation'
      ) {
        throw error;
      }

      const conflictScope = parseScopeConflict(name, error.fields);
      if (!conflictScope) {
        throw error;
      }

      const existing = await this.findOnScope(name, conflictScope, callOptions);
      if (!existing) {
        throw error;
      }

      return this.upsert(existing.id, input, callOptions);
    }
  }

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
  async schema(name: string, options?: CallOptions): Promise<KongSchema> {
    const encoded = segment(name);
    return this.transport.request<KongSchema>({
      method: 'GET',
      path: `/plugins/schema/${encoded}`,
      signal: options?.signal,
    });
  }
}
