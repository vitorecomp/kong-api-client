---
title: Request Termination
---

# Request Termination (`request-termination`)

- **Category:** Traffic Control
- **Kong documentation:** [https://developer.konghq.com/plugins/request-termination/](https://developer.konghq.com/plugins/request-termination/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('request-termination', {
  on: { route: 'my-route' },
  config: { status_code: 503 },
});
```

## Configuration fields

| Field          | Type      | Required | Default | Description                                                                                                                                                                                                                    |
| -------------- | --------- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `body`         | `string`  | No       | —       | The raw response body to send. This is mutually exclusive with the `config.message` field.                                                                                                                                     |
| `content_type` | `string`  | No       | —       | Content type of the raw response configured with `config.body`.                                                                                                                                                                |
| `echo`         | `boolean` | No       | `false` | When set, the plugin will echo a copy of the request back to the client. The main usecase for this is debugging. It can be combined with `trigger` in order to debug requests on live systems without disturbing real traffic. |
| `message`      | `string`  | No       | —       | The message to send, if using the default response generator.                                                                                                                                                                  |
| `status_code`  | `number`  | No       | `503`   | The response code to send. Must be an integer between 100 and 599.                                                                                                                                                             |
| `trigger`      | `string`  | No       | —       | A string representing an HTTP header name.                                                                                                                                                                                     |
