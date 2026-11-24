import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import {
  exerciseCollectionWithTagReset,
  exerciseConsumerSingleton,
} from '../../support/crud-credentials.js';
import { captureHttpError } from '../../support/errors.js';
import { liveKong, unique } from '../../support/live.js';

describe('acls and acl consumer singleton', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /acls (id is the only unique key)', async () => {
    const consumer = await kong.consumers.create({
      username: unique('acl-top-consumer'),
    });
    const updatedGroup = unique('acl-top-group-updated');

    try {
      // Top-level /acls has no unique key besides `id` (group is only unique per consumer).
      await exerciseCollectionWithTagReset(kong.acls)({
        makeCreateInput: (tag) => ({
          consumer: { id: consumer.id },
          group: unique('acl-top-group'),
          tags: [tag],
        }),
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
            consumer: { id: consumer.id },
            group: current.group,
          }),
          assertUpserted: (upserted, before) => {
            expect(upserted.group).toBe(before.group);
            expect(upserted.consumer.id).toBe(consumer.id);
          },
        },
      });

      const invalidKeyError = await captureHttpError(kong.acls.get('not-a-uuid-group'));
      expect(invalidKeyError.status).toBe(400);
      expect(invalidKeyError.kongName).toBe('invalid primary key');
      expect(invalidKeyError.code).toBe(1);
      expect(invalidKeyError.fields).toHaveProperty('id');
    } finally {
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });

  it('exercises get, update, and upsert on /acls/{acl}/consumer', async () => {
    const consumer = await kong.consumers.create({
      username: unique('acl-single-consumer'),
      custom_id: unique('acl-single-cid'),
      tags: [unique('acl-single-tag')],
    });
    const acl = await kong.acls.create({
      consumer: { id: consumer.id },
      group: unique('acl-single-group'),
    });

    try {
      await exerciseConsumerSingleton(kong.acls.consumer(acl.id), consumer);
    } finally {
      await deleteIgnoringNotFound(() => kong.acls.delete(acl.id));
      await deleteIgnoringNotFound(() => kong.consumers.delete(consumer.id));
    }
  });
});
