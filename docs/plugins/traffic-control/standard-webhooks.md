---
title: Standard Webhooks
group: Plugins
category: Traffic Control
---

# Standard Webhooks (`standard-webhooks`)

- **Category:** Traffic Control
- **Kong documentation:** [https://developer.konghq.com/plugins/standard-webhooks/](https://developer.konghq.com/plugins/standard-webhooks/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('standard-webhooks', {
  on: { route: 'my-route' },
  config: { secret_v1: 'd2hzZWNfZXhhbXBsZV9zZWNyZXQ=', tolerance_second: 300 },
});
```

## Configuration fields

| Field              | Type     | Required | Default | Description                                                                                                                                              |
| ------------------ | -------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `secret_v1`        | `string` | Yes      | —       | Webhook secret                                                                                                                                           |
| `tolerance_second` | `number` | No       | `300`   | Tolerance of the webhook timestamp in seconds. If the webhook timestamp is older than this number of seconds, it will be rejected with a '400' response. |
