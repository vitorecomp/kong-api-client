/** Sentinel representing a foreign reference to an entity not yet created (for example during a dry run). */
export const UNRESOLVED_REF = Symbol('unresolved-ref');

/** Resolved value for a foreign-key field when comparing desired against stored entities. */
export type ResolvedRefValue = string | typeof UNRESOLVED_REF | null;

/** Options for {@link diffEntity}. */
export interface DiffEntityOptions {
  /** Schema paths (from `SET_FIELDS`) whose arrays are Kong `set` fields compared without order. */
  setFields?: readonly string[];
  /** Schema paths (from `MAP_FIELDS`) whose objects are Kong `map` fields compared whole. */
  mapFields?: readonly string[];
  /** Managed tag that must be present on the entity. */
  managedTag: string;
  /**
   * Pre-resolved foreign-key references keyed by top-level field name
   * (for example `service`, `route`, `consumer`).
   */
  resolvedRefs?: Readonly<Record<string, ResolvedRefValue>>;
}

/** Result of comparing a desired entity declaration against the stored Kong entity. */
export interface DiffResult {
  /** Top-level field names that differ (including `'tags'` when tags or the managed tag differ). */
  fields: string[];
  /** Partial PATCH payload holding the full desired value for each differing top-level field. */
  patch: Record<string, unknown>;
}

/** Result of computing the desired tag array for an entity. */
export interface TagComputation {
  /** Whether the entity's stored tags differ from the desired tags. */
  changed: boolean;
  /** The full desired tag list to send on create or update. */
  desiredTags: string[];
}

function isPlainObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTagList(value: unknown): readonly string[] | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }
  return undefined;
}

/** Tokenizes a schema path such as `config.rules[].methods` or `headers.*`. */
export function tokenizeSchemaPath(pattern: string): string[] {
  const tokens: string[] = [];
  for (const part of pattern.split('.')) {
    if (part.length === 0) {
      continue;
    }
    let remaining = part;
    const arraySuffixes: string[] = [];
    while (remaining.endsWith('[]')) {
      arraySuffixes.push('[]');
      remaining = remaining.slice(0, -2);
    }
    if (remaining.length > 0) {
      tokens.push(remaining);
    }
    for (const suffix of arraySuffixes) {
      tokens.push(suffix);
    }
  }
  return tokens;
}

function matchesSchemaPath(
  pathTokens: readonly string[],
  patterns: readonly (readonly string[])[],
): boolean {
  for (const pattern of patterns) {
    if (pattern.length !== pathTokens.length) {
      continue;
    }
    let matched = true;
    for (let i = 0; i < pattern.length; i += 1) {
      const p = pattern[i];
      const t = pathTokens[i];
      if (p !== t && !(p === '*' && t !== '[]')) {
        matched = false;
        break;
      }
    }
    if (matched) {
      return true;
    }
  }
  return false;
}

function hasPerfectMatching(adjacency: readonly number[][], rightCount: number): boolean {
  const matchRight = new Array<number>(rightCount).fill(-1);

  function tryAugment(left: number, visited: boolean[]): boolean {
    const neighbors = adjacency[left] ?? [];
    for (const right of neighbors) {
      if (visited[right]) {
        continue;
      }
      visited[right] = true;
      const assignedLeft = matchRight[right] ?? -1;
      if (assignedLeft === -1 || tryAugment(assignedLeft, visited)) {
        matchRight[right] = left;
        return true;
      }
    }
    return false;
  }

  for (let left = 0; left < adjacency.length; left += 1) {
    const visited = new Array<boolean>(rightCount).fill(false);
    if (!tryAugment(left, visited)) {
      return false;
    }
  }
  return true;
}

function setsEqual(
  desired: readonly unknown[],
  actual: readonly unknown[],
  elemPath: readonly string[],
  setPatterns: readonly (readonly string[])[],
  mapPatterns: readonly (readonly string[])[],
): boolean {
  // Deduplicate desired items under structural equality because Kong stores sets without duplicates.
  const uniqueDesired: unknown[] = [];
  for (const item of desired) {
    const duplicate = uniqueDesired.some((existing) =>
      valuesEqual(item, existing, elemPath, setPatterns, mapPatterns),
    );
    if (!duplicate) {
      uniqueDesired.push(item);
    }
  }

  if (uniqueDesired.length !== actual.length) {
    return false;
  }

  const adjacency: number[][] = uniqueDesired.map((dItem) => {
    const matches: number[] = [];
    for (let j = 0; j < actual.length; j += 1) {
      if (valuesEqual(dItem, actual[j], elemPath, setPatterns, mapPatterns)) {
        matches.push(j);
      }
    }
    return matches;
  });

  if (adjacency.some((neighbors) => neighbors.length === 0)) {
    return false;
  }

  return hasPerfectMatching(adjacency, actual.length);
}

/**
 * Recursively compares a declared `desired` value against a stored `actual`
 * value according to `apply` comparison semantics:
 * - Records are compared for declared fields only; maps (`mapPatterns`) are compared whole.
 * - `null` and absent (`undefined`) are equal.
 * - Arrays are compared in order unless their schema path is in `setPatterns`.
 */
