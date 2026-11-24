---
title: Loggly
group: Plugins
category: Logging
---

# Loggly (`loggly`)

- **Category:** Logging
- **Kong documentation:** [https://developer.konghq.com/plugins/loggly/](https://developer.konghq.com/plugins/loggly/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('loggly', {
  on: { route: 'my-route' },
  config: { key: '<your-loggly-token>', host: 'logs-01.example.com', log_level: 'info' },
});
```

## Configuration fields

| Field                    | Type                                                                                  | Required | Default                | Description                                                           |
| ------------------------ | ------------------------------------------------------------------------------------- | -------- | ---------------------- | --------------------------------------------------------------------- |
| `client_errors_severity` | `'alert' \| 'crit' \| 'debug' \| 'emerg' \| 'err' \| 'info' \| 'notice' \| 'warning'` | No       | `'info'`               | —                                                                     |
| `custom_fields_by_lua`   | `Record<string, string>`                                                              | No       | —                      | Lua code as a key-value map                                           |
| `host`                   | `string`                                                                              | No       | `'logs-01.loggly.com'` | A string representing a host name, such as example.com.               |
| `key`                    | `string`                                                                              | Yes      | —                      | —                                                                     |
| `log_level`              | `'alert' \| 'crit' \| 'debug' \| 'emerg' \| 'err' \| 'info' \| 'notice' \| 'warning'` | No       | `'info'`               | —                                                                     |
| `port`                   | `number`                                                                              | No       | `514`                  | An integer representing a port number between 0 and 65535, inclusive. |
| `server_errors_severity` | `'alert' \| 'crit' \| 'debug' \| 'emerg' \| 'err' \| 'info' \| 'notice' \| 'warning'` | No       | `'info'`               | —                                                                     |
| `successful_severity`    | `'alert' \| 'crit' \| 'debug' \| 'emerg' \| 'err' \| 'info' \| 'notice' \| 'warning'` | No       | `'info'`               | —                                                                     |
| `tags`                   | `Array<string>`                                                                       | No       | `["kong"]`             | —                                                                     |
| `timeout`                | `number`                                                                              | No       | `10000`                | —                                                                     |
