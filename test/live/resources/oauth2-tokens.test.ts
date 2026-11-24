import { describe, expect, it } from 'vitest';
import {
  deleteIgnoringNotFound,
  exerciseCollection,
  exerciseSingleton,
} from '../../support/crud.js';
import { liveKong, unique } from '../../support/live.js';

describe('oauth2_tokens, service-nested tokens, and token singletons', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /oauth2_tokens', async () => {
    const consumer = await kong.consumers.create({
      username: unique('tok-top-consumer'),
    });
    const credential = await kong.oauth2.create({
      consumer: { id: consumer.id },
      name: unique('tok-top-app'),
    });
    const service = await kong.services.create({
      name: unique('tok-top-svc'),
      host: 'upstream',
      port: 8080,
    });

    try {
      // oauth2_tokens has no `tags` field, so pagination runs without `?tags=`.
      await exerciseCollection(kong.oauth2Tokens)({
        supportsTags: false,
        makeCreateInput: () => ({
          credential: { id: credential.id },
          service: { id: service.id },
          expires_in: 3600,
          access_token: unique('tok-top-at'),
          authenticated_userid: 'top-user-1',
          scope: 'read',
        }),
        getKey: (token) => token.access_token,
        update: {
          patch: { scope: 'write' },
          assertUpdated: (updated) => {
            expect(updated.scope).toBe('write');
            expect(updated.authenticated_userid).toBe('top-user-1');
            expect(updated.expires_in).toBe(3600);
          },
        },
        upsert: {
          makeInput: (current) => ({
            credential: { id: credential.id },
            service: { id: service.id },
            expires_in: 3600,
            access_token: current.access_token,
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.access_token).toBe(before.access_token);
            expect(upserted.scope).toBeNull();
            expect(upserted.authenticated_userid).toBeNull();
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.oauth2.delete(credential.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
      await deleteIgnoringNotFound(() => kong.services.delete(service.id));
    }
  });

  it('exercises full CRUD and pagination on /services/{service}/oauth2_tokens', async () => {
    const consumer = await kong.consumers.create({
      username: unique('svc-tok-consumer'),
    });
    const credential = await kong.oauth2.create({
      consumer: { id: consumer.id },
      name: unique('svc-tok-app'),
    });
    const service = await kong.services.create({
      name: unique('svc-tok-parent'),
      host: 'upstream',
      port: 8080,
    });

    try {
      // oauth2_tokens has no `tags` field, so pagination runs without `?tags=`.
      await exerciseCollection(kong.services.oauth2Tokens(service.id))({
        supportsTags: false,
        makeCreateInput: () => ({
          credential: { id: credential.id },
          expires_in: 3600,
          access_token: unique('svc-tok-at'),
          authenticated_userid: 'svc-user-1',
          scope: 'read',
        }),
        getKey: (token) => token.access_token,
        update: {
          patch: { scope: 'admin' },
          assertUpdated: (updated) => {
            expect(updated.scope).toBe('admin');
            expect(updated.authenticated_userid).toBe('svc-user-1');
            expect(updated.service?.id).toBe(service.id);
          },
        },
        upsert: {
          makeInput: (current) => ({
            credential: { id: credential.id },
            expires_in: 3600,
            access_token: current.access_token,
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.access_token).toBe(before.access_token);
            expect(upserted.scope).toBeNull();
            expect(upserted.authenticated_userid).toBeNull();
            expect(upserted.service?.id).toBe(service.id);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.oauth2.delete(credential.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
      await deleteIgnoringNotFound(() => kong.services.delete(service.id));
    }
  });

  it('exercises get, update, and upsert on /oauth2_tokens/{token}/credential', async () => {
    const consumer = await kong.consumers.create({
      username: unique('tok-cred-consumer'),
    });
    const credential = await kong.oauth2.create({
      consumer: { id: consumer.id },
      name: unique('tok-cred-app'),
      client_id: unique('tok-cred-cid'),
      redirect_uris: ['https://example.com/callback'],
      client_type: 'public',
    });
    const token = await kong.oauth2Tokens.create({
      credential: { id: credential.id },
      expires_in: 3600,
    });
    const updatedName = unique('tok-cred-app-updated');
    const replacedName = unique('tok-cred-app-replaced');

    try {
      await exerciseSingleton(kong.oauth2Tokens.credential(token.id))({
        assertInitial: (fetched) => {
          expect(fetched.id).toBe(credential.id);
          expect(fetched.name).toBe(credential.name);
          expect(fetched.redirect_uris).toEqual(['https://example.com/callback']);
          expect(fetched.client_type).toBe('public');
        },
        update: {
          patch: { name: updatedName },
          assertUpdated: (updated) => {
            expect(updated.id).toBe(credential.id);
            expect(updated.name).toBe(updatedName);
            expect(updated.redirect_uris).toEqual(['https://example.com/callback']);
            expect(updated.client_type).toBe('public');
          },
        },
        upsert: {
          makeInput: (current) => ({
            consumer: { id: consumer.id },
            name: replacedName,
            client_id: current.client_id,
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.id).toBe(credential.id);
            expect(upserted.name).toBe(replacedName);
            expect(upserted.redirect_uris).toBeNull();
            expect(upserted.client_type).toBe('confidential');
            expect(upserted.client_secret).not.toBe(before.client_secret);
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.oauth2Tokens.delete(token.id));
      await deleteIgnoringNotFound(() => kong.oauth2.delete(credential.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });

  it('exercises get, update, and upsert on /oauth2_tokens/{token}/service', async () => {
    const consumer = await kong.consumers.create({
      username: unique('tok-svc-consumer'),
    });
    const credential = await kong.oauth2.create({
      consumer: { id: consumer.id },
      name: unique('tok-svc-app'),
    });
    const service = await kong.services.create({
      name: unique('tok-svc-single'),
      host: 'upstream',
      port: 8080,
      path: '/echo',
      retries: 8,
      connect_timeout: 15_000,
    });
    const token = await kong.oauth2Tokens.create({
      credential: { id: credential.id },
      service: { id: service.id },
      expires_in: 3600,
    });

    try {
      await exerciseSingleton(kong.oauth2Tokens.service(token.id))({
        assertInitial: (fetched) => {
          expect(fetched.id).toBe(service.id);
          expect(fetched.retries).toBe(8);
          expect(fetched.connect_timeout).toBe(15_000);
          expect(fetched.path).toBe('/echo');
        },
        update: {
          patch: { retries: 4 },
          assertUpdated: (updated) => {
            expect(updated.id).toBe(service.id);
            expect(updated.retries).toBe(4);
            expect(updated.connect_timeout).toBe(15_000);
            expect(updated.path).toBe('/echo');
          },
        },
        upsert: {
          makeInput: (current) => ({
            name: current.name,
            host: 'upstream',
            port: 8080,
          }),
          assertUpserted: (upserted) => {
            expect(upserted.id).toBe(service.id);
            expect(upserted.retries).toBe(5);
            expect(upserted.connect_timeout).toBe(60_000);
            expect(upserted.path).toBeNull();
          },
        },
      });
    } finally {
      await deleteIgnoringNotFound(() => kong.oauth2Tokens.delete(token.id));
      await deleteIgnoringNotFound(() => kong.oauth2.delete(credential.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
      await deleteIgnoringNotFound(() => kong.services.delete(service.id));
    }
  });
});
