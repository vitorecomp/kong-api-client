---
title: Error Handling
group: Guides
---

# Error Handling

Every error raised by `kong-api-client` extends `KongError` (except caller-initiated aborts, which rethrow the `AbortSignal`'s abort reason unchanged).

## Error hierarchy

| Class                 | When it is thrown                                                                                                                                                            | Extra properties                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `KongError`           | Base class. Also thrown for invalid client configuration (missing/invalid `adminUrl`, invalid `timeoutMs`), empty path segments in `segment()`, or malformed JSON responses. | Standard `Error` (`message`, `cause`)                            |
| `KongHttpError`       | Kong returned a non-2xx HTTP status code.                                                                                                                                    | `status`, `method`, `path`, `code`, `kongName`, `fields`, `body` |
| `KongConnectionError` | Network, DNS, or socket failure before receiving an HTTP response.                                                                                                           | `cause` (underlying fetch error)                                 |
| `KongTimeoutError`    | Request exceeded the configured `timeoutMs`.                                                                                                                                 | `timeoutMs`                                                      |

### Credential safety

Error instances never store request headers or request bodies, so Admin API tokens, passwords, and plugin secrets will not leak if you log a caught error.

### No client-side validation and no automatic retries

- The library does not validate entity payloads before sending them. Kong is the authority; if Kong rejects a payload, the library throws `KongHttpError` with Kong's exact status, error name, numeric code, and per-field errors.
- The transport never retries failed requests automatically.

## Handling 404 responses

Use `find()` when a missing entity is an expected outcome:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const service = await kong.services.find('may-not-exist');
if (!service) {
  console.log('Service does not exist yet');
}
```

`find()` returns `undefined` only for `404` responses. Any other error (`400`, `401`, `500`, connection failures, timeouts) is rethrown.

## Inspecting `KongHttpError`

`KongHttpError.message` is formatted as `"<status> <Kong message or status text> (<METHOD> <path>)"` (query strings are omitted from `path`).

When Kong returns a JSON error body — such as a `400` schema violation or a `409` unique constraint conflict — the parsed fields are attached directly to the error:

```ts
import { Kong, KongHttpError } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

try {
  await kong.services.create({
    host: 'example.com',
    port: 99_999,
  });
} catch (error) {
  if (error instanceof KongHttpError) {
    console.error(error.message); // e.g. "400 schema violation (port: value should be between 0 and 65535) (POST /services)"
    console.error({
      status: error.status, // 400
      method: error.method, // 'POST'
      path: error.path, // '/services'
      kongName: error.kongName, // 'schema violation'
      code: error.code, // 2
      fields: error.fields, // { port: 'value should be between 0 and 65535' }
      body: error.body, // full parsed response body
    });
  } else {
    throw error;
  }
}
```

## Handling timeouts, connection errors, and aborts

```ts
import { Kong, KongConnectionError, KongHttpError, KongTimeoutError } from 'kong-api-client';

const kong = new Kong({
  adminUrl: 'http://localhost:8001',
  timeoutMs: 5_000,
});

const controller = new AbortController();

try {
  await kong.services.list(undefined, { signal: controller.signal });
} catch (error) {
  if (error instanceof KongTimeoutError) {
    console.error(`Timed out after ${error.timeoutMs}ms`);
  } else if (error instanceof KongConnectionError) {
    console.error('Could not reach Kong Admin API:', error.cause);
  } else if (error instanceof KongHttpError) {
    console.error(`Kong responded with HTTP ${error.status}: ${error.message}`);
  } else if (controller.signal.aborted) {
    console.error('Cancelled by caller:', controller.signal.reason);
  } else {
    throw error;
  }
}
```

When a request is aborted via your `AbortSignal`, the transport rethrows `signal.reason` unchanged instead of wrapping it in `KongTimeoutError` or `KongConnectionError`.
