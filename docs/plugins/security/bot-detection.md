---
title: Bot Detection
---

# Bot Detection (`bot-detection`)

- **Category:** Security
- **Kong documentation:** [https://developer.konghq.com/plugins/bot-detection/](https://developer.konghq.com/plugins/bot-detection/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('bot-detection', {
  on: { route: 'my-route' },
  config: { deny: ['badbot'] },
});
```

## Configuration fields

| Field   | Type            | Required | Default | Description                                                                                                                      |
| ------- | --------------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `allow` | `Array<string>` | No       | `[]`    | An array of regular expressions that should be allowed. The regular expressions will be checked against the `User-Agent` header. |
| `deny`  | `Array<string>` | No       | `[]`    | An array of regular expressions that should be denied. The regular expressions will be checked against the `User-Agent` header.  |
