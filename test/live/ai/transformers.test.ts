import { describe, expect, it } from 'vitest';
import { deleteIgnoringNotFound } from '../../support/crud.js';
import {
  eventually,
  getLiveEnv,
  getUpstreamRequests,
  liveKong,
  unique,
} from '../../support/live.js';

interface EchoBody {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}

function parseEchoBody(value: unknown): EchoBody {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('method' in value) ||
    typeof value.method !== 'string' ||
    !('path' in value) ||
    typeof value.path !== 'string' ||
    !('body' in value) ||
    typeof value.body !== 'string' ||
    !('headers' in value) ||
    typeof value.headers !== 'object' ||
    value.headers === null
  ) {
    throw new Error(`Unexpected /echo payload: ${JSON.stringify(value)}`);
  }
  const headers: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of Object.entries(value.headers)) {
    if (typeof v === 'string') {
      headers[k] = v;
    } else if (Array.isArray(v) && v.every((entry) => typeof entry === 'string')) {
      headers[k] = v;
    }
  }
  return { method: value.method, path: value.path, headers, body: value.body };
}

describe('live ai: requestTransformer and responseTransformer', () => {
  const env = getLiveEnv();
  const kong = liveKong();

  it('requestTransformer calls the LLM with the configured prompt and replaces the upstream request body', async () => {
    const serviceName = unique('ai-reqtx-svc');
    const routeName = unique('ai-reqtx-rt');
    const routePath = `/${unique('ai-reqtx')}`;
    const probe = unique('req');
    const instruction = `Rewrite request ${unique('instr')}`;
    const authHeader = `Bearer ${unique('reqtx-key')}`;

    let serviceId: string | undefined;
    let routeId: string | undefined;
    let pluginId: string | undefined;

    try {
      const service = await kong.services.create({
        name: serviceName,
        url: `${env.upstreamInternalUrl}/echo`,
      });
      serviceId = service.id;

      const route = await kong.services.routes(service.id).create({
        name: routeName,
        paths: [routePath],
        protocols: ['http', 'https'],
      });
      routeId = route.id;

      // Baseline: original request body reaches /echo unchanged.
      const before = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`, {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'original-request-body',
        });
        if (res.status !== 200) {
          throw new Error(`Expected baseline 200, got ${res.status}`);
        }
        return parseEchoBody(await res.json());
      });
      expect(before.body).toBe('original-request-body');

      const plugin = await kong.ai.requestTransformer(
        { route: route.id },
        {
          prompt: instruction,
          llm: {
            route_type: 'llm/v1/chat',
            auth: { header_name: 'Authorization', header_value: authHeader },
            model: {
              provider: 'openai',
              name: 'gpt-4o',
              options: { upstream_url: `${env.upstreamInternalUrl}/v1/chat/completions` },
            },
          },
        },
      );
      pluginId = plugin.id;

      // With ai-request-transformer active, the fake model's 'pong' replaces the request body.
      const after = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`, {
          method: 'POST',
          headers: { 'content-type': 'text/plain' },
          body: 'original-request-body',
        });
        if (res.status !== 200) {
          throw new Error(`Expected 200, got ${res.status}: ${await res.text()}`);
        }
        const body = parseEchoBody(await res.json());
        if (body.body !== 'pong') {
          throw new Error(`Waiting for transformed body 'pong', got ${JSON.stringify(body.body)}`);
        }
        return body;
      });
      expect(after.body).toBe('pong');

      const llmCalls = await getUpstreamRequests('/v1/chat/completions');
      const matchedCall = llmCalls.find((req) => req.body.includes(instruction));
      expect(matchedCall).toBeDefined();
      expect(matchedCall?.headers.authorization).toBe(authHeader);
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

  it('responseTransformer calls the LLM with the configured prompt and replaces the client response body', async () => {
    const serviceName = unique('ai-restx-svc');
    const routeName = unique('ai-restx-rt');
    const routePath = `/${unique('ai-restx')}`;
    const probe = unique('res');
    const instruction = `Transform response ${unique('instr')}`;
    const authHeader = `Bearer ${unique('restx-key')}`;

    let serviceId: string | undefined;
    let routeId: string | undefined;
    let pluginId: string | undefined;

    try {
      const service = await kong.services.create({
        name: serviceName,
        url: `${env.upstreamInternalUrl}/echo`,
      });
      serviceId = service.id;

      const route = await kong.services.routes(service.id).create({
        name: routeName,
        paths: [routePath],
        protocols: ['http', 'https'],
      });
      routeId = route.id;

      // Baseline: client receives the raw /echo JSON.
      const before = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected baseline 200, got ${res.status}`);
        }
        return parseEchoBody(await res.json());
      });
      expect(before.path).toBe(`/echo/${probe}`);

      const plugin = await kong.ai.responseTransformer(
        { route: route.id },
        {
          prompt: instruction,
          llm: {
            route_type: 'llm/v1/chat',
            auth: { header_name: 'Authorization', header_value: authHeader },
            model: {
              provider: 'openai',
              name: 'gpt-4o',
              options: { upstream_url: `${env.upstreamInternalUrl}/v1/chat/completions` },
            },
          },
        },
      );
      pluginId = plugin.id;

      // With ai-response-transformer active, the fake model's 'pong' replaces the response body.
      const transformedBody = await eventually(async () => {
        const res = await fetch(`${env.proxyUrl}${routePath}/${probe}`);
        if (res.status !== 200) {
          throw new Error(`Expected 200, got ${res.status}`);
        }
        const text = await res.text();
        if (text !== 'pong') {
          throw new Error(`Waiting for transformed response 'pong', got ${JSON.stringify(text)}`);
        }
        return text;
      });
      expect(transformedBody).toBe('pong');

      const llmCalls = await getUpstreamRequests('/v1/chat/completions');
      const matchedCall = llmCalls.find((req) => req.body.includes(instruction));
      expect(matchedCall).toBeDefined();
      expect(matchedCall?.headers.authorization).toBe(authHeader);
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
});
