---
title: gRPC-Gateway
---

# gRPC-Gateway (`grpc-gateway`)

- **Category:** Transformations
- **Kong documentation:** [https://developer.konghq.com/plugins/grpc-gateway/](https://developer.konghq.com/plugins/grpc-gateway/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('grpc-gateway', {
  on: { route: 'my-route' },
  config: {},
});
```

## Configuration fields

| Field   | Type     | Required | Default | Description                           |
| ------- | -------- | -------- | ------- | ------------------------------------- |
| `proto` | `string` | No       | —       | Describes the gRPC types and methods. |
