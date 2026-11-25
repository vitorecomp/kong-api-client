import { KongApplyError, KongHttpError } from '../errors.js';
import type {
  CaCertificateInput,
  CertificateInput,
  ConsumerInput,
  PluginInput,
  RouteInput,
  ServiceInput,
  SniInput,
  Target,
  TargetInput,
  UpstreamInput,
  VaultInput,
} from '../generated/entities.js';
import { MAP_FIELDS, SET_FIELDS } from '../generated/meta.js';
import type { KongResources, NestedInput } from '../generated/resources.js';
import type { PluginsApi } from '../plugins.js';
import type { Collection, Patch } from '../resource.js';
import { UNRESOLVED_REF, buildCreateTags, diffEntity, type ResolvedRefValue } from './diff.js';
import { normalizeTargetAddress } from './target.js';
import { expandServiceInput } from './url.js';

const DEFAULT_MANAGED_TAG = 'managed-by:kong-api-client';

/** Declarative configuration accepted by {@link Kong.apply}. */
export interface ApplyConfig<P extends readonly string[] = string[]> {
  /** TLS certificates keyed by UUID `id`. */
  certificates?: Array<CertificateInput & { id: string }>;
  /** CA certificates keyed by UUID `id`. */
  ca_certificates?: Array<CaCertificateInput & { id: string }>;
  /** SNI hostnames keyed by `name`. */
  snis?: Array<SniInput & { name: string }>;
  /** Vaults keyed by `prefix`. */
  vaults?: Array<VaultInput & { prefix: string }>;
  /** Upstreams keyed by `name`. */
  upstreams?: Array<UpstreamInput & { name: string }>;
  /** Upstream targets keyed by `<upstream>/<target>`. */
  targets?: Array<Omit<TargetInput, 'upstream'> & { upstream: string; target: string }>;
  /** Services keyed by `name`. */
  services?: Array<ServiceInput & { name: string }>;
  /** Routes keyed by `name`. */
  routes?: Array<RouteInput & { name: string }>;
  /** Consumers keyed by `username`. */
  consumers?: Array<ConsumerInput & { username: string }>;
  /** Plugins keyed by `instance_name`, with `config` typed from each plugin `name`. */
  plugins?: { [I in keyof P]: PluginInput<P[I]> & { instance_name: string } };
}

/** Options controlling {@link Kong.apply}. */
export interface ApplyOptions {
  /** When `true`, read and compare only without sending any write requests. */
  dryRun?: boolean;
  /** When `true`, delete managed entities carrying `tag` that are absent from the config. */
  prune?: boolean;
  /** Managed tag attached to every created or updated entity. Default `'managed-by:kong-api-client'`. */
  tag?: string;
}

/** One entity-level outcome recorded by {@link Kong.apply}. */
export interface ApplyChange {
  /** Resource collection name from {@link ApplyConfig}. */
  type: keyof ApplyConfig;
  /** Entity key (`<upstream>/<target>` for targets). */
  key: string;
  /** Action performed (or planned during a dry run). */
  action: 'create' | 'update' | 'unchanged' | 'delete';
  /** Top-level fields that differed when `action` is `'update'`. */
  fields?: string[];
}

/** Summary returned by {@link Kong.apply}. */
export interface ApplyResult {
  /** Ordered list of changes applied (or planned when `dryRun` is `true`). */
  changes: ApplyChange[];
  /** Counts of each action type across `changes`. */
  summary: {
    /** Number of entities created. */
    create: number;
    /** Number of entities updated. */
    update: number;
    /** Number of entities already matching the config. */
    unchanged: number;
    /** Number of managed entities deleted by `prune`. */
    delete: number;
  };
  /** Whether the run was executed in dry-run mode. */
  dryRun: boolean;
}

type RefResource = 'services' | 'routes' | 'consumers';
type StandardResourceType = Exclude<keyof ApplyConfig, 'targets'>;
type TaggedEntity = { id: string; tags: string[] | null };
type TaggedInput = { tags?: string[] | null };

function buildResult(changes: ApplyChange[], dryRun: boolean): ApplyResult {
  const summary = { create: 0, update: 0, unchanged: 0, delete: 0 };
  for (const change of changes) {
    summary[change.action] += 1;
  }
  return { changes: [...changes], summary, dryRun };
}

