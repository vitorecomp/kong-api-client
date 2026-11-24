---
title: AI Gateway
group: Guides
---

# AI Gateway

`kong.ai` provides high-level TypeScript helpers for Kong's six bundled AI Gateway plugins: a single-call `llmRoute()` helper that wires up a service, route, and `ai-proxy` plugin together, plus one typed helper per AI plugin.

| Method                                              | Plugin                                                               | Supported scopes                         |
| --------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------- |
| `kong.ai.llmRoute(options)`                         | Service + route + [`ai-proxy`](./plugins/ai/ai-proxy.md)             | Route created by `llmRoute`              |
| `kong.ai.proxy(on, config, options?)`               | [`ai-proxy`](./plugins/ai/ai-proxy.md)                               | `global`, `service`, `route`, `consumer` |
| `kong.ai.promptGuard(on, config, options?)`         | [`ai-prompt-guard`](./plugins/ai/ai-prompt-guard.md)                 | `global`, `service`, `route`, `consumer` |
| `kong.ai.promptDecorator(on, config, options?)`     | [`ai-prompt-decorator`](./plugins/ai/ai-prompt-decorator.md)         | `global`, `service`, `route`, `consumer` |
| `kong.ai.promptTemplate(on, config, options?)`      | [`ai-prompt-template`](./plugins/ai/ai-prompt-template.md)           | `global`, `service`, `route`, `consumer` |
| `kong.ai.requestTransformer(on, config, options?)`  | [`ai-request-transformer`](./plugins/ai/ai-request-transformer.md)   | `global`, `service`, `route`             |
| `kong.ai.responseTransformer(on, config, options?)` | [`ai-response-transformer`](./plugins/ai/ai-response-transformer.md) | `global`, `service`, `route`, `consumer` |

All six AI plugins are present on both Kong 3.9 and Kong Gateway 3.14 (without a license). Note that Kong does not allow `consumer` scope on `ai-request-transformer`.

## Single-call LLM routes (`kong.ai.llmRoute`)

`kong.ai.llmRoute()` creates or updates three Kong entities in sequence, all sharing `options.name`:

1. **Service** (`PUT /services/{name}`) with `url: options.serviceUrl ?? 'http://localhost:32000'` and optional `tags`.
2. **Route** (`PUT /routes/{name}`) pointing to that service with `paths` and optional `hosts`, `methods`, `protocols`, and `tags`.
3. **`ai-proxy` plugin** (`PUT /plugins/{name}`) bound to `{ route: route.id }` with `instanceName: options.name`, the derived `AiProxyConfig`, and optional `tags`.

It returns `{ service, route, plugin }`.

### Full replacement on every call

Because `llmRoute()` upserts (`PUT`) the service, the route, and the `ai-proxy` plugin on every call, it is safe to call repeatedly with the same `name`:

- The three entities keep their IDs and are updated in place (for example switching `model` from `'gpt-4o-mini'` to `'gpt-4o'`).
- Every call replaces all three entities, so optional fields you omit on a later call (such as `tags`, `hosts`, `methods`, `protocols`, or extra `config` fields) reset to Kong's defaults.
- `protocols` is passed through to Kong untouched when provided. Remember that Kong 3.9 defaults route `protocols` to `['http', 'https']` whereas Kong Gateway 3.14 defaults to `['https']` — pass `protocols: ['http', 'https']` explicitly when the route should serve plain HTTP proxy traffic on both targets.

### Dummy service URL

Kong requires every route to belong to a service, even though `ai-proxy` intercepts the request and sends it directly to the AI provider instead of proxying to the service upstream. `llmRoute()` therefore points the service at `'http://localhost:32000'` by default; nothing needs to listen on port 32000. Pass `serviceUrl` if you want a different placeholder URL.

### Authentication, `upstreamUrl`, and extra `ai-proxy` options

