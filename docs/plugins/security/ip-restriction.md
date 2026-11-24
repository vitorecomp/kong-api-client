---
title: IP Restriction
group: Plugins
category: Security
---

# IP Restriction (`ip-restriction`)

- **Category:** Security
- **Kong documentation:** [https://developer.konghq.com/plugins/ip-restriction/](https://developer.konghq.com/plugins/ip-restriction/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('ip-restriction', {
  on: { route: 'my-route' },
  config: { allow: ['192.0.2.0/24', '10.0.0.0/8'], status: 403 },
});
```

## Configuration fields

| Field     | Type            | Required | Default | Description                                                                                    |
| --------- | --------------- | -------- | ------- | ---------------------------------------------------------------------------------------------- |
| `allow`   | `Array<string>` | No       | —       | List of IPs or CIDR ranges to allow. One of `config.allow` or `config.deny` must be specified. |
| `deny`    | `Array<string>` | No       | —       | List of IPs or CIDR ranges to deny. One of `config.allow` or `config.deny` must be specified.  |
| `message` | `string`        | No       | —       | The message to send as a response body to rejected requests.                                   |
| `status`  | `number`        | No       | —       | The HTTP status of the requests that will be rejected by the plugin.                           |