function getMetadataPaths(
  metadataMap: Readonly<Record<string, readonly string[]>>,
  entityKey: string,
  pluginName?: string,
): readonly string[] {
  const base = metadataMap[entityKey] ?? [];
  if (!pluginName) {
    return base;
  }
  const pluginPaths = metadataMap[`plugin:${pluginName}`];
  if (!pluginPaths || pluginPaths.length === 0) {
    return base;
  }
  return [...base, ...pluginPaths];
}

function isPlainObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readStringKey(record: object, field: string): string {
  const value: unknown = Reflect.get(record, field);
  if (typeof value === 'string') {
    return value;
  }
  const id: unknown = Reflect.get(record, 'id');
  return typeof id === 'string' ? id : '';
}

/** Returns a copy of `desired` with `tags` replaced by the managed tag list. */
function withManagedTags<I extends TaggedInput>(desired: I, managedTag: string): I {
  return {
    ...desired,
    tags: buildCreateTags(desired.tags, managedTag),
  };
}

/**
 * Narrows a dynamic top-level diff patch to `Patch<I>`. TypeScript cannot
 * preserve key-to-value correlation across `Object.entries`, though every key
 * and value comes directly from `desired: I` or the computed `tags: string[]`.
 */
function toTypedPatch<I extends TaggedInput>(patch: Record<string, unknown>): Patch<I> {
  return patch as Patch<I>;
}

function normalizePluginInput<N extends string>(
  plugin: PluginInput<N> & { instance_name: string },
): PluginInput & { instance_name: string } {
  const { config, ...rest } = plugin;
  return {
    ...rest,
    config:
      config === null || config === undefined ? config : Object.fromEntries(Object.entries(config)),
  };
}

/**
 * Applies a declarative configuration to Kong in dependency order.
 * Accepts optional `setFieldsMap` and `mapFieldsMap` metadata maps (defaulting
 * to generated `SET_FIELDS` and `MAP_FIELDS`) so callers and tests can supply
 * schema metadata explicitly.
 */
