---
title: AI Prompt Template
---

# AI Prompt Template (`ai-prompt-template`)

- **Category:** AI
- **Kong documentation:** [https://developer.konghq.com/plugins/ai-prompt-template/](https://developer.konghq.com/plugins/ai-prompt-template/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('ai-prompt-template', {
  on: { route: 'my-route' },
  config: {
    templates: [
      { name: 'greet', template: '{"messages":[{"role":"user","content":"Hello {{name}}"}]}' },
    ],
  },
});
```

## Configuration fields

| Field                        | Type            | Required | Default                                        | Description                                                                  |
| ---------------------------- | --------------- | -------- | ---------------------------------------------- | ---------------------------------------------------------------------------- |
| `allow_untemplated_requests` | `boolean`       | No       | `true`                                         | Set true to allow requests that don't call or match any template.            |
| `log_original_request`       | `boolean`       | No       | `false`                                        | Set true to add the original request to the Kong log plugin(s) output.       |
| `max_request_body_size`      | `number`        | No       | Kong 3.9: `8192`; Kong Gateway 3.14: `1048576` | max allowed body size allowed to be introspected                             |
| `templates`                  | `Array<object>` | Yes      | —                                              | Array of templates available to the request context.                         |
| `templates[].name`           | `string`        | Yes      | —                                              | Unique name for the template, can be called with `{template://NAME}`         |
| `templates[].template`       | `string`        | Yes      | —                                              | Template string for this request, supports mustache-style `{{placeholders}}` |
