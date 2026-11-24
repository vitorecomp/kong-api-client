---
title: Syslog
---

# Syslog (`syslog`)

- **Category:** Logging
- **Kong documentation:** [https://developer.konghq.com/plugins/syslog/](https://developer.konghq.com/plugins/syslog/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('syslog', {
  on: { route: 'my-route' },
  config: {},
});
```

## Configuration fields

| Field                    | Type                                                                                                                                                                                                                         | Required | Default  | Description                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | -------------------------------------------------------------------------------------- |
| `client_errors_severity` | `'alert' \| 'crit' \| 'debug' \| 'emerg' \| 'err' \| 'info' \| 'notice' \| 'warning'`                                                                                                                                        | No       | `'info'` | —                                                                                      |
| `custom_fields_by_lua`   | `Record<string, string>`                                                                                                                                                                                                     | No       | —        | Lua code as a key-value map                                                            |
| `facility`               | `'auth' \| 'authpriv' \| 'cron' \| 'daemon' \| 'ftp' \| 'kern' \| 'local0' \| 'local1' \| 'local2' \| 'local3' \| 'local4' \| 'local5' \| 'local6' \| 'local7' \| 'lpr' \| 'mail' \| 'news' \| 'syslog' \| 'user' \| 'uucp'` | No       | `'user'` | The facility is used by the operating system to decide how to handle each log message. |
| `log_level`              | `'alert' \| 'crit' \| 'debug' \| 'emerg' \| 'err' \| 'info' \| 'notice' \| 'warning'`                                                                                                                                        | No       | `'info'` | —                                                                                      |
| `server_errors_severity` | `'alert' \| 'crit' \| 'debug' \| 'emerg' \| 'err' \| 'info' \| 'notice' \| 'warning'`                                                                                                                                        | No       | `'info'` | —                                                                                      |
| `successful_severity`    | `'alert' \| 'crit' \| 'debug' \| 'emerg' \| 'err' \| 'info' \| 'notice' \| 'warning'`                                                                                                                                        | No       | `'info'` | —                                                                                      |
