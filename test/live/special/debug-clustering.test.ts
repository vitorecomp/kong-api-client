import { describe, expect, it } from 'vitest';
import { captureHttpError } from '../../support/errors.js';
import { liveKong } from '../../support/live.js';

describe('live special: debug and clustering endpoints', () => {
  const kong = liveKong();

  it('reads and updates node and cluster log levels via /debug/*', async () => {
    const initial = await kong.debug.getLogLevel();
    expect(initial.message).toMatch(/log level/i);
    const initialLevelMatch = initial.message.match(/:\s*([a-z]+)\s*$/i);
    const restoreLevel = initialLevelMatch?.[1] ?? 'notice';

    try {
      const nodeRes = await kong.debug.setLogLevel('info', { timeout: 10 });
      expect(nodeRes.message).toMatch(/log level/i);

      const afterNode = await kong.debug.getLogLevel();
      expect(afterNode.message).toMatch(/info/i);

      const clusterRes = await kong.debug.setClusterLogLevel('warn', { timeout: 10 });
      expect(clusterRes.message).toMatch(/log level/i);

      const afterCluster = await kong.debug.getLogLevel();
      expect(afterCluster.message).toMatch(/warn/i);
    } finally {
      await kong.debug.setClusterLogLevel(restoreLevel, { timeout: 10 });
    }
  });

  it('returns 400 on /clustering/data-planes and /clustering/status on a standalone node', async () => {
    const dataPlanesError = await captureHttpError(kong.clustering.dataPlanes());
    expect(dataPlanesError.status).toBe(400);
    expect(dataPlanesError.message).toMatch(/control plane/i);

    const statusError = await captureHttpError(kong.clustering.status());
    expect(statusError.status).toBe(400);
    expect(statusError.message).toMatch(/control plane/i);
  });
});