- **Header auth:** pass `auth: { headerName, headerValue }`, which maps to `config.auth = { header_name, header_value }`.
- **Parameter auth:** pass `auth: { paramName, paramValue, paramLocation: 'query' | 'body' }`, which maps to `config.auth = { param_name, param_value, param_location }`.
- **Custom endpoint (`upstreamUrl`):** maps to `config.model.options.upstream_url` — useful for self-hosted OpenAI-compatible servers, Azure OpenAI deployments, internal LLM gateways, or local test stubs.
- **Provider and route type:** `provider` (`AiProvider`) and `routeType` (`AiRouteType`, default `'llm/v1/chat'`) are derived directly from `AiProxyConfig`. Some providers and route types exist only on Kong Gateway 3.14; see the [`ai-proxy` reference](./plugins/ai/ai-proxy.md) for the full list.
- **Additional config (`config`):** any extra `Partial<AiProxyConfig>` fields are merged last so they override derived defaults (nested `model`, `model.options`, and `auth` merge with derived values, and explicit `null` for `config.auth` or `config.model.options` clears them).
- **Tags and cancellation:** `tags` is applied to all three entities, and `signal` (`AbortSignal`) is forwarded to all three Admin API requests.

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

// Header authentication + custom upstream endpoint
const chat = await kong.ai.llmRoute({
  name: 'assistant-chat',
  paths: ['/v1/chat'],
  protocols: ['http', 'https'],
  provider: 'openai',
  model: 'gpt-4o-mini',
  auth: {
    headerName: 'Authorization',
    headerValue: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
  },
  upstreamUrl: 'https://api.openai.com/v1/chat/completions',
  tags: ['ai', 'chat'],
  config: {
    logging: { log_statistics: true },
    model: {
      provider: 'openai',
      options: { temperature: 0.2 },
    },
  },
});

// Calling again with the same `name` replaces the three entities in place with the same IDs
const upgraded = await kong.ai.llmRoute({
  name: 'assistant-chat',
  paths: ['/v1/chat'],
  protocols: ['http', 'https'],
  provider: 'openai',
  model: 'gpt-4o',
  auth: {
    headerName: 'Authorization',
    headerValue: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
  },
  upstreamUrl: 'https://api.openai.com/v1/chat/completions',
  tags: ['ai', 'chat'],
});

// Query/body parameter authentication
const gemini = await kong.ai.llmRoute({
  name: 'gemini-chat',
  paths: ['/v1/gemini'],
  protocols: ['http', 'https'],
  provider: 'gemini',
  model: 'gemini-2.0-flash',
  auth: {
    paramName: 'key',
    paramValue: process.env.GEMINI_API_KEY ?? '',
    paramLocation: 'query',
  },
});

console.log(
  chat.route.id === upgraded.route.id,
  upgraded.plugin.config.model.name,
  gemini.service.id,
);
```

## Single-plugin AI helpers

The six single-plugin methods share the signature `(on: AiTarget, config: <PluginConfig>, options?: CallOptions)`:

- `on` is a `PluginScope` (`{ route }`, `{ service }`, `{ consumer }`, or a combination, each accepting a UUID or name/username), or `undefined` to attach the plugin globally.
- Each helper calls `kong.plugins.enable(pluginName, { on, config, signal: options?.signal })`, so repeat calls are idempotent and adopt an existing plugin of the same name on that scope. If you need a custom `instanceName`, `tags`, `enabled`, or `protocols`, call `kong.plugins.enable()` directly.

### `ai-proxy` (`kong.ai.proxy`)

Attach `ai-proxy` directly to an existing route, service, or consumer (or globally) when you manage the service and route yourself instead of using `llmRoute()`:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const proxyPlugin = await kong.ai.proxy(
  { route: 'existing-chat-route' },
  {
    route_type: 'llm/v1/chat',
    model: {
      provider: 'openai',
      name: 'gpt-4o-mini',
    },
    auth: {
      header_name: 'Authorization',
      header_value: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
    },
  },
);

console.log(proxyPlugin.id, proxyPlugin.config.model.name);
```

