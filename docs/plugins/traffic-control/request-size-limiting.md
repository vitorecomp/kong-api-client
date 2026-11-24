---
title: Request Size Limiting
group: Plugins
category: Traffic Control
---

# Request Size Limiting (`request-size-limiting`)

- **Category:** Traffic Control
- **Kong documentation:** [https://developer.konghq.com/plugins/request-size-limiting/](https://developer.konghq.com/plugins/request-size-limiting/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('request-size-limiting', {
  on: { route: 'my-route' },
  config: { allowed_payload_size: 16, size_unit: 'megabytes', require_content_length: true },
});
```

## Configuration fields

| Field                    | Type                                    | Required | Default       | Description                                                                                                                                                                          |
| ------------------------ | --------------------------------------- | -------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `allowed_payload_size`   | `number`                                | No       | `128`         | Allowed request payload size in megabytes. Default is `128` megabytes (128000000 bytes).                                                                                             |
| `require_content_length` | `boolean`                               | No       | `false`       | Set to `true` to ensure a valid `Content-Length` header exists before reading the request body.                                                                                      |
| `size_unit`              | `'bytes' \| 'kilobytes' \| 'megabytes'` | No       | `'megabytes'` | Size unit can be set either in `bytes`, `kilobytes`, or `megabytes` (default). This configuration is not available in versions prior to Kong Gateway 1.3 and Kong Gateway (OSS) 2.0. |
