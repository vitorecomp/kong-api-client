import { KongError } from '../errors.js';
import type { KongResources } from '../generated/resources.js';
import type { Collection } from '../resource.js';

/** Options required by {@link Kong.deleteAll}. */
export interface DeleteAllOptions {
  /** Must be `'delete-everything'` to confirm removing every entity from Kong. */
  confirm: 'delete-everything';
}

/** Summary returned by {@link Kong.deleteAll}. */
export interface DeleteAllResult {
  /** Number of entities deleted per first-class resource collection. */
  deleted: Record<string, number>;
}

/**
 * Deletes every entity across all first-class top-level resources in reverse
 * dependency order (children before parents), paging until each collection is
 * empty.
 */
export async function runDeleteAll(
  resources: KongResources,
  options: DeleteAllOptions,
): Promise<DeleteAllResult> {
  if (!options || options.confirm !== 'delete-everything') {
    throw new KongError(
      'deleteAll() requires { confirm: "delete-everything" } to confirm deleting all entities',
    );
  }

  const orderedResources: Array<readonly [string, Collection<{ id: string }, unknown>]> = [
    ['plugins', resources.plugins],
    ['oauth2Tokens', resources.oauth2Tokens],
    ['routes', resources.routes],
    ['services', resources.services],
    ['snis', resources.snis],
    ['upstreams', resources.upstreams],
    ['acls', resources.acls],
    ['basicAuths', resources.basicAuths],
    ['hmacAuths', resources.hmacAuths],
    ['jwts', resources.jwts],
    ['keyAuths', resources.keyAuths],
    ['oauth2', resources.oauth2],
    ['consumers', resources.consumers],
    ['keys', resources.keys],
    ['keySets', resources.keySets],
    ['certificates', resources.certificates],
    ['caCertificates', resources.caCertificates],
    ['vaults', resources.vaults],
    ['sessions', resources.sessions],
    ['acmeStorage', resources.acmeStorage],
  ];

  const deleted: Record<string, number> = {};

  for (const [name, collection] of orderedResources) {
    let count = 0;
    while (true) {
      const page = await collection.list();
      if (page.data.length === 0) {
        break;
      }
      for (const item of page.data) {
        await collection.delete(item.id);
        count += 1;
      }
    }
    deleted[name] = count;
  }

  return { deleted };
}
