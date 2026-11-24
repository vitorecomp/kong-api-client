---
title: File Log
group: Plugins
category: Logging
---

# File Log (`file-log`)

- **Category:** Logging
- **Kong documentation:** [https://developer.konghq.com/plugins/file-log/](https://developer.konghq.com/plugins/file-log/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('file-log', {
  on: { route: 'my-route' },
  config: { path: '/tmp/kong-access.log', reopen: true },
});
```

## Configuration fields

| Field                  | Type                     | Required | Default | Description                                                                                    |
| ---------------------- | ------------------------ | -------- | ------- | ---------------------------------------------------------------------------------------------- |
| `custom_fields_by_lua` | `Record<string, string>` | No       | —       | Lua code as a key-value map                                                                    |
| `path`                 | `string`                 | Yes      | —       | The file path of the output log file. The plugin creates the log file if it doesn't exist yet. |
| `reopen`               | `boolean`                | No       | `false` | Determines whether the log file is closed and reopened on every request.                       |
