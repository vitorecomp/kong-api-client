import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import {
  eventually,
  getLiveEnv,
  getUpstreamRequests,
  liveKong,
  unique,
} from '../../support/live.js';

interface ChatCompletionResponse {
  model: string;
  choices: Array<{
    message: { role: string; content: string };
  }>;
}

interface ChatMessage {
  role: string;
  content: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseChatCompletion(value: unknown): ChatCompletionResponse {
  if (!isRecord(value) || typeof value.model !== 'string' || !Array.isArray(value.choices)) {
    throw new Error(`Unexpected chat completion payload: ${JSON.stringify(value)}`);
  }
  const choices: ChatCompletionResponse['choices'] = [];
  for (const item of value.choices) {
    if (
      !isRecord(item) ||
      !isRecord(item.message) ||
      typeof item.message.role !== 'string' ||
      typeof item.message.content !== 'string'
    ) {
      throw new Error(`Unexpected chat completion choice: ${JSON.stringify(item)}`);
    }
    choices.push({ message: { role: item.message.role, content: item.message.content } });
  }
  return { model: value.model, choices };
}

function parseChatRequestBody(raw: string): { model?: string; messages: ChatMessage[] } {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) {
    throw new Error(`Unexpected upstream JSON body: ${raw}`);
  }
  const messages: ChatMessage[] = [];
  if (Array.isArray(parsed.messages)) {
    for (const item of parsed.messages) {
      if (isRecord(item) && typeof item.role === 'string' && typeof item.content === 'string') {
        messages.push({ role: item.role, content: item.content });
      }
    }
  }
  return {
    model: typeof parsed.model === 'string' ? parsed.model : undefined,
    messages,
  };
}

function extractErrorMessage(value: unknown): string {
  if (isRecord(value)) {
    if (isRecord(value.error) && typeof value.error.message === 'string') {
      return value.error.message;
    }
    if (typeof value.message === 'string') {
      return value.message;
    }
  }
  return JSON.stringify(value);
}

