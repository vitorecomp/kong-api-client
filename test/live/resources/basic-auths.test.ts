import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import {
  exerciseCollectionWithTagReset,
  exerciseConsumerSingleton,
} from '../../support/crud-credentials.js';
import { liveKong, unique } from '../../support/live.js';

describe('basic-auths and basic-auth consumer singleton', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /basic-auths', async () => {
    const consumer = await kong.consumers.create({
      username: unique('ba-top-consumer'),
    });
    const updatedUsername = unique('ba-top-user-updated');

    try {
      await exerciseCollectionWithTagReset(kong.basicAuths)({
        makeCreateInput: (tag) => ({
          consumer: { id: consumer.id },
          username: unique('ba-top-user'),
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
            consumer: { id: consumer.id },
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

  it('exercises get, update, and upsert on /basic-auths/{credential}/consumer', async () => {
    const consumer = await kong.consumers.create({
      username: unique('ba-single-consumer'),
      custom_id: unique('ba-single-cid'),
      tags: [unique('ba-single-tag')],
    });
    const cred = await kong.basicAuths.create({
      consumer: { id: consumer.id },
      username: unique('ba-single-user'),
      password: 'single-password',
    });

    try {
      await exerciseConsumerSingleton(kong.basicAuths.consumer(cred.id), consumer);
    } finally {
      await deleteIgnoringNotFound(() => kong.basicAuths.delete(cred.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });
});
