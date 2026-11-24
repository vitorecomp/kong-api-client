import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound, exerciseCollection } from '../../support/crud.js';
import { exerciseConsumerSingleton } from '../../support/crud-credentials.js';
import { liveKong, unique } from '../../support/live.js';

describe('hmac-auths and hmac-auth consumer singleton', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /hmac-auths', async () => {
    const consumer = await kong.consumers.create({
      username: unique('hmac-top-consumer'),
    });
    const updatedUsername = unique('hmac-top-user-updated');

    try {
      await exerciseCollection(kong.hmacAuths)({
        makeCreateInput: (tag) => ({
          consumer: { id: consumer.id },
          username: unique('hmac-top-user'),
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
            consumer: { id: consumer.id },
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

  it('exercises get, update, and upsert on /hmac-auths/{credential}/consumer', async () => {
    const consumer = await kong.consumers.create({
      username: unique('hmac-single-consumer'),
      custom_id: unique('hmac-single-cid'),
      tags: [unique('hmac-single-tag')],
    });
    const cred = await kong.hmacAuths.create({
      consumer: { id: consumer.id },
      username: unique('hmac-single-user'),
    });

    try {
      await exerciseConsumerSingleton(kong.hmacAuths.consumer(cred.id), consumer);
    } finally {
      await deleteIgnoringNotFound(() => kong.hmacAuths.delete(cred.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });
});