### `ai-prompt-guard` (`kong.ai.promptGuard`)

Block requests matching `deny_patterns` (or restrict them to `allow_patterns`) before they reach the upstream LLM:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const guard = await kong.ai.promptGuard(
  { route: 'assistant-chat' },
  {
    deny_patterns: ['ignore previous instructions', 'system prompt'],
    allow_all_conversation_history: false,
  },
);

console.log(guard.id);
```

> [!NOTE]
> When `ai-prompt-guard` blocks a prompt, both Kong targets answer with HTTP `400` and never forward the request to the upstream model, but the response error message differs between versions:
>
> - **Kong 3.9:** `'bad request'`
> - **Kong Gateway 3.14:** `'prompt pattern is blocked.'`
>
> Check the HTTP `400` status code rather than matching a single message string if your code runs against both versions.

### `ai-prompt-decorator` (`kong.ai.promptDecorator`)

Prepend or append fixed chat messages (such as a system instruction) before forwarding the prompt to the upstream LLM:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const decorator = await kong.ai.promptDecorator(
  { route: 'assistant-chat' },
  {
    prompts: {
      prepend: [{ role: 'system', content: 'Answer concisely and never fabricate citations.' }],
    },
  },
);

console.log(decorator.id);
```

### `ai-prompt-template` (`kong.ai.promptTemplate`)

Register named prompt templates with `{{placeholder}}` variables. Clients send `{ messages: "{template://<name>}", properties: { ... } }` and Kong expands the template before forwarding to the upstream model. Set `allow_untemplated_requests: false` to reject raw untemplated prompts:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const templatePlugin = await kong.ai.promptTemplate(
  { route: 'assistant-chat' },
  {
    allow_untemplated_requests: false,
    templates: [
      {
        name: 'summarize',
        template: JSON.stringify({
          messages: [{ role: 'user', content: 'Summarize {{subject}} concisely.' }],
        }),
      },
    ],
  },
);

console.log(templatePlugin.id);
```

### `ai-request-transformer` and `ai-response-transformer`

Use `kong.ai.requestTransformer()` and `kong.ai.responseTransformer()` on regular (non-LLM) routes to have Kong call an LLM to rewrite the incoming request body before forwarding to your upstream service, or to transform the upstream response body before returning it to the client:

```ts
import { Kong } from 'kong-api-client';

const kong = new Kong({ adminUrl: 'http://localhost:8001' });

const llm = {
  route_type: 'llm/v1/chat' as const,
  auth: {
    header_name: 'Authorization',
    header_value: `Bearer ${process.env.OPENAI_API_KEY ?? ''}`,
  },
  model: {
    provider: 'openai' as const,
    name: 'gpt-4o-mini',
    options: {
      upstream_url: 'https://api.openai.com/v1/chat/completions',
    },
  },
};

const reqTx = await kong.ai.requestTransformer(
  { route: 'legacy-api' },
  {
    prompt: 'Convert the incoming JSON payload to snake_case and return only JSON.',
    llm,
  },
);

const resTx = await kong.ai.responseTransformer(
  { route: 'legacy-api' },
  {
    prompt: 'Summarize the upstream JSON response in one plain-text sentence.',
    llm,
  },
);

console.log(reqTx.id, resTx.id);
```

## Plugin reference pages

- [AI Proxy (`ai-proxy`)](./plugins/ai/ai-proxy.md)
- [AI Prompt Guard (`ai-prompt-guard`)](./plugins/ai/ai-prompt-guard.md)
- [AI Prompt Decorator (`ai-prompt-decorator`)](./plugins/ai/ai-prompt-decorator.md)
- [AI Prompt Template (`ai-prompt-template`)](./plugins/ai/ai-prompt-template.md)
- [AI Request Transformer (`ai-request-transformer`)](./plugins/ai/ai-request-transformer.md)
- [AI Response Transformer (`ai-response-transformer`)](./plugins/ai/ai-response-transformer.md)
