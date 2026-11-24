---
title: UDP Log
group: Plugins
category: Logging
---

# UDP Log (`udp-log`)

- **Category:** Logging
- **Kong documentation:** [https://developer.konghq.com/plugins/udp-log/](https://developer.konghq.com/plugins/udp-log/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('udp-log', {
  on: { route: 'my-route' },
  config: { host: '192.0.2.11', port: 5140, timeout: 10000 },
});
```

## Configuration fields

| Field                  | Type                     | Required | Default | Description                                                                   |
| ---------------------- | ------------------------ | -------- | ------- | ----------------------------------------------------------------------------- |
| `custom_fields_by_lua` | `Record<string, string>` | No       | —       | Lua code as a key-value map                                                   |
| `host`                 | `string`                 | Yes      | —       | A string representing a host name, such as example.com.                       |
| `port`                 | `number`                 | Yes      | —       | An integer representing a port number between 0 and 65535, inclusive.         |
| `timeout`              | `number`                 | No       | `10000` | An optional timeout in milliseconds when sending data to the upstream server. |