export function valuesEqual(
  desired: unknown,
  actual: unknown,
  pathTokens: readonly string[],
  setPatterns: readonly (readonly string[])[],
  mapPatterns: readonly (readonly string[])[] = [],
): boolean {
  if (desired === UNRESOLVED_REF) {
    return false;
  }
  if (desired === undefined) {
    return true;
  }
  if (desired === null) {
    return actual === null || actual === undefined;
  }
  if (actual === null || actual === undefined) {
    return false;
  }

  if (Array.isArray(desired)) {
    if (!Array.isArray(actual)) {
      return false;
    }
    const elemPath = [...pathTokens, '[]'];
    if (matchesSchemaPath(pathTokens, setPatterns)) {
      return setsEqual(desired, actual, elemPath, setPatterns, mapPatterns);
    }
    if (desired.length !== actual.length) {
      return false;
    }
    for (let i = 0; i < desired.length; i += 1) {
      if (!valuesEqual(desired[i], actual[i], elemPath, setPatterns, mapPatterns)) {
        return false;
      }
    }
    return true;
  }

  if (isPlainObject(desired)) {
    if (!isPlainObject(actual)) {
      return false;
    }
    for (const [key, desiredValue] of Object.entries(desired)) {
      if (desiredValue === undefined) {
        continue;
      }
      const actualValue: unknown = Reflect.get(actual, key);
      if (!valuesEqual(desiredValue, actualValue, [...pathTokens, key], setPatterns, mapPatterns)) {
        return false;
      }
    }
    if (matchesSchemaPath(pathTokens, mapPatterns)) {
      for (const [key, actualValue] of Object.entries(actual)) {
        if (actualValue === undefined || actualValue === null) {
          continue;
        }
        const desiredValue: unknown = Object.hasOwn(desired, key)
          ? Reflect.get(desired, key)
          : undefined;
        if (desiredValue === undefined) {
          return false;
        }
      }
    }
    return true;
  }

  return Object.is(desired, actual);
}

function dedupeTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    if (!seen.has(tag)) {
      seen.add(tag);
      result.push(tag);
    }
  }
  return result;
}

/** Builds the tag array to send when creating a new entity with `apply`. */
export function buildCreateTags(
  declaredTags: readonly string[] | null | undefined,
  managedTag: string,
): string[] {
  return dedupeTags([...(declaredTags ?? []), managedTag]);
}

/**
 * Computes whether an existing entity's tags differ from the config and
 * managed tag rules.
 *
 * - When `declaredTags` is provided (`!== undefined`), the entity must carry
 *   exactly those tags plus `managedTag` (compared as a set).
 * - When `declaredTags` is omitted (`undefined`), existing tags are preserved
 *   and `managedTag` is ensured to be present.
 */
export function computeManagedTags(
  declaredTags: readonly string[] | null | undefined,
  actualTags: readonly string[] | null | undefined,
  managedTag: string,
): TagComputation {
  const actualList: readonly string[] = actualTags ?? [];

  if (declaredTags !== undefined) {
    const desiredTags = dedupeTags([...(declaredTags ?? []), managedTag]);
    const actualSet = new Set(actualList);
    const matches =
      desiredTags.length === actualSet.size && desiredTags.every((tag) => actualSet.has(tag));
    return { changed: !matches, desiredTags };
  }

  if (actualList.includes(managedTag)) {
    return { changed: false, desiredTags: [...actualList] };
  }
  return { changed: true, desiredTags: [...actualList, managedTag] };
}

function refsEqual(resolved: ResolvedRefValue, actual: unknown): boolean {
  if (resolved === UNRESOLVED_REF) {
    return false;
  }
  if (resolved === null) {
    return actual === null || actual === undefined;
  }
  if (!isPlainObject(actual)) {
    return false;
  }
  return Reflect.get(actual, 'id') === resolved;
}

/**
 * Compares a desired entity declaration against an existing Kong entity and
 * returns the list of differing top-level fields together with the PATCH body.
 */
export function diffEntity(
  desired: object,
  actual: object,
  options: DiffEntityOptions,
): DiffResult {
  const setPatterns = (options.setFields ?? []).map(tokenizeSchemaPath);
  const mapPatterns = (options.mapFields ?? []).map(tokenizeSchemaPath);
  const resolvedRefs = options.resolvedRefs ?? {};
  const fields: string[] = [];
  const patch: Record<string, unknown> = {};

  for (const [key, desiredValue] of Object.entries(desired)) {
    if (key === 'tags' || desiredValue === undefined) {
      continue;
    }

    const actualValue: unknown = Reflect.get(actual, key);
    if (key in resolvedRefs) {
      const resolved = resolvedRefs[key];
      if (resolved !== undefined && !refsEqual(resolved, actualValue)) {
        fields.push(key);
        patch[key] = desiredValue;
      }
      continue;
    }

    if (!valuesEqual(desiredValue, actualValue, [key], setPatterns, mapPatterns)) {
      fields.push(key);
      patch[key] = desiredValue;
    }
  }

  const declaredTags = readTagList(Reflect.get(desired, 'tags'));
  const actualTags = readTagList(Reflect.get(actual, 'tags'));
  const tagDiff = computeManagedTags(declaredTags, actualTags, options.managedTag);
  if (tagDiff.changed) {
    fields.push('tags');
    patch.tags = tagDiff.desiredTags;
  }

  return { fields, patch };
}
