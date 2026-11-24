import http from 'node:http';

const PORT = 8080;

/** @type {Array<{ method: string; path: string; query: string; headers: http.IncomingHttpHeaders; body: string; receivedAt: string }>} */
const recorded = [];

/**
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {unknown} payload
 */
function sendJson(res, status, payload) {
  const text = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

/**
 * @param {http.IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/**
 * @param {string} raw
 * @returns {Record<string, unknown> | undefined}
 */
function parseJsonObject(raw) {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Non-JSON payload; ignore.
  }
  return undefined;
}

const server = http.createServer((req, res) => {
  void (async () => {
    const method = req.method ?? 'GET';
    const url = new URL(req.url ?? '/', 'http://upstream');
    const path = url.pathname;

    if (method === 'GET' && path === '/__health') {
      sendJson(res, 200, { status: 'ok' });
      return;
    }

    if (method === 'GET' && path === '/__requests') {
      const prefix = url.searchParams.get('path') ?? '';
      const matches = prefix ? recorded.filter((r) => r.path.startsWith(prefix)) : recorded;
      sendJson(res, 200, matches);
      return;
    }

    if (method === 'DELETE' && path === '/__requests') {
      recorded.length = 0;
      res.writeHead(204);
      res.end();
      return;
    }

    const body = await readBody(req);
    const entry = {
      method,
      path,
      query: url.search,
      headers: req.headers,
      body,
      receivedAt: new Date().toISOString(),
    };
    recorded.push(entry);

    if (method === 'POST' && path === '/v1/chat/completions') {
      const parsed = parseJsonObject(body);
      const model = typeof parsed?.model === 'string' ? parsed.model : 'gpt-4o';
      sendJson(res, 200, {
        id: 'chatcmpl-fake-1',
        object: 'chat.completion',
        created: 1,
        model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'pong' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
      return;
    }

    if (method === 'POST' && path === '/v1/completions') {
      const parsed = parseJsonObject(body);
      const model = typeof parsed?.model === 'string' ? parsed.model : 'gpt-3.5-turbo-instruct';
      sendJson(res, 200, {
        id: 'cmpl-fake-1',
        object: 'text_completion',
        created: 1,
        model,
        choices: [
          {
            index: 0,
            text: 'pong',
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
      return;
    }

    if (path === '/echo' || path.startsWith('/echo/')) {
      sendJson(res, 200, {
        method,
        path,
        headers: req.headers,
        body,
      });
      return;
    }

    if (method === 'POST' && path === '/collect') {
      sendJson(res, 200, { ok: true });
      return;
    }

    sendJson(res, 404, { error: 'not found', path });
  })().catch((err) => {
    console.error(err);
    if (!res.headersSent) {
      sendJson(res, 500, { error: 'internal error' });
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`fake-upstream listening on :${PORT}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
