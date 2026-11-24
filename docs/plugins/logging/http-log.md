---
title: HTTP Log
group: Plugins
category: Logging
---

# HTTP Log (`http-log`)

- **Category:** Logging
- **Kong documentation:** [https://developer.konghq.com/plugins/http-log/](https://developer.konghq.com/plugins/http-log/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('http-log', {
  on: { route: 'my-route' },
  config: { http_endpoint: 'https://logs.example.com/ingest', method: 'POST', timeout: 10000 },
});
```

## Configuration fields

| Field                        | Type                                                      | Required | Default              | Description                                                                                                                                                                                                                                       |
| ---------------------------- | --------------------------------------------------------- | -------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content_type`               | `'application/json' \| 'application/json; charset=utf-8'` | No       | `'application/json'` | Indicates the type of data sent. The only available option is `application/json`.                                                                                                                                                                 |
| `custom_fields_by_lua`       | `Record<string, string>`                                  | No       | —                    | Lua code as a key-value map                                                                                                                                                                                                                       |
| `flush_timeout`              | `number`                                                  | No       | —                    | Optional time in seconds. If `queue_size` > 1, this is the max idle time before sending a log with less than `queue_size` records. Deprecated: http-log: config.flush_timeout is deprecated, please use config.queue.max_coalescing_delay instead |
| `headers`                    | `Record<string, string>`                                  | No       | —                    | An optional table of headers included in the HTTP message to the upstream server. Values are indexed by header name, and each header name accepts a single string.                                                                                |
| `http_endpoint`              | `string`                                                  | Yes      | —                    | A string representing a URL, such as https://example.com/path/to/resource?q=search.                                                                                                                                                               |
| `keepalive`                  | `number`                                                  | No       | `60000`              | An optional value in milliseconds that defines how long an idle connection will live before being closed.                                                                                                                                         |
| `method`                     | `'PATCH' \| 'POST' \| 'PUT'`                              | No       | `'POST'`             | An optional method used to send data to the HTTP server. Supported values are `POST` (default), `PUT`, and `PATCH`.                                                                                                                               |
| `queue`                      | `object`                                                  | No       | —                    | —                                                                                                                                                                                                                                                 |
| `queue.concurrency_limit`    | `-1 \| 1`                                                 | No       | `1`                  | The number of of queue delivery timers. -1 indicates unlimited.                                                                                                                                                                                   |
| `queue.initial_retry_delay`  | `number`                                                  | No       | `0.01`               | Time in seconds before the initial retry is made for a failing batch.                                                                                                                                                                             |
| `queue.max_batch_size`       | `number`                                                  | No       | `1`                  | Maximum number of entries that can be processed at a time.                                                                                                                                                                                        |
| `queue.max_bytes`            | `number`                                                  | No       | —                    | Maximum number of bytes that can be waiting on a queue, requires string content.                                                                                                                                                                  |
| `queue.max_coalescing_delay` | `number`                                                  | No       | `1`                  | Maximum number of (fractional) seconds to elapse after the first entry was queued before the queue starts calling the handler.                                                                                                                    |
| `queue.max_entries`          | `number`                                                  | No       | `10000`              | Maximum number of entries that can be waiting on the queue.                                                                                                                                                                                       |
| `queue.max_retry_delay`      | `number`                                                  | No       | `60`                 | Maximum time in seconds between retries, caps exponential backoff.                                                                                                                                                                                |
| `queue.max_retry_time`       | `number`                                                  | No       | `60`                 | Time in seconds before the queue gives up calling a failed handler for a batch.                                                                                                                                                                   |
| `queue_size`                 | `number`                                                  | No       | —                    | Maximum number of log entries to be sent on each message to the upstream server. Deprecated: http-log: config.queue_size is deprecated, please use config.queue.max_batch_size instead                                                            |
| `retry_count`                | `number`                                                  | No       | —                    | Number of times to retry when sending data to the upstream server. Deprecated: http-log: config.retry_count no longer works, please use config.queue.max_retry_time instead                                                                       |
| `timeout`                    | `number`                                                  | No       | `10000`              | An optional timeout in milliseconds when sending data to the upstream server.                                                                                                                                                                     |
| `ssl_verify`                 | `boolean`                                                 | No       | `true`               | Kong Gateway 3.14 only.                                                                                                                                                                                                                           |
