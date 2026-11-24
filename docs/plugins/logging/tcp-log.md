---
title: TCP Log
---

# TCP Log (`tcp-log`)

- **Category:** Logging
- **Kong documentation:** [https://developer.konghq.com/plugins/tcp-log/](https://developer.konghq.com/plugins/tcp-log/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('tcp-log', {
  on: { route: 'my-route' },
  config: { host: '127.0.0.1', port: 9999 },
});
```

## Configuration fields

| Field                  | Type                     | Required | Default | Description                                                                                                                                                        |
| ---------------------- | ------------------------ | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `custom_fields_by_lua` | `Record<string, string>` | No       | —       | A list of key-value pairs, where the key is the name of a log field and the value is a chunk of Lua code, whose return value sets or replaces the log field value. |
| `host`                 | `string`                 | Yes      | —       | The IP address or host name to send data to.                                                                                                                       |
| `keepalive`            | `number`                 | No       | `60000` | An optional value in milliseconds that defines how long an idle connection lives before being closed.                                                              |
| `port`                 | `number`                 | Yes      | —       | The port to send data to on the upstream server.                                                                                                                   |
| `timeout`              | `number`                 | No       | `10000` | An optional timeout in milliseconds when sending data to the upstream server.                                                                                      |
| `tls`                  | `boolean`                | No       | `false` | Indicates whether to perform a TLS handshake against the remote server.                                                                                            |
| `tls_sni`              | `string`                 | No       | —       | An optional string that defines the SNI (Server Name Indication) hostname to send in the TLS handshake.                                                            |
| `ssl_verify`           | `boolean`                | No       | `true`  | Kong Gateway 3.14 only.                                                                                                                                            |
