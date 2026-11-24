---
title: AI Prompt Decorator
group: Plugins
category: AI
---

# AI Prompt Decorator (`ai-prompt-decorator`)

- **Category:** AI
- **Kong documentation:** [https://developer.konghq.com/plugins/ai-prompt-decorator/](https://developer.konghq.com/plugins/ai-prompt-decorator/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('ai-prompt-decorator', {
  on: { route: 'my-route' },
  config: {
    prompts: { prepend: [{ role: 'system', content: 'Answer concisely and cite sources.' }] },
  },
});
```

## Configuration fields

| Field                       | Type                                                                            | Required | Default                                        | Description                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `llm_format`                | `'bedrock' \| 'gemini' \| 'openai' \| 'anthropic' \| 'cohere' \| 'huggingface'` | No       | `'openai'`                                     | LLM input and output format and schema to use. Kong Gateway 3.14 only values: `'anthropic'`, `'cohere'`, `'huggingface'`. |
| `max_request_body_size`     | `number`                                                                        | No       | Kong 3.9: `8192`; Kong Gateway 3.14: `1048576` | max allowed body size allowed to be introspected                                                                          |
| `prompts`                   | `object`                                                                        | No       | —                                              | —                                                                                                                         |
| `prompts.append`            | `Array<object>`                                                                 | No       | —                                              | Insert chat messages at the end of the chat message array. This array preserves exact order when adding messages.         |
| `prompts.append[].content`  | `string`                                                                        | Yes      | —                                              | —                                                                                                                         |
| `prompts.append[].role`     | `'assistant' \| 'system' \| 'user'`                                             | No       | `'system'`                                     | —                                                                                                                         |
| `prompts.prepend`           | `Array<object>`                                                                 | No       | —                                              | Insert chat messages at the beginning of the chat message array. This array preserves exact order when adding messages.   |
| `prompts.prepend[].content` | `string`                                                                        | Yes      | —                                              | —                                                                                                                         |
| `prompts.prepend[].role`    | `'assistant' \| 'system' \| 'user'`                                             | No       | `'system'`                                     | —                                                                                                                         |
