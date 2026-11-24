---
title: Redirect
group: Plugins
category: Traffic Control
---

# Redirect (`redirect`)

- **Category:** Traffic Control
- **Kong documentation:** [https://developer.konghq.com/plugins/redirect/](https://developer.konghq.com/plugins/redirect/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('redirect', {
  on: { route: 'my-route' },
  config: { location: 'https://api.example.com/v2', status_code: 301, keep_incoming_path: true },
});
```

## Configuration fields

| Field                | Type      | Required | Default | Description                                                          |
| -------------------- | --------- | -------- | ------- | -------------------------------------------------------------------- |
| `keep_incoming_path` | `boolean` | No       | `false` | Use the incoming request's path and query string in the redirect URL |
| `location`           | `string`  | Yes      | —       | The URL to redirect to                                               |
| `status_code`        | `number`  | No       | `301`   | The response code to send. Must be an integer between 100 and 599.   |
