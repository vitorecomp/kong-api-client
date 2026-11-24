import { describe, expect, it } from 'vitest';
import {
  KongConnectionError,
  KongError,
  KongHttpError,
  KongTimeoutError,
} from '../../src/index.js';

describe('KongError hierarchy', () => {
  it('sets name and preserves cause on KongError', () => {
    const cause = new Error('root cause');
    const error = new KongError('something failed', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(KongError);
    expect(error.name).toBe('KongError');
    expect(error.message).toBe('something failed');
    expect(error.cause).toBe(cause);
  });

  it('formats KongHttpError message from Kong message and populates all fields', () => {
    const body = {
      message: 'schema violation (host: required field missing)',
      name: 'schema violation',
      code: 2,
      fields: { host: 'required field missing' },
    };
    const error = new KongHttpError({
      status: 400,
      statusText: 'Bad Request',
      method: 'POST',
      path: '/services',
      kongMessage: body.message,
      code: body.code,
      kongName: body.name,
      fields: body.fields,
      body,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(KongError);
    expect(error).toBeInstanceOf(KongHttpError);
    expect(error.name).toBe('KongHttpError');
    expect(error.message).toBe(
      '400 schema violation (host: required field missing) (POST /services)',
    );
    expect(error.status).toBe(400);
    expect(error.method).toBe('POST');
    expect(error.path).toBe('/services');
    expect(error.code).toBe(2);
    expect(error.kongName).toBe('schema violation');
    expect(error.fields).toEqual({ host: 'required field missing' });
    expect(error.body).toEqual(body);
  });

  it('falls back to statusText when Kong message is absent', () => {
    const error = new KongHttpError({
      status: 502,
      statusText: 'Bad Gateway',
      method: 'GET',
      path: '/services',
      body: '<html>Bad Gateway</html>',
    });

    expect(error.message).toBe('502 Bad Gateway (GET /services)');
    expect(error.code).toBeUndefined();
    expect(error.kongName).toBeUndefined();
    expect(error.fields).toBeUndefined();
    expect(error.body).toBe('<html>Bad Gateway</html>');
  });

  it('formats KongHttpError cleanly when both Kong message and statusText are empty', () => {
    const error = new KongHttpError({
      status: 500,
      statusText: '',
      method: 'DELETE',
      path: '/services/billing',
    });

    expect(error.message).toBe('500 (DELETE /services/billing)');
    expect(error.body).toBeUndefined();
  });

  it('sets name and preserves cause on KongConnectionError', () => {
    const cause = new TypeError('fetch failed');
    const error = new KongConnectionError('Connection failed (GET /services)', { cause });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(KongError);
    expect(error).toBeInstanceOf(KongConnectionError);
    expect(error.name).toBe('KongConnectionError');
    expect(error.cause).toBe(cause);
  });

  it('sets name, timeoutMs, and message on KongTimeoutError', () => {
    const withTarget = new KongTimeoutError(5000, 'GET', '/services');
    expect(withTarget).toBeInstanceOf(Error);
    expect(withTarget).toBeInstanceOf(KongError);
    expect(withTarget).toBeInstanceOf(KongTimeoutError);
    expect(withTarget.name).toBe('KongTimeoutError');
    expect(withTarget.timeoutMs).toBe(5000);
    expect(withTarget.message).toBe('Request timed out after 5000ms (GET /services)');

    const withoutTarget = new KongTimeoutError(1500);
    expect(withoutTarget.timeoutMs).toBe(1500);
    expect(withoutTarget.message).toBe('Request timed out after 1500ms');
  });
});
