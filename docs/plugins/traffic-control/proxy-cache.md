---
title: Proxy Cache
group: Plugins
category: Traffic Control
---

# Proxy Cache (`proxy-cache`)

- **Category:** Traffic Control
- **Kong documentation:** [https://developer.konghq.com/plugins/proxy-cache/](https://developer.konghq.com/plugins/proxy-cache/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('proxy-cache', {
  on: { route: 'my-route' },
  config: { strategy: 'memory', cache_ttl: 300, content_type: ['application/json'] },
});
```

## Configuration fields

| Field                             | Type                                                   | Required | Default                             | Description                                                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------ | -------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cache_control`                   | `boolean`                                              | No       | `false`                             | When enabled, respect the Cache-Control behaviors defined in RFC7234.                                                                                                                            |
| `cache_ttl`                       | `number`                                               | No       | `300`                               | TTL, in seconds, of cache entities.                                                                                                                                                              |
| `content_type`                    | `Array<string>`                                        | No       | `["text/plain","application/json"]` | Upstream response content types considered cacheable. The plugin performs an **exact match** against each specified value.                                                                       |
| `ignore_uri_case`                 | `boolean`                                              | No       | `false`                             | —                                                                                                                                                                                                |
| `memory`                          | `object`                                               | No       | —                                   | —                                                                                                                                                                                                |
| `memory.dictionary_name`          | `string`                                               | No       | `'kong_db_cache'`                   | The name of the shared dictionary in which to hold cache entities when the memory strategy is selected. Note that this dictionary currently must be defined manually in the Kong Nginx template. |
| `request_method`                  | `Array<'GET' \| 'HEAD' \| 'PATCH' \| 'POST' \| 'PUT'>` | No       | `["GET","HEAD"]`                    | Downstream request methods considered cacheable.                                                                                                                                                 |
| `response_code`                   | `Array<number>`                                        | No       | `[200,301,404]`                     | Upstream response status code considered cacheable.                                                                                                                                              |
| `response_headers`                | `object`                                               | No       | —                                   | Caching related diagnostic headers that should be included in cached responses                                                                                                                   |
| `response_headers.age`            | `boolean`                                              | No       | `true`                              | —                                                                                                                                                                                                |
| `response_headers.X-Cache-Key`    | `boolean`                                              | No       | `true`                              | —                                                                                                                                                                                                |
| `response_headers.X-Cache-Status` | `boolean`                                              | No       | `true`                              | —                                                                                                                                                                                                |
| `storage_ttl`                     | `number`                                               | No       | —                                   | Number of seconds to keep resources in the storage backend. This value is independent of `cache_ttl` or resource TTLs defined by Cache-Control behaviors.                                        |
| `strategy`                        | `'memory'`                                             | Yes      | —                                   | The backing data store in which to hold cache entities.                                                                                                                                          |
| `vary_headers`                    | `Array<string>`                                        | No       | —                                   | Relevant headers considered for the cache key. If undefined, none of the headers are taken into consideration.                                                                                   |
| `vary_query_params`               | `Array<string>`                                        | No       | —                                   | Relevant query parameters considered for the cache key. If undefined, all params are taken into consideration.                                                                                   |