export async function runApply<const P extends readonly string[] = string[]>(
  resources: KongResources & { readonly plugins: PluginsApi },
  config: ApplyConfig<P>,
  options: ApplyOptions = {},
  setFieldsMap: Readonly<Record<string, readonly string[]>> = SET_FIELDS,
  mapFieldsMap: Readonly<Record<string, readonly string[]>> = MAP_FIELDS,
): Promise<ApplyResult> {
  const dryRun = options.dryRun ?? false;
  const prune = options.prune ?? false;
  const managedTag = options.tag ?? DEFAULT_MANAGED_TAG;

  const changes: ApplyChange[] = [];

  const knownIds: Record<RefResource, Map<string, string>> = {
    services: new Map(),
    routes: new Map(),
    consumers: new Map(),
  };
  const lookupMisses: Record<RefResource, Set<string>> = {
    services: new Set(),
    routes: new Set(),
    consumers: new Set(),
  };
  const pendingCreates: Record<RefResource | 'upstreams', Set<string>> = {
    services: new Set(),
    routes: new Set(),
    consumers: new Set(),
    upstreams: new Set(),
  };

  async function resolveReference(kind: RefResource, refValue: unknown): Promise<ResolvedRefValue> {
    if (refValue === null) {
      return null;
    }
    if (!isPlainObject(refValue)) {
      return UNRESOLVED_REF;
    }
    const directId: unknown = Reflect.get(refValue, 'id');
    if (typeof directId === 'string') {
      return directId;
    }
    const rawLookup: unknown =
      kind === 'consumers' ? Reflect.get(refValue, 'username') : Reflect.get(refValue, 'name');
    if (typeof rawLookup !== 'string' || rawLookup.length === 0) {
      return UNRESOLVED_REF;
    }
    const cached = knownIds[kind].get(rawLookup);
    if (cached !== undefined) {
      return cached;
    }
    if (pendingCreates[kind].has(rawLookup) || lookupMisses[kind].has(rawLookup)) {
      return UNRESOLVED_REF;
    }

    const found =
      kind === 'services'
        ? await resources.services.find(rawLookup)
        : kind === 'routes'
          ? await resources.routes.find(rawLookup)
          : await resources.consumers.find(rawLookup);
    if (found) {
      knownIds[kind].set(rawLookup, found.id);
      return found.id;
    }
    lookupMisses[kind].add(rawLookup);
    return UNRESOLVED_REF;
  }

  async function resolveRefFields(
    refFields: readonly (readonly [string, RefResource])[],
    desired: object,
  ): Promise<Record<string, ResolvedRefValue>> {
    const refs: Record<string, ResolvedRefValue> = {};
    for (const [fieldName, kind] of refFields) {
      const value: unknown = Reflect.get(desired, fieldName);
      if (value !== undefined) {
        refs[fieldName] = await resolveReference(kind, value);
      }
    }
    return refs;
  }

  async function runStep<T>(
    type: keyof ApplyConfig,
    key: string,
    action: ApplyChange['action'],
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      throw new KongApplyError({ type, key, action }, buildResult(changes, dryRun), error);
    }
  }

  async function applyEntity<
    E extends TaggedEntity,
    I extends TaggedInput,
    Item extends I,
  >(params: {
    type: StandardResourceType;
    collection: Collection<E, I>;
    items: readonly Item[] | undefined;
    keyField: keyof E & keyof Item & string;
    refKind?: RefResource;
    trackPending?: RefResource | 'upstreams';
    prepare?: (item: Item) => I;
    refFields?: readonly (readonly [string, RefResource])[];
    findAdopted?: (
      item: Item,
      resolvedRefs: Readonly<Record<string, ResolvedRefValue>>,
    ) => Promise<E | undefined>;
    getPluginName?: (item: Item) => string;
  }): Promise<void> {
    if (!params.items) {
      return;
    }
    for (const item of params.items) {
      const key = readStringKey(item, params.keyField);
      const desired: I = params.prepare ? params.prepare(item) : { ...item };

      let existing = await runStep(params.type, key, 'unchanged', () =>
        params.collection.find(key),
      );
      let adopted = false;
      let resolvedRefs: Record<string, ResolvedRefValue> | undefined;

      if (!existing && params.findAdopted && params.refFields) {
        const refFields = params.refFields;
        const findAdopted = params.findAdopted;
        resolvedRefs = await runStep(params.type, key, 'unchanged', () =>
          resolveRefFields(refFields, desired),
        );
        const foundByScope = await runStep(params.type, key, 'unchanged', () =>
          findAdopted(item, resolvedRefs!),
        );
        if (foundByScope) {
          existing = foundByScope;
          adopted = true;
        }
      }

      if (!existing) {
        const createPayload = withManagedTags(desired, managedTag);
        if (!dryRun) {
          const created = await runStep(params.type, key, 'create', () =>
            params.collection.upsert(key, createPayload),
          );
          if (params.refKind) {
            knownIds[params.refKind].set(key, created.id);
          }
        } else if (params.trackPending) {
          pendingCreates[params.trackPending].add(key);
        }
        changes.push({ type: params.type, key, action: 'create' });
        continue;
      }

      if (params.refKind) {
        knownIds[params.refKind].set(key, existing.id);
      }

      if (params.refFields && resolvedRefs === undefined) {
        const refFields = params.refFields;
        resolvedRefs = await runStep(params.type, key, 'update', () =>
          resolveRefFields(refFields, desired),
        );
      }

      const pluginName = params.getPluginName ? params.getPluginName(item) : undefined;
      const diff = diffEntity(desired, existing, {
        setFields: getMetadataPaths(setFieldsMap, params.type, pluginName),
        mapFields: getMetadataPaths(mapFieldsMap, params.type, pluginName),
        managedTag,
        resolvedRefs,
      });

      if (diff.fields.length === 0) {
        changes.push({ type: params.type, key, action: 'unchanged' });
        continue;
      }

      if (!dryRun) {
        const updateKey = adopted ? existing.id : key;
        const patch = toTypedPatch<I>(diff.patch);
        await runStep(params.type, key, 'update', () => params.collection.update(updateKey, patch));
      }
      changes.push({ type: params.type, key, action: 'update', fields: diff.fields });
    }
  }

  async function pruneEntity<E extends TaggedEntity, I, Item extends object>(params: {
    type: StandardResourceType;
    collection: Collection<E, I>;
    items: readonly Item[] | undefined;
    keyField: keyof E & keyof Item & string;
  }): Promise<void> {
    const desiredKeys = new Set(
      (params.items ?? []).map((item) => readStringKey(item, params.keyField)),
    );
    const managed = await runStep(params.type, '*', 'delete', () =>
      params.collection.all({ tags: [managedTag] }),
    );
    for (const entity of managed) {
      if (!Array.isArray(entity.tags) || !entity.tags.includes(managedTag)) {
        continue;
      }
      const key = readStringKey(entity, params.keyField);
      if (desiredKeys.has(key)) {
        continue;
      }
      if (!dryRun) {
        await runStep(params.type, key, 'delete', () => params.collection.delete(entity.id));
      }
      changes.push({ type: params.type, key, action: 'delete' });
    }
  }

  const pluginItems = config.plugins?.map((plugin) => normalizePluginInput(plugin));

  // Apply 1..5: certificates, ca_certificates, snis, vaults, upstreams
  await applyEntity({
    type: 'certificates',
    collection: resources.certificates,
    items: config.certificates,
    keyField: 'id',
  });
  await applyEntity({
    type: 'ca_certificates',
    collection: resources.caCertificates,
    items: config.ca_certificates,
    keyField: 'id',
  });
  await applyEntity({
    type: 'snis',
    collection: resources.snis,
    items: config.snis,
    keyField: 'name',
  });
  await applyEntity({
    type: 'vaults',
    collection: resources.vaults,
    items: config.vaults,
    keyField: 'prefix',
  });
  await applyEntity({
    type: 'upstreams',
    collection: resources.upstreams,
    items: config.upstreams,
    keyField: 'name',
    trackPending: 'upstreams',
  });

  // Apply 6: targets (created via POST below their upstream; matched by normalized target address)
  if (config.targets && config.targets.length > 0) {
    const targetsByUpstream = new Map<string, Target[]>();

    for (const item of config.targets) {
      const { upstream, ...rest } = item;
      const changeKey = `${upstream}/${item.target}`;
      const normalizedTarget = normalizeTargetAddress(item.target);
      const targetCollection = resources.upstreams.targets(upstream);

      let existingList = targetsByUpstream.get(upstream);
      if (existingList === undefined) {
        if (pendingCreates.upstreams.has(upstream)) {
          existingList = [];
        } else {
          existingList = await runStep('targets', changeKey, 'unchanged', async () => {
            try {
              return await targetCollection.all();
            } catch (error) {
              if (dryRun && error instanceof KongHttpError && error.status === 404) {
                return [];
              }
              throw error;
            }
          });
        }
        targetsByUpstream.set(upstream, existingList);
      }

      const existing = existingList.find(
        (t) => normalizeTargetAddress(t.target) === normalizedTarget,
      );
      if (!existing) {
        const createPayload: NestedInput<TargetInput, 'upstream'> = {
          ...rest,
          tags: buildCreateTags(rest.tags, managedTag),
        };
        if (!dryRun) {
          const created = await runStep('targets', changeKey, 'create', () =>
            targetCollection.create(createPayload),
          );
          existingList.push(created);
        }
        changes.push({ type: 'targets', key: changeKey, action: 'create' });
        continue;
      }

      const desiredForDiff: NestedInput<TargetInput, 'upstream'> = {
        ...rest,
        target: normalizedTarget,
      };
      const diff = diffEntity(desiredForDiff, existing, {
        setFields: getMetadataPaths(setFieldsMap, 'targets'),
        mapFields: getMetadataPaths(mapFieldsMap, 'targets'),
        managedTag,
      });

      if (diff.fields.length === 0) {
        changes.push({ type: 'targets', key: changeKey, action: 'unchanged' });
        continue;
      }

      if (!dryRun) {
        const patch = toTypedPatch<NestedInput<TargetInput, 'upstream'>>(diff.patch);
        const updated = await runStep('targets', changeKey, 'update', () =>
          targetCollection.update(existing.id, patch),
        );
        const idx = existingList.indexOf(existing);
        if (idx !== -1) {
          existingList[idx] = updated;
        }
      }
      changes.push({ type: 'targets', key: changeKey, action: 'update', fields: diff.fields });
    }
  }

  // Apply 7..10: services, routes, consumers, plugins
  await applyEntity({
    type: 'services',
    collection: resources.services,
    items: config.services,
    keyField: 'name',
    refKind: 'services',
    trackPending: 'services',
    prepare: expandServiceInput,
  });
  await applyEntity({
    type: 'routes',
    collection: resources.routes,
    items: config.routes,
    keyField: 'name',
    refKind: 'routes',
    trackPending: 'routes',
    refFields: [['service', 'services']],
  });
  await applyEntity({
    type: 'consumers',
    collection: resources.consumers,
    items: config.consumers,
    keyField: 'username',
    refKind: 'consumers',
    trackPending: 'consumers',
  });
  await applyEntity({
    type: 'plugins',
    collection: resources.plugins,
    items: pluginItems,
    keyField: 'instance_name',
    refFields: [
      ['service', 'services'],
      ['route', 'routes'],
      ['consumer', 'consumers'],
    ],
    findAdopted: async (item, refs) => {
      const scopeService = refs.service ?? null;
      const scopeRoute = refs.route ?? null;
      const scopeConsumer = refs.consumer ?? null;
      if (
        scopeService === UNRESOLVED_REF ||
        scopeRoute === UNRESOLVED_REF ||
        scopeConsumer === UNRESOLVED_REF
      ) {
        return undefined;
      }
      try {
        return await resources.plugins.findOnScope(item.name, {
          service: scopeService,
          route: scopeRoute,
          consumer: scopeConsumer,
        });
      } catch (error) {
        if (error instanceof KongHttpError && error.status === 404) {
          return undefined;
        }
        throw error;
      }
    },
    getPluginName: (item) => item.name,
  });

  // Prune in reverse dependency order
  if (prune) {
    await pruneEntity({
      type: 'plugins',
      collection: resources.plugins,
      items: pluginItems,
      keyField: 'instance_name',
    });
    await pruneEntity({
      type: 'consumers',
      collection: resources.consumers,
      items: config.consumers,
      keyField: 'username',
    });
    await pruneEntity({
      type: 'routes',
      collection: resources.routes,
      items: config.routes,
      keyField: 'name',
    });
    await pruneEntity({
      type: 'services',
      collection: resources.services,
      items: config.services,
      keyField: 'name',
    });

    // Reverse 6: targets (pruned per upstream named in `upstreams` or `targets`)
    const namedUpstreams = new Set<string>([
      ...(config.upstreams ?? []).map((u) => u.name),
      ...(config.targets ?? []).map((t) => t.upstream),
    ]);
    const desiredTargetsByUpstream = new Map<string, Set<string>>();
    for (const t of config.targets ?? []) {
      let set = desiredTargetsByUpstream.get(t.upstream);
      if (!set) {
        set = new Set();
        desiredTargetsByUpstream.set(t.upstream, set);
      }
      set.add(normalizeTargetAddress(t.target));
    }

    for (const upstreamName of namedUpstreams) {
      if (pendingCreates.upstreams.has(upstreamName)) {
        continue;
      }
      const targetCollection = resources.upstreams.targets(upstreamName);
      const managedTargets = await runStep('targets', `${upstreamName}/*`, 'delete', async () => {
        try {
          return await targetCollection.all({ tags: [managedTag] });
        } catch (error) {
          if (dryRun && error instanceof KongHttpError && error.status === 404) {
            return [];
          }
          throw error;
        }
      });
      const desiredForUpstream = desiredTargetsByUpstream.get(upstreamName) ?? new Set<string>();
      for (const target of managedTargets) {
        if (!Array.isArray(target.tags) || !target.tags.includes(managedTag)) {
          continue;
        }
        if (desiredForUpstream.has(normalizeTargetAddress(target.target))) {
          continue;
        }
        const changeKey = `${upstreamName}/${target.target}`;
        if (!dryRun) {
          await runStep('targets', changeKey, 'delete', () => targetCollection.delete(target.id));
        }
        changes.push({ type: 'targets', key: changeKey, action: 'delete' });
      }
    }

    await pruneEntity({
      type: 'upstreams',
      collection: resources.upstreams,
      items: config.upstreams,
      keyField: 'name',
    });
    await pruneEntity({
      type: 'vaults',
      collection: resources.vaults,
      items: config.vaults,
      keyField: 'prefix',
    });
    await pruneEntity({
      type: 'snis',
      collection: resources.snis,
      items: config.snis,
      keyField: 'name',
    });
    await pruneEntity({
      type: 'ca_certificates',
      collection: resources.caCertificates,
      items: config.ca_certificates,
      keyField: 'id',
    });
    await pruneEntity({
      type: 'certificates',
      collection: resources.certificates,
      items: config.certificates,
      keyField: 'id',
    });
  }

  return buildResult(changes, dryRun);
}
