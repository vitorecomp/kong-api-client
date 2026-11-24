import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound, exerciseCollection } from '../../support/crud.js';
import { exerciseConsumerSingleton } from '../../support/crud-credentials.js';
import { liveKong, unique } from '../../support/live.js';

describe('oauth2 credentials, nested oauth2 tokens, and oauth2 consumer singleton', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /oauth2', async () => {
    const consumer = await kong.consumers.create({
      username: unique('oauth2-top-consumer'),
    });
    const updatedName = unique('oauth2-top-app-updated');

    try {
      await exerciseCollection(kong.oauth2)({
        makeCreateInput: (tag) => ({
          consumer: { id: consumer.id },
          name: unique('oauth2-top-app'),
          client_id: unique('oauth2-top-cid'),
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
            consumer: { id: consumer.id },
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

  it('exercises full CRUD and pagination on /oauth2/{credential}/oauth2_tokens', async () => {
    const consumer = await kong.consumers.create({
      username: unique('oauth2-tok-consumer'),
    });
    const credential = await kong.oauth2.create({
      consumer: { id: consumer.id },
      name: unique('oauth2-tok-app'),
    });

    try {
      // oauth2_tokens has no `tags` field, so pagination runs without `?tags=`.
      await exerciseCollection(kong.oauth2.oauth2Tokens(credential.id))({
        supportsTags: false,
        makeCreateInput: () => ({
          expires_in: 3600,
          access_token: unique('oa-nested-at'),
          authenticated_userid: 'nested-user-1',
          scope: 'read',
        }),
        getKey: (token) => token.access_token,
        update: {
          patch: { scope: 'write' },
          assertUpdated: (updated) => {
            expect(updated.scope).toBe('write');
            expect(updated.authenticated_userid).toBe('nested-user-1');
            expect(updated.expires_in).toBe(3600);
          },
        },
        upsert: {
          makeInput: (current) => ({
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
    }
  });

  it('exercises get, update, and upsert on /oauth2/{credential}/consumer', async () => {
    const consumer = await kong.consumers.create({
      username: unique('oauth2-single-consumer'),
      custom_id: unique('oauth2-single-cid'),
      tags: [unique('oauth2-single-tag')],
    });
    const cred = await kong.oauth2.create({
      consumer: { id: consumer.id },
      name: unique('oauth2-single-app'),
    });

    try {
      await exerciseConsumerSingleton(kong.oauth2.consumer(cred.id), consumer);
    } finally {
      await deleteIgnoringNotFound(() => kong.oauth2.delete(cred.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });
});
