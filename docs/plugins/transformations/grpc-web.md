---
title: gRPC-Web
---

# gRPC-Web (`grpc-web`)

- **Category:** Transformations
- **Kong documentation:** [https://developer.konghq.com/plugins/grpc-web/](https://developer.konghq.com/plugins/grpc-web/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('grpc-web', {
  on: { route: 'my-route' },
  config: {},
});
```

## Configuration fields

| Field                 | Type      | Required | Default | Description                                                                                                                                                         |
| --------------------- | --------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allow_origin_header` | `string`  | No       | `'*'`   | The value of the `Access-Control-Allow-Origin` header in the response to the gRPC-Web client.                                                                       |
| `pass_stripped_path`  | `boolean` | No       | —       | If set to `true` causes the plugin to pass the stripped request path to the upstream gRPC service.                                                                  |
| `proto`               | `string`  | No       | —       | If present, describes the gRPC types and methods. Required to support payload transcoding. When absent, the web client must use application/grpw-web+proto content. |
