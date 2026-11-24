import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../support/crud.js';
import { liveKong, unique } from '../support/live.js';

const KEY_CASES: ReadonlyArray<{ label: string; sample: string }> = [
  { label: 'space', sample: 'a b' },
  { label: 'slash', sample: 'a/b' },
  { label: 'question mark', sample: 'a?b' },
  { label: 'hash', sample: 'a#b' },
  { label: 'percent', sample: 'a%b' },
  { label: 'plus', sample: 'a+b' },
  { label: 'ampersand', sample: 'a&b' },
  { label: 'colon', sample: 'a:b' },
  { label: 'non-ASCII letter', sample: 'café' },
  { label: 'all reserved and non-ASCII characters', sample: 'a b/c?d#e%f+g&h:i café' },
];

describe('path segment key encoding (live)', () => {
  const kong = liveKong();

  it.each(KEY_CASES)(
    'encodes $label in consumer username for get, update, delete, and find',
    async ({ sample }) => {
      const username = `${unique('key-enc')}-${sample}`;
      const initialCustomId = unique('key-enc-cid-init');
      const updatedCustomId = unique('key-enc-cid-updated');
      const created = await kong.consumers.create({
        username,
        custom_id: initialCustomId,
      });

      try {
        const fetched = await kong.consumers.get(username);
        expect(fetched.id).toBe(created.id);
        expect(fetched.username).toBe(username);
        expect(fetched.custom_id).toBe(initialCustomId);

        const updated = await kong.consumers.update(username, { custom_id: updatedCustomId });
        expect(updated.id).toBe(created.id);
        expect(updated.username).toBe(username);
        expect(updated.custom_id).toBe(updatedCustomId);

        const persisted = await kong.consumers.get(created.id);
        expect(persisted.id).toBe(created.id);
        expect(persisted.username).toBe(username);
        expect(persisted.custom_id).toBe(updatedCustomId);

        await kong.consumers.delete(username);
        await expect(kong.consumers.find(username)).resolves.toBeUndefined();
        await expect(kong.consumers.find(created.id)).resolves.toBeUndefined();
      } finally {
        await deleteIgnoringNotFound(() => kong.consumers.delete(created.id));
      }
    },
  );
});
