import { describe, expect, it } from 'vitest';
import { exerciseCollection } from '../../support/crud.js';
import { liveKong, unique } from '../../support/live.js';

describe('sessions', () => {
  const kong = liveKong();

  it('exercises full CRUD and pagination on /sessions', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;

    // sessions has no `tags` field, so pagination runs without `?tags=`.
    await exerciseCollection(kong.sessions)({
      supportsTags: false,
      makeCreateInput: () => ({
        session_id: unique('sess'),
        expires: expiresAt,
        data: 'initial-session-data',
      }),
      getKey: (session) => session.session_id,
      update: {
        patch: { data: 'updated-session-data' },
        assertUpdated: (updated, before) => {
          expect(updated.data).toBe('updated-session-data');
          expect(updated.expires).toBe(expiresAt);
          expect(updated.session_id).toBe(before.session_id);
        },
      },
      upsert: {
        makeInput: (current) => ({
          session_id: current.session_id,
        }),
        assertUpserted: (upserted, before) => {
          expect(upserted.session_id).toBe(before.session_id);
          expect(upserted.data).toBeNull();
          expect(upserted.expires).toBeNull();
        },
      },
    });
  });
});
