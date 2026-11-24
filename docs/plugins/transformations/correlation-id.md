---
title: Correlation ID
---

# Correlation ID (`correlation-id`)

- **Category:** Transformations
- **Kong documentation:** [https://developer.konghq.com/plugins/correlation-id/](https://developer.konghq.com/plugins/correlation-id/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('correlation-id', {
  on: { route: 'my-route' },
  config: {},
});
```

## Configuration fields

| Field             | Type                                    | Required | Default             | Description                                                                                                                            |
| ----------------- | --------------------------------------- | -------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `echo_downstream` | `boolean`                               | No       | `false`             | Whether to echo the header back to downstream (the client).                                                                            |
| `generator`       | `'tracker' \| 'uuid' \| 'uuid#counter'` | No       | `'uuid#counter'`    | The generator to use for the correlation ID. Accepted values are `uuid`, `uuid#counter`, and `tracker`. See [Generators](#generators). |
| `header_name`     | `string`                                | No       | `'Kong-Request-ID'` | The HTTP header name to use for the correlation ID.                                                                                    |
