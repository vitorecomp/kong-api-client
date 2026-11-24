---
title: HMAC Auth
---

# HMAC Auth (`hmac-auth`)

- **Category:** Authentication
- **Kong documentation:** [https://developer.konghq.com/plugins/hmac-auth/](https://developer.konghq.com/plugins/hmac-auth/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('hmac-auth', {
  on: { route: 'my-route' },
  config: {},
});
```

## Configuration fields

| Field                   | Type                                                                                     | Required | Default                                                                                                                                             | Description                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `algorithms`            | `Array<'hmac-sha1' \| 'hmac-sha256' \| 'hmac-sha384' \| 'hmac-sha512' \| 'hmac-sha224'>` | No       | Kong 3.9: `["hmac-sha1","hmac-sha256","hmac-sha384","hmac-sha512"]`; Kong Gateway 3.14: `["hmac-sha224","hmac-sha256","hmac-sha384","hmac-sha512"]` | A list of HMAC digest algorithms that the user wants to support. Allowed values are `hmac-sha1`, `hmac-sha256`, `hmac-sha384`, and `hmac-sha512`. Kong Gateway 3.14 only values: `'hmac-sha224'`. |
| `anonymous`             | `string`                                                                                 | No       | —                                                                                                                                                   | An optional string (Consumer UUID or username) value to use as an “anonymous” consumer if authentication fails.                                                                                   |
| `clock_skew`            | `number`                                                                                 | No       | `300`                                                                                                                                               | Clock skew in seconds to prevent replay attacks.                                                                                                                                                  |
| `enforce_headers`       | `Array<string>`                                                                          | No       | `[]`                                                                                                                                                | A list of headers that the client should at least use for HTTP signature creation.                                                                                                                |
| `hide_credentials`      | `boolean`                                                                                | No       | Kong 3.9: `false`; Kong Gateway 3.14: `true`                                                                                                        | An optional boolean value telling the plugin to show or hide the credential from the upstream service.                                                                                            |
| `realm`                 | `string`                                                                                 | No       | —                                                                                                                                                   | When authentication fails the plugin sends `WWW-Authenticate` header with `realm` attribute value.                                                                                                |
| `validate_request_body` | `boolean`                                                                                | No       | `false`                                                                                                                                             | A boolean value telling the plugin to enable body validation.                                                                                                                                     |
