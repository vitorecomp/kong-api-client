---
title: Response Transformer
---

# Response Transformer (`response-transformer`)

- **Category:** Transformations
- **Kong documentation:** [https://developer.konghq.com/plugins/response-transformer/](https://developer.konghq.com/plugins/response-transformer/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('response-transformer', {
  on: { route: 'my-route' },
  config: { add: { headers: ['X-Test:1'] } },
});
```

## Configuration fields

| Field                | Type                                       | Required | Default | Description                                                                                                                                                           |
| -------------------- | ------------------------------------------ | -------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `add`                | `object`                                   | No       | —       | —                                                                                                                                                                     |
| `add.headers`        | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `add.json`           | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `add.json_types`     | `Array<'boolean' \| 'number' \| 'string'>` | No       | `[]`    | List of JSON type names. Specify the types of the JSON values returned when appending JSON properties. Each string element can be one of: boolean, number, or string. |
| `append`             | `object`                                   | No       | —       | —                                                                                                                                                                     |
| `append.headers`     | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `append.json`        | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `append.json_types`  | `Array<'boolean' \| 'number' \| 'string'>` | No       | `[]`    | List of JSON type names. Specify the types of the JSON values returned when appending JSON properties. Each string element can be one of: boolean, number, or string. |
| `remove`             | `object`                                   | No       | —       | —                                                                                                                                                                     |
| `remove.headers`     | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `remove.json`        | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `rename`             | `object`                                   | No       | —       | —                                                                                                                                                                     |
| `rename.headers`     | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `rename.json`        | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `replace`            | `object`                                   | No       | —       | —                                                                                                                                                                     |
| `replace.headers`    | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `replace.json`       | `Array<string>`                            | No       | `[]`    | —                                                                                                                                                                     |
| `replace.json_types` | `Array<'boolean' \| 'number' \| 'string'>` | No       | `[]`    | List of JSON type names. Specify the types of the JSON values returned when appending JSON properties. Each string element can be one of: boolean, number, or string. |
