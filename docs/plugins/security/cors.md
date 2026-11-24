---
title: CORS
---

# CORS (`cors`)

- **Category:** Security
- **Kong documentation:** [https://developer.konghq.com/plugins/cors/](https://developer.konghq.com/plugins/cors/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('cors', {
  on: { route: 'my-route' },
  config: {},
});
```

## Configuration fields

| Field                 | Type                                                                                                    | Required | Default                                                                    | Description                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `credentials`         | `boolean`                                                                                               | No       | `false`                                                                    | Flag to determine whether the `Access-Control-Allow-Credentials` header should be sent with `true` as the value.                                                                                                               |
| `exposed_headers`     | `Array<string>`                                                                                         | No       | —                                                                          | Value for the `Access-Control-Expose-Headers` header. If not specified, no custom headers are exposed.                                                                                                                         |
| `headers`             | `Array<string>`                                                                                         | No       | —                                                                          | Value for the `Access-Control-Allow-Headers` header.                                                                                                                                                                           |
| `max_age`             | `number`                                                                                                | No       | —                                                                          | Indicates how long the results of the preflight request can be cached, in `seconds`.                                                                                                                                           |
| `methods`             | `Array<'CONNECT' \| 'DELETE' \| 'GET' \| 'HEAD' \| 'OPTIONS' \| 'PATCH' \| 'POST' \| 'PUT' \| 'TRACE'>` | No       | `["GET","HEAD","PUT","PATCH","POST","DELETE","OPTIONS","TRACE","CONNECT"]` | 'Value for the `Access-Control-Allow-Methods` header. Available options include `GET`, `HEAD`, `PUT`, `PATCH`, `POST`, `DELETE`, `OPTIONS`, `TRACE`, `CONNECT`. By default, all options are allowed.'                          |
| `origins`             | `Array<string>`                                                                                         | No       | —                                                                          | List of allowed domains for the `Access-Control-Allow-Origin` header. If you want to allow all origins, add `*` as a single value to this configuration field. The accepted values can either be flat strings or PCRE regexes. |
| `preflight_continue`  | `boolean`                                                                                               | No       | `false`                                                                    | A boolean value that instructs the plugin to proxy the `OPTIONS` preflight request to the Upstream service.                                                                                                                    |
| `private_network`     | `boolean`                                                                                               | No       | `false`                                                                    | Flag to determine whether the `Access-Control-Allow-Private-Network` header should be sent with `true` as the value.                                                                                                           |
| `allow_origin_absent` | `boolean`                                                                                               | No       | `true`                                                                     | Kong Gateway 3.14 only.                                                                                                                                                                                                        |
