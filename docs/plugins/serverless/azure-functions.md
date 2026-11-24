---
title: Azure Functions
group: Plugins
category: Serverless
---

# Azure Functions (`azure-functions`)

- **Category:** Serverless
- **Kong documentation:** [https://developer.konghq.com/plugins/azure-functions/](https://developer.konghq.com/plugins/azure-functions/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `tcp`, `tls`, `tls_passthrough`, `udp`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('azure-functions', {
  on: { route: 'my-route' },
  config: { appname: 'orders-func-app', functionname: 'process-order', https: true },
});
```

## Configuration fields

| Field          | Type      | Required | Default                                      | Description                                                                                                     |
| -------------- | --------- | -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `apikey`       | `string`  | No       | —                                            | The apikey to access the Azure resources. If provided, it is injected as the `x-functions-key` header.          |
| `appname`      | `string`  | Yes      | —                                            | The Azure app name.                                                                                             |
| `clientid`     | `string`  | No       | —                                            | The `clientid` to access the Azure resources. If provided, it is injected as the `x-functions-clientid` header. |
| `functionname` | `string`  | Yes      | —                                            | Name of the Azure function to invoke.                                                                           |
| `hostdomain`   | `string`  | No       | `'azurewebsites.net'`                        | The domain where the function resides.                                                                          |
| `https`        | `boolean` | No       | `true`                                       | Use of HTTPS to connect with the Azure Functions server.                                                        |
| `https_verify` | `boolean` | No       | Kong 3.9: `false`; Kong Gateway 3.14: `true` | Set to `true` to authenticate the Azure Functions server.                                                       |
| `keepalive`    | `number`  | No       | `60000`                                      | Time in milliseconds during which an idle connection to the Azure Functions server lives before being closed.   |
| `routeprefix`  | `string`  | No       | `'api'`                                      | Route prefix to use.                                                                                            |
| `timeout`      | `number`  | No       | `600000`                                     | Timeout in milliseconds before closing a connection to the Azure Functions server.                              |
