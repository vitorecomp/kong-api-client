---
title: Pre-Function
---

# Pre-Function (`pre-function`)

- **Category:** Serverless
- **Kong documentation:** [https://developer.konghq.com/plugins/pre-function/](https://developer.konghq.com/plugins/pre-function/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('pre-function', {
  on: { route: 'my-route' },
  config: { access: ['return'] },
});
```

## Configuration fields

| Field               | Type            | Required | Default | Description                                                                                                                                                                              |
| ------------------- | --------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `access`            | `Array<string>` | No       | `[]`    | Custom functions, which can be user-defined, are cached and executed sequentially during specific phases: `certificate`, `rewrite`, `access`, `header_filter`, `body_filter`, and `log`. |
| `body_filter`       | `Array<string>` | No       | `[]`    | Custom functions, which can be user-defined, are cached and executed sequentially during specific phases: `certificate`, `rewrite`, `access`, `header_filter`, `body_filter`, and `log`. |
| `certificate`       | `Array<string>` | No       | `[]`    | Custom functions, which can be user-defined, are cached and executed sequentially during specific phases: `certificate`, `rewrite`, `access`, `header_filter`, `body_filter`, and `log`. |
| `header_filter`     | `Array<string>` | No       | `[]`    | Custom functions, which can be user-defined, are cached and executed sequentially during specific phases: `certificate`, `rewrite`, `access`, `header_filter`, `body_filter`, and `log`. |
| `log`               | `Array<string>` | No       | `[]`    | Custom functions, which can be user-defined, are cached and executed sequentially during specific phases: `certificate`, `rewrite`, `access`, `header_filter`, `body_filter`, and `log`. |
| `rewrite`           | `Array<string>` | No       | `[]`    | Custom functions, which can be user-defined, are cached and executed sequentially during specific phases: `certificate`, `rewrite`, `access`, `header_filter`, `body_filter`, and `log`. |
| `ws_client_frame`   | `Array<string>` | No       | `[]`    | Kong Gateway 3.14 only.                                                                                                                                                                  |
| `ws_close`          | `Array<string>` | No       | `[]`    | Kong Gateway 3.14 only.                                                                                                                                                                  |
| `ws_handshake`      | `Array<string>` | No       | `[]`    | Kong Gateway 3.14 only.                                                                                                                                                                  |
| `ws_upstream_frame` | `Array<string>` | No       | `[]`    | Kong Gateway 3.14 only.                                                                                                                                                                  |
