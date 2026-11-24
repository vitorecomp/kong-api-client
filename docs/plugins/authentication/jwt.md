---
title: JWT
group: Plugins
category: Authentication
---

# JWT (`jwt`)

- **Category:** Authentication
- **Kong documentation:** [https://developer.konghq.com/plugins/jwt/](https://developer.konghq.com/plugins/jwt/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('jwt', {
  on: { route: 'my-route' },
  config: { claims_to_verify: ['exp'], key_claim_name: 'iss' },
});
```

## Configuration fields

| Field                | Type                    | Required | Default             | Description                                                                                                                                                                              |
| -------------------- | ----------------------- | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anonymous`          | `string`                | No       | —                   | An optional string (consumer UUID or username) value to use as an “anonymous” consumer if authentication fails.                                                                          |
| `claims_to_verify`   | `Array<'exp' \| 'nbf'>` | No       | —                   | A list of registered claims (according to RFC 7519) that Kong can verify as well. Accepted values: one of exp or nbf.                                                                    |
| `cookie_names`       | `Array<string>`         | No       | `[]`                | A list of cookie names that Kong will inspect to retrieve JWTs.                                                                                                                          |
| `header_names`       | `Array<string>`         | No       | `["authorization"]` | A list of HTTP header names that Kong will inspect to retrieve JWTs.                                                                                                                     |
| `key_claim_name`     | `string`                | No       | `'iss'`             | The name of the claim in which the key identifying the secret must be passed. The plugin will attempt to read this claim from the JWT payload and the header, in that order.             |
| `maximum_expiration` | `number`                | No       | `0`                 | A value between 0 and 31536000 (365 days) limiting the lifetime of the JWT to maximum_expiration seconds in the future.                                                                  |
| `realm`              | `string`                | No       | —                   | When authentication fails the plugin sends `WWW-Authenticate` header with `realm` attribute value.                                                                                       |
| `run_on_preflight`   | `boolean`               | No       | `true`              | A boolean value that indicates whether the plugin should run (and try to authenticate) on OPTIONS preflight requests. If set to false, then OPTIONS requests will always be allowed.     |
| `secret_is_base64`   | `boolean`               | No       | `false`             | If true, the plugin assumes the credential’s secret to be base64 encoded. You will need to create a base64-encoded secret for your Consumer, and sign your JWT with the original secret. |
| `uri_param_names`    | `Array<string>`         | No       | `["jwt"]`           | A list of querystring parameters that Kong will inspect to retrieve JWTs.                                                                                                                |
