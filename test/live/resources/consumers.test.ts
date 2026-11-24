import { describe, expect, it } from 'vitest';
import type { PluginInput } from '../../../src/index.js';
import { deleteIgnoringNotFound, exerciseCollection } from '../../support/crud.js';
import { exerciseCollectionWithTagReset } from '../../support/crud-credentials.js';
import { liveKong, unique } from '../../support/live.js';

describe('consumers and nested consumer resources', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /consumers', async () => {
    const updatedCustomId = unique('consumer-cid-updated');

    await exerciseCollection(kong.consumers)({
      makeCreateInput: (tag) => ({
        username: unique('consumer'),
        custom_id: unique('consumer-cid'),
        tags: tag ? [tag] : undefined,
      }),
      getKey: (consumer) => {
        expect(consumer.username).toBeTruthy();
        return consumer.username!;
      },
      update: {
        patch: { custom_id: updatedCustomId },
        assertUpdated: (updated, before) => {
          expect(updated.custom_id).toBe(updatedCustomId);
          expect(updated.username).toBe(before.username);
          expect(updated.tags).toEqual(before.tags);
        },
      },
      upsert: {
        makeInput: (current, tag) => ({
          username: current.username,
          tags: tag ? [tag] : undefined,
        }),
        assertUpserted: (upserted, before) => {
          expect(upserted.username).toBe(before.username);
          expect(upserted.custom_id).toBeNull();
        },
      },
    });
  });

  it('exercises full CRUD and pagination on /consumers/{consumer}/acls', async () => {
    const consumer = await kong.consumers.create({
      username: unique('acl-parent'),
    });
    const updatedGroup = unique('acl-group-updated');

    try {
      await exerciseCollectionWithTagReset(kong.consumers.acls(consumer.id))({
        makeCreateInput: (tag) => ({
          group: unique('acl-group'),
          tags: [tag],
        }),
        getKey: (acl) => acl.group,
        update: {
          patch: { group: updatedGroup },
          assertUpdated: (updated, before) => {
            expect(updated.group).toBe(updatedGroup);
            expect(updated.consumer.id).toBe(consumer.id);
            expect(updated.tags).toEqual(before.tags);
          },
        },
        upsert: {
          makeInput: (current) => ({
            group: current.group,
          }),
          getKey: (current) => current.id,
          assertUpserted: (upserted, before) => {
            expect(upserted.group).toBe(before.group);
            expect(upserted.consumer.id).toBe(consumer.id);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });

  it('exercises full CRUD and pagination on /consumers/{consumer}/basic-auth', async () => {
    const consumer = await kong.consumers.create({
      username: unique('basic-auth-parent'),
    });
    const updatedUsername = unique('ba-user-updated');

    try {
      await exerciseCollectionWithTagReset(kong.consumers.basicAuth(consumer.id))({
        makeCreateInput: (tag) => ({
          username: unique('ba-user'),
          password: 'initial-password',
          tags: [tag],
        }),
        getKey: (cred) => cred.username,
        update: {
          patch: { username: updatedUsername },
          assertUpdated: (updated, before) => {
            expect(updated.username).toBe(updatedUsername);
            expect(updated.password).toBe(before.password);
            expect(updated.tags).toEqual(before.tags);
          },
        },
        upsert: {
          makeInput: (current) => ({
            username: current.username,
            password: 'replaced-password',
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.username).toBe(before.username);
            expect(upserted.password).not.toBe(before.password);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });

  it('exercises full CRUD and pagination on /consumers/{consumer}/hmac-auth', async () => {
    const consumer = await kong.consumers.create({
      username: unique('hmac-auth-parent'),
    });
    const updatedUsername = unique('hmac-user-updated');

    try {
      await exerciseCollection(kong.consumers.hmacAuth(consumer.id))({
        makeCreateInput: (tag) => ({
          username: unique('hmac-user'),
          secret: 'initial-hmac-secret',
          tags: tag ? [tag] : undefined,
        }),
        getKey: (cred) => cred.username,
        update: {
          patch: { username: updatedUsername },
          assertUpdated: (updated, before) => {
            expect(updated.username).toBe(updatedUsername);
            expect(updated.secret).toBe('initial-hmac-secret');
            expect(updated.tags).toEqual(before.tags);
          },
        },
        upsert: {
          makeInput: (current, tag) => ({
            username: current.username,
            tags: tag ? [tag] : undefined,
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.username).toBe(before.username);
            expect(upserted.secret).not.toBe('initial-hmac-secret');
            expect(upserted.secret.length).toBeGreaterThan(0);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });

  it('exercises full CRUD and pagination on /consumers/{consumer}/jwt', async () => {
    const consumer = await kong.consumers.create({
      username: unique('jwt-parent'),
    });

    try {
      await exerciseCollection(kong.consumers.jwt(consumer.id))({
        makeCreateInput: (tag) => ({
          key: unique('jwt-key'),
          secret: 'initial-jwt-secret',
          algorithm: 'HS512',
          tags: tag ? [tag] : undefined,
        }),
        getKey: (jwt) => jwt.key,
        update: {
          patch: { algorithm: 'HS384' },
          assertUpdated: (updated, before) => {
            expect(updated.algorithm).toBe('HS384');
            expect(updated.secret).toBe('initial-jwt-secret');
            expect(updated.key).toBe(before.key);
          },
        },
        upsert: {
          makeInput: (current, tag) => ({
            key: current.key,
            tags: tag ? [tag] : undefined,
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.key).toBe(before.key);
            expect(upserted.algorithm).toBe('HS256');
            expect(upserted.secret).not.toBe('initial-jwt-secret');
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });

  it('exercises full CRUD and pagination on /consumers/{consumer}/key-auth', async () => {
    const consumer = await kong.consumers.create({
      username: unique('key-auth-parent'),
    });
    const updatedKey = unique('api-key-updated');

    try {
      await exerciseCollectionWithTagReset(kong.consumers.keyAuth(consumer.id))({
        makeCreateInput: (tag) => ({
          key: unique('api-key'),
          tags: [tag],
        }),
        getKey: (cred) => cred.key,
        update: {
          patch: { key: updatedKey },
          assertUpdated: (updated, before) => {
            expect(updated.key).toBe(updatedKey);
            expect(updated.consumer.id).toBe(consumer.id);
            expect(updated.tags).toEqual(before.tags);
          },
        },
        upsert: {
          makeInput: (current) => ({
            key: current.key,
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.key).toBe(before.key);
            expect(upserted.consumer.id).toBe(consumer.id);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });

  it('exercises full CRUD and pagination on /consumers/{consumer}/oauth2', async () => {
    const consumer = await kong.consumers.create({
      username: unique('oauth2-parent'),
    });
    const updatedName = unique('oauth2-app-updated');

    try {
      await exerciseCollection(kong.consumers.oauth2(consumer.id))({
        makeCreateInput: (tag) => ({
          name: unique('oauth2-app'),
          client_id: unique('oauth2-cid'),
          redirect_uris: ['https://example.com/callback'],
          client_type: 'public',
          tags: tag ? [tag] : undefined,
        }),
        getKey: (cred) => cred.client_id,
        update: {
          patch: { name: updatedName },
          assertUpdated: (updated) => {
            expect(updated.name).toBe(updatedName);
            expect(updated.redirect_uris).toEqual(['https://example.com/callback']);
            expect(updated.client_type).toBe('public');
          },
        },
        upsert: {
          makeInput: (current, tag) => ({
            name: current.name,
            client_id: current.client_id,
            tags: tag ? [tag] : undefined,
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.name).toBe(before.name);
            expect(upserted.redirect_uris).toBeNull();
            expect(upserted.client_type).toBe('confidential');
            expect(upserted.client_secret).not.toBe(before.client_secret);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });

  it('exercises full CRUD and pagination on /consumers/{consumer}/plugins', async () => {
    const consumer = await kong.consumers.create({
      username: unique('plugins-parent'),
    });

    // Kong allows at most one instance of a given plugin name per consumer, so
    // the three entities created for pagination use distinct consumer-scoped plugins.
    let createCall = 0;

    try {
      await exerciseCollection(kong.consumers.plugins(consumer.id))({
        makeCreateInput: (tag): PluginInput => {
          createCall += 1;
          if (createCall === 1) {
            return {
              name: 'request-transformer',
              instance_name: unique('consumer-rt'),
              enabled: true,
              config: {
                add: {
                  headers: ['X-Consumer-Test:1'],
                },
              },
              tags: tag ? [tag] : undefined,
            };
          }
          if (createCall === 2) {
            return {
              name: 'response-transformer',
              instance_name: unique('consumer-respt'),
              config: {
                add: {
                  headers: ['X-Consumer-Resp:1'],
                },
              },
              tags: tag ? [tag] : undefined,
            };
          }
          return {
            name: 'rate-limiting',
            instance_name: unique('consumer-rl'),
            config: {
              minute: 100,
            },
            tags: tag ? [tag] : undefined,
          };
        },
        getKey: (plugin) => {
          expect(plugin.instance_name).toBeTruthy();
          return plugin.instance_name!;
        },
        update: {
          patch: { enabled: false },
          assertUpdated: (updated, before) => {
            expect(updated.enabled).toBe(false);
            expect(updated.instance_name).toBe(before.instance_name);
            expect(updated.config).toEqual(before.config);
          },
        },
        upsert: {
          makeInput: (current, tag) => ({
            name: current.name,
            instance_name: current.instance_name,
            tags: tag ? [tag] : undefined,
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.instance_name).toBe(before.instance_name);
            expect(upserted.enabled).toBe(true);
            expect(upserted.config).toHaveProperty('add.headers', []);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });
});
