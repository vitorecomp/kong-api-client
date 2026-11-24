---
title: AI Prompt Guard
---

# AI Prompt Guard (`ai-prompt-guard`)

- **Category:** AI
- **Kong documentation:** [https://developer.konghq.com/plugins/ai-prompt-guard/](https://developer.konghq.com/plugins/ai-prompt-guard/)
- **Targets:** `kong-3.9`, `kong-gateway-3.14`
- **Scopes:** `global`, `service`, `route`, `consumer`
- **Protocols:** `grpc`, `grpcs`, `http`, `https`

## Example

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

await kong.plugins.enable('ai-prompt-guard', {
  on: { route: 'my-route' },
  config: { deny_patterns: ['ignore previous instructions'] },
});
```

## Configuration fields

| Field                            | Type                                                                                                                                                     | Required | Default                                        | Description                                                                                                               |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `allow_all_conversation_history` | `boolean`                                                                                                                                                | No       | `false`                                        | If true, will ignore all previous chat prompts from the conversation history.                                             |
| `allow_patterns`                 | `Array<string>`                                                                                                                                          | No       | —                                              | Array of valid regex patterns, or valid questions from the 'user' role in chat.                                           |
| `deny_patterns`                  | `Array<string>`                                                                                                                                          | No       | —                                              | Array of invalid regex patterns, or invalid questions from the 'user' role in chat.                                       |
| `llm_format`                     | `'bedrock' \| 'gemini' \| 'openai' \| 'anthropic' \| 'cohere' \| 'huggingface'`                                                                          | No       | `'openai'`                                     | LLM input and output format and schema to use. Kong Gateway 3.14 only values: `'anthropic'`, `'cohere'`, `'huggingface'`. |
| `match_all_roles`                | `boolean`                                                                                                                                                | No       | `false`                                        | If true, will match all roles in addition to 'user' role in conversation history.                                         |
| `max_request_body_size`          | `number`                                                                                                                                                 | No       | Kong 3.9: `8192`; Kong Gateway 3.14: `1048576` | max allowed body size allowed to be introspected                                                                          |
| `genai_category`                 | `'audio/speech' \| 'audio/transcription' \| 'image/generation' \| 'realtime/generation' \| 'text/embeddings' \| 'text/generation' \| 'video/generation'` | No       | `'text/generation'`                            | Kong Gateway 3.14 only.                                                                                                   |
