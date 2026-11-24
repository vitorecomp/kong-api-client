import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound, exerciseCollection } from '../../support/crud.js';
import { exerciseConsumerSingleton } from '../../support/crud-credentials.js';
import { liveKong, unique } from '../../support/live.js';

describe('jwts and jwt consumer singleton', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /jwts', async () => {
    const consumer = await kong.consumers.create({
      username: unique('jwt-top-consumer'),
    });

    try {
      await exerciseCollection(kong.jwts)({
        makeCreateInput: (tag) => ({
          consumer: { id: consumer.id },
          key: unique('jwt-top-key'),
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
            consumer: { id: consumer.id },
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

  it('exercises get, update, and upsert on /jwts/{jwt}/consumer', async () => {
    const consumer = await kong.consumers.create({
      username: unique('jwt-single-consumer'),
      custom_id: unique('jwt-single-cid'),
      tags: [unique('jwt-single-tag')],
    });
    const jwt = await kong.jwts.create({
      consumer: { id: consumer.id },
      key: unique('jwt-single-key'),
    });

    try {
      await exerciseConsumerSingleton(kong.jwts.consumer(jwt.id), consumer);
    } finally {
      await deleteIgnoringNotFound(() => kong.jwts.delete(jwt.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });
});