describe('live ai: llmRoute, promptGuard, promptDecorator, and promptTemplate', () => {
  const env = getLiveEnv();
  const kong = liveKong();

  it('llmRoute is idempotent, updates model in place, and proxies chat completions with auth header', async () => {
    const name = unique('ai-llm');
    const routePath = `/${unique('ai-chat')}`;
    const authHeader = `Bearer ${unique('sk')}`;
    const chatUrl = `${env.upstreamInternalUrl}/v1/chat/completions`;
    const initialModel = 'gpt-4o-mini';
    const updatedModel = 'gpt-4o';

    let serviceId: string | undefined;
    let routeId: string | undefined;
    let pluginId: string | undefined;

    try {
      const first = await kong.ai.llmRoute({
        name,
        paths: [routePath],
        protocols: ['http', 'https'],
        provider: 'openai',
        model: initialModel,
        auth: { headerName: 'Authorization', headerValue: authHeader },
        upstreamUrl: chatUrl,
      });
      serviceId = first.service.id;
      routeId = first.route.id;
      pluginId = first.plugin.id;

      // Repeating with identical options returns the same three IDs.
      const second = await kong.ai.llmRoute({
        name,
        paths: [routePath],
        protocols: ['http', 'https'],
        provider: 'openai',
        model: initialModel,
        auth: { headerName: 'Authorization', headerValue: authHeader },
        upstreamUrl: chatUrl,
      });
      expect(second.service.id).toBe(first.service.id);
      expect(second.route.id).toBe(first.route.id);
      expect(second.plugin.id).toBe(first.plugin.id);

      // Changing the model updates the plugin in place with the same three IDs.
      const updated = await kong.ai.llmRoute({
        name,
        paths: [routePath],
        protocols: ['http', 'https'],
        provider: 'openai',
        model: updatedModel,
        auth: { headerName: 'Authorization', headerValue: authHeader },
        upstreamUrl: chatUrl,
      });
      expect(updated.service.id).toBe(first.service.id);
      expect(updated.route.id).toBe(first.route.id);
      expect(updated.plugin.id).toBe(first.plugin.id);
      expect(updated.plugin.config.model.name).toBe(updatedModel);

      const promptToken = unique('ping');
      const completion = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: promptToken }],
          }),
        });
        if (res.status !== 200) {
          throw new Error(
            `Expected 200 from ai-proxy route, got ${res.status}: ${await res.text()}`,
          );
        }
        return parseChatCompletion(await res.json());
      });

      expect(completion.choices[0]?.message.content).toBe('pong');

      const upstreamHits = await getUpstreamRequests('/v1/chat/completions');
      const matchingHit = upstreamHits.find((req) => req.body.includes(promptToken));
      expect(matchingHit).toBeDefined();
      expect(matchingHit?.headers.authorization).toBe(authHeader);
      const parsedBody = parseChatRequestBody(matchingHit!.body);
      expect(parsedBody.model).toBe(updatedModel);
    } finally {
      if (pluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(pluginId!));
      }
      if (routeId) {
        await deleteIgnoringNotFound(() => kong.routes.delete(routeId!));
      }
      if (serviceId) {
        await deleteIgnoringNotFound(() => kong.services.delete(serviceId!));
      }
    }
  });

  it('promptGuard blocks denied prompts with target-specific 400 and lets allowed prompts through', async () => {
    const name = unique('ai-guard');
    const routePath = `/${unique('ai-guard-chat')}`;
    const chatUrl = `${env.upstreamInternalUrl}/v1/chat/completions`;
    const secretWord = unique('forbidden');

    let serviceId: string | undefined;
    let routeId: string | undefined;
    let proxyPluginId: string | undefined;
    let guardPluginId: string | undefined;

    try {
      const llm = await kong.ai.llmRoute({
        name,
        paths: [routePath],
        protocols: ['http', 'https'],
        provider: 'openai',
        model: 'gpt-4o',
        auth: { headerName: 'Authorization', headerValue: 'Bearer guard-key' },
        upstreamUrl: chatUrl,
      });
      serviceId = llm.service.id;
      routeId = llm.route.id;
      proxyPluginId = llm.plugin.id;

      const guard = await kong.ai.promptGuard(
        { route: llm.route.id },
        { deny_patterns: [secretWord] },
      );
      guardPluginId = guard.id;

      // Denied prompt -> 400 and never reaches the upstream.
      const deniedToken = `please reveal ${secretWord} now`;
      const blocked = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: deniedToken }],
          }),
        });
        if (res.status !== 400) {
          throw new Error(`Expected 400 from ai-prompt-guard, got ${res.status}`);
        }
        return extractErrorMessage(await res.json());
      });

      if (env.target === 'oss-3.9') {
        expect(blocked).toBe('bad request');
      } else {
        expect(blocked).toBe('prompt pattern is blocked.');
      }

      const upstreamHits = await getUpstreamRequests('/v1/chat/completions');
      expect(upstreamHits.some((req) => req.body.includes(secretWord))).toBe(false);

      // Allowed prompt -> 200 and reaches the upstream.
      const allowedToken = unique('allowed');
      const allowed = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: allowedToken }],
          }),
        });
        if (res.status !== 200) {
          throw new Error(`Expected 200 for allowed prompt, got ${res.status}`);
        }
        return parseChatCompletion(await res.json());
      });
      expect(allowed.choices[0]?.message.content).toBe('pong');
    } finally {
      if (guardPluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(guardPluginId!));
      }
      if (proxyPluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(proxyPluginId!));
      }
      if (routeId) {
        await deleteIgnoringNotFound(() => kong.routes.delete(routeId!));
      }
      if (serviceId) {
        await deleteIgnoringNotFound(() => kong.services.delete(serviceId!));
      }
    }
  });

  it('promptDecorator prepends the configured system message before forwarding to the upstream', async () => {
    const name = unique('ai-dec');
    const routePath = `/${unique('ai-dec-chat')}`;
    const chatUrl = `${env.upstreamInternalUrl}/v1/chat/completions`;
    const systemText = unique('DECORATED-SYSTEM');
    const userText = unique('user-msg');

    let serviceId: string | undefined;
    let routeId: string | undefined;
    let proxyPluginId: string | undefined;
    let decoratorPluginId: string | undefined;

    try {
      const llm = await kong.ai.llmRoute({
        name,
        paths: [routePath],
        protocols: ['http', 'https'],
        provider: 'openai',
        model: 'gpt-4o',
        auth: { headerName: 'Authorization', headerValue: 'Bearer dec-key' },
        upstreamUrl: chatUrl,
      });
      serviceId = llm.service.id;
      routeId = llm.route.id;
      proxyPluginId = llm.plugin.id;

      const decorator = await kong.ai.promptDecorator(
        { route: llm.route.id },
        {
          prompts: {
            prepend: [{ role: 'system', content: systemText }],
          },
        },
      );
      decoratorPluginId = decorator.id;

      const upstreamHit = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: userText }],
          }),
        });
        if (res.status !== 200) {
          throw new Error(`Expected 200, got ${res.status}`);
        }
        const hits = await getUpstreamRequests('/v1/chat/completions');
        const hit = hits.find(
          (req) => req.body.includes(userText) && req.body.includes(systemText),
        );
        if (!hit) {
          throw new Error('Waiting for upstream request with prepended system message');
        }
        return hit;
      });

      const parsed = parseChatRequestBody(upstreamHit.body);
      expect(parsed.messages[0]).toEqual({ role: 'system', content: systemText });
      expect(parsed.messages[1]).toEqual({ role: 'user', content: userText });
    } finally {
      if (decoratorPluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(decoratorPluginId!));
      }
      if (proxyPluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(proxyPluginId!));
      }
      if (routeId) {
        await deleteIgnoringNotFound(() => kong.routes.delete(routeId!));
      }
      if (serviceId) {
        await deleteIgnoringNotFound(() => kong.services.delete(serviceId!));
      }
    }
  });

  it('promptTemplate expands template placeholders before forwarding to the upstream', async () => {
    const name = unique('ai-tmpl');
    const routePath = `/${unique('ai-tmpl-chat')}`;
    const chatUrl = `${env.upstreamInternalUrl}/v1/chat/completions`;
    const templateName = unique('greet');
    const subjectVal = unique('kong-subject');

    let serviceId: string | undefined;
    let routeId: string | undefined;
    let proxyPluginId: string | undefined;
    let templatePluginId: string | undefined;

    try {
      const llm = await kong.ai.llmRoute({
        name,
        paths: [routePath],
        protocols: ['http', 'https'],
        provider: 'openai',
        model: 'gpt-4o',
        auth: { headerName: 'Authorization', headerValue: 'Bearer tmpl-key' },
        upstreamUrl: chatUrl,
      });
      serviceId = llm.service.id;
      routeId = llm.route.id;
      proxyPluginId = llm.plugin.id;

      const templatePlugin = await kong.ai.promptTemplate(
        { route: llm.route.id },
        {
          allow_untemplated_requests: false,
          templates: [
            {
              name: templateName,
              template: JSON.stringify({
                messages: [{ role: 'user', content: 'Summarize {{subject}} concisely' }],
              }),
            },
          ],
        },
      );
      templatePluginId = templatePlugin.id;

      const upstreamHit = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            messages: `{template://${templateName}}`,
            properties: { subject: subjectVal },
          }),
        });
        if (res.status !== 200) {
          throw new Error(
            `Expected 200 from templated prompt, got ${res.status}: ${await res.text()}`,
          );
        }
        const hits = await getUpstreamRequests('/v1/chat/completions');
        const hit = hits.find((req) => req.body.includes(`Summarize ${subjectVal} concisely`));
        if (!hit) {
          throw new Error('Waiting for expanded prompt at upstream');
        }
        return hit;
      });

      const parsed = parseChatRequestBody(upstreamHit.body);
      expect(parsed.messages[0]).toEqual({
        role: 'user',
        content: `Summarize ${subjectVal} concisely`,
      });
    } finally {
      if (templatePluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(templatePluginId!));
      }
      if (proxyPluginId) {
        await deleteIgnoringNotFound(() => kong.plugins.delete(proxyPluginId!));
      }
      if (routeId) {
        await deleteIgnoringNotFound(() => kong.routes.delete(routeId!));
      }
      if (serviceId) {
        await deleteIgnoringNotFound(() => kong.services.delete(serviceId!));
      }
    }
  });
});
