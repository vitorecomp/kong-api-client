---
title: LDAP Authentication
---

# LDAP Authentication (`ldap-auth`)

- **Category:** Authentication
- **Kong documentation:** [https://developer.konghq.com/plugins/ldap-auth/](https://developer.konghq.com/plugins/ldap-auth/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('ldap-auth', {
  on: { route: 'my-route' },
  config: { ldap_host: 'ldap.example.com', base_dn: 'dc=example,dc=com', attribute: 'cn' },
});
```

## Configuration fields

| Field              | Type      | Required | Default                                      | Description                                                                                                                                                                                         |
| ------------------ | --------- | -------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anonymous`        | `string`  | No       | —                                            | An optional string (consumer UUID or username) value to use as an “anonymous” consumer if authentication fails. If empty (default null), the request fails with an authentication failure `4xx`.    |
| `attribute`        | `string`  | Yes      | —                                            | Attribute to be used to search the user; e.g. cn                                                                                                                                                    |
| `base_dn`          | `string`  | Yes      | —                                            | Base DN as the starting point for the search; e.g., dc=example,dc=com                                                                                                                               |
| `cache_ttl`        | `number`  | No       | `60`                                         | Cache expiry time in seconds.                                                                                                                                                                       |
| `header_type`      | `string`  | No       | `'ldap'`                                     | An optional string to use as part of the Authorization header                                                                                                                                       |
| `hide_credentials` | `boolean` | No       | Kong 3.9: `false`; Kong Gateway 3.14: `true` | An optional boolean value telling the plugin to hide the credential to the upstream server. It will be removed by Kong before proxying the request.                                                 |
| `keepalive`        | `number`  | No       | `60000`                                      | An optional value in milliseconds that defines how long an idle connection to LDAP server will live before being closed.                                                                            |
| `ldap_host`        | `string`  | Yes      | —                                            | A string representing a host name, such as example.com.                                                                                                                                             |
| `ldap_port`        | `number`  | No       | `389`                                        | An integer representing a port number between 0 and 65535, inclusive.                                                                                                                               |
| `ldaps`            | `boolean` | No       | `false`                                      | Set to `true` to connect using the LDAPS protocol (LDAP over TLS). When `ldaps` is configured, you must use port 636. If the `ldap` setting is enabled, ensure the `start_tls` setting is disabled. |
| `realm`            | `string`  | No       | —                                            | When authentication fails the plugin sends `WWW-Authenticate` header with `realm` attribute value.                                                                                                  |
| `start_tls`        | `boolean` | No       | `false`                                      | Set it to `true` to issue StartTLS (Transport Layer Security) extended operation over `ldap` connection. If the `start_tls` setting is enabled, ensure the `ldaps` setting is disabled.             |
| `timeout`          | `number`  | No       | `10000`                                      | An optional timeout in milliseconds when waiting for connection with LDAP server.                                                                                                                   |
| `verify_ldap_host` | `boolean` | No       | Kong 3.9: `false`; Kong Gateway 3.14: `true` | Set to `true` to authenticate LDAP server. The server certificate will be verified according to the CA certificates specified by the `lua_ssl_trusted_certificate` directive.                       |
