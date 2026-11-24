import { KongHttpError } from '../../src/index.js';

/**
 * Awaits `promise` and returns the rejected {@link KongHttpError}.
 *
 * Throws if `promise` resolves instead of rejecting, and rethrows any
 * rejection that is not a {@link KongHttpError}.
 */
export async function captureHttpError(promise: Promise<unknown>): Promise<KongHttpError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof KongHttpError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected promise to reject with KongHttpError, but it resolved');
}
