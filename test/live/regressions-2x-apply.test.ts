import { describe, expect, it } from 'vitest';
import type { ApplyConfig } from '../../src/index.js';
import { liveKong, unique } from '../support/live.js';

describe('2.x regression tests (apply)', () => {
  const kong = liveKong();

  it('2.x regression #3: applying the same config twice reports every entity unchanged instead of 409', async () => {
    const tag = unique('reg3-apply');
    const serviceName = unique('reg3-svc');
    const routeName = unique('reg3-route');
    const consumerName = unique('reg3-consumer');
    const pluginName = unique('reg3-plugin');

    const config: ApplyConfig<['correlation-id']> = {
      services: [{ name: serviceName, url: 'http://upstream:8080/echo' }],
      routes: [
        {
          name: routeName,
          service: { name: serviceName },
          paths: [`/${unique('reg3')}`],
          protocols: ['http', 'https'],
        },
      ],
      consumers: [{ username: consumerName }],
      plugins: [
        {
          name: 'correlation-id',
          instance_name: pluginName,
          service: { name: serviceName },
          config: { header_name: 'X-Reg3-Id' },
        },
      ],
    };

    try {
      const first = await kong.apply(config, { tag });
      expect(first.summary).toEqual({ create: 4, update: 0, unchanged: 0, delete: 0 });

      const second = await kong.apply(config, { tag });
      expect(second.summary).toEqual({ create: 0, update: 0, unchanged: 4, delete: 0 });
      expect(second.changes.every((change) => change.action === 'unchanged')).toBe(true);
    } finally {
      await kong.apply({}, { prune: true, tag });
    }
  });
});
