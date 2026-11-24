---
title: Request Transformer
---

# Request Transformer (`request-transformer`)

- **Category:** Transformations
- **Kong documentation:** [https://developer.konghq.com/plugins/request-transformer/](https://developer.konghq.com/plugins/request-transformer/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('request-transformer', {
  on: { route: 'my-route' },
  config: { add: { headers: ['X-Test:1'] } },
});
```

## Configuration fields

| Field                 | Type            | Required | Default | Description                                                                                                              |
| --------------------- | --------------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------ |
| `add`                 | `object`        | No       | —       | —                                                                                                                        |
| `add.body`            | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `add.headers`         | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `add.querystring`     | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `append`              | `object`        | No       | —       | —                                                                                                                        |
| `append.body`         | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `append.headers`      | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `append.querystring`  | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `http_method`         | `string`        | No       | —       | A string representing an HTTP method, such as GET, POST, PUT, or DELETE. The string must contain only uppercase letters. |
| `remove`              | `object`        | No       | —       | —                                                                                                                        |
| `remove.body`         | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `remove.headers`      | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `remove.querystring`  | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `rename`              | `object`        | No       | —       | —                                                                                                                        |
| `rename.body`         | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `rename.headers`      | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `rename.querystring`  | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `replace`             | `object`        | No       | —       | —                                                                                                                        |
| `replace.body`        | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `replace.headers`     | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `replace.querystring` | `Array<string>` | No       | `[]`    | —                                                                                                                        |
| `replace.uri`         | `string`        | No       | —       | —                                                                                                                        |
