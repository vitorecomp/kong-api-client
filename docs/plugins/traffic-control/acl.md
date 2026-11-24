---
title: ACL
---

# ACL (`acl`)

- **Category:** Traffic Control
- **Kong documentation:** [https://developer.konghq.com/plugins/acl/](https://developer.konghq.com/plugins/acl/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`, `ws`, `wss`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('acl', {
  on: { route: 'my-route' },
  config: { allow: ['admins'] },
});
```

## Configuration fields

| Field                             | Type            | Required | Default | Description                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | --------------- | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `allow`                           | `Array<string>` | No       | —       | Arbitrary group names that are allowed to consume the service or route. One of `config.allow` or `config.deny` must be specified.                                                                                                                                                                                                             |
| `always_use_authenticated_groups` | `boolean`       | No       | `false` | If enabled (`true`), the authenticated groups will always be used even when an authenticated consumer already exists. If the authenticated groups don't exist, it will fallback to use the groups associated with the consumer. By default the authenticated groups will only be used when there is no consumer or the consumer is anonymous. |
| `deny`                            | `Array<string>` | No       | —       | Arbitrary group names that are not allowed to consume the service or route. One of `config.allow` or `config.deny` must be specified.                                                                                                                                                                                                         |
| `hide_groups_header`              | `boolean`       | No       | `false` | If enabled (`true`), prevents the `X-Consumer-Groups` header from being sent in the request to the upstream service.                                                                                                                                                                                                                          |
| `include_consumer_groups`         | `boolean`       | No       | `false` | Kong Gateway 3.14 only.                                                                                                                                                                                                                                                                                                                       |
