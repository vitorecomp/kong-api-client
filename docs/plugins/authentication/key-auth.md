---
title: Key Auth
group: Plugins
category: Authentication
---

# Key Auth (`key-auth`)

- **Category:** Authentication
- **Kong documentation:** [https://developer.konghq.com/plugins/key-auth/](https://developer.konghq.com/plugins/key-auth/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('key-auth', {
  on: { route: 'my-route' },
  config: { key_names: ['X-API-Key'], hide_credentials: true },
});
```

## Configuration fields

| Field                      | Type              | Required | Default                                      | Description                                                                                                                                                                                          |
| -------------------------- | ----------------- | -------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anonymous`                | `string`          | No       | —                                            | An optional string (consumer UUID or username) value to use as an “anonymous” consumer if authentication fails. If empty (default null), the request will fail with an authentication failure `4xx`. |
| `hide_credentials`         | `boolean`         | No       | Kong 3.9: `false`; Kong Gateway 3.14: `true` | An optional boolean value telling the plugin to show or hide the credential from the upstream service. If `true`, the plugin strips the credential from the request.                                 |
| `key_in_body`              | `boolean`         | No       | `false`                                      | If enabled, the plugin reads the request body. Supported MIME types: `application/www-form-urlencoded`, `application/json`, and `multipart/form-data`.                                               |
| `key_in_header`            | `boolean`         | No       | `true`                                       | If enabled (default), the plugin reads the request header and tries to find the key in it.                                                                                                           |
| `key_in_query`             | `boolean`         | No       | `true`                                       | If enabled (default), the plugin reads the query parameter in the request and tries to find the key in it.                                                                                           |
| `key_names`                | `Array<string>`   | No       | `["apikey"]`                                 | Describes an array of parameter names where the plugin will look for a key. The key names may only contain [a-z], [A-Z], [0-9], [_] underscore, and [-] hyphen.                                      |
| `realm`                    | `string`          | No       | —                                            | When authentication fails the plugin sends `WWW-Authenticate` header with `realm` attribute value.                                                                                                   |
| `run_on_preflight`         | `boolean`         | No       | `true`                                       | A boolean value that indicates whether the plugin should run (and try to authenticate) on `OPTIONS` preflight requests. If set to `false`, then `OPTIONS` requests are always allowed.               |
| `identity_realms`          | `Array<object>`   | No       | `[{"id":null,"region":null,"scope":"cp"}]`   | Kong Gateway 3.14 only.                                                                                                                                                                              |
| `identity_realms[].id`     | `string`          | No       | —                                            | Kong Gateway 3.14 only.                                                                                                                                                                              |
| `identity_realms[].region` | `string`          | No       | —                                            | Kong Gateway 3.14 only.                                                                                                                                                                              |
| `identity_realms[].scope`  | `'cp' \| 'realm'` | No       | —                                            | Kong Gateway 3.14 only.                                                                                                                                                                              |
