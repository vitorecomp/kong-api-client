import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import {
  exerciseCollectionWithTagReset,
  exerciseConsumerSingleton,
} from '../../support/crud-credentials.js';
import { liveKong, unique } from '../../support/live.js';

describe('key-auths and key-auth consumer singleton', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /key-auths', async () => {
    const consumer = await kong.consumers.create({
      username: unique('ka-top-consumer'),
    });
    const updatedKey = unique('ka-top-key-updated');

    try {
      await exerciseCollectionWithTagReset(kong.keyAuths)({
        makeCreateInput: (tag) => ({
          consumer: { id: consumer.id },
          key: unique('ka-top-key'),
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
            consumer: { id: consumer.id },
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

  it('exercises get, update, and upsert on /key-auths/{credential}/consumer', async () => {
    const consumer = await kong.consumers.create({
      username: unique('ka-single-consumer'),
      custom_id: unique('ka-single-cid'),
      tags: [unique('ka-single-tag')],
    });
    const cred = await kong.keyAuths.create({
      consumer: { id: consumer.id },
      key: unique('ka-single-key'),
    });

    try {
      await exerciseConsumerSingleton(kong.keyAuths.consumer(cred.id), consumer);
    } finally {
      await deleteIgnoringNotFound(() => kong.keyAuths.delete(cred.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });
});
