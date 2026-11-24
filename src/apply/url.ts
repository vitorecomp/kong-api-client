import type { ServiceInput } from '../generated/entities.js';

/** Expanded Kong service fields derived from a shorthand `url`. */
export interface ExpandedServiceUrl {
  /** Scheme as written (unvalidated; Kong validates the protocol). */
  protocol: string;
  /** Hostname or IP literal as written (case kept, without userinfo or IPv6 brackets). */
  host: string;
  /** Port number (`443` for `https` and `wss`, `80` for every other scheme when omitted). */
  port: number;
  /** Raw path component up to `?` or `#`, or `null` when absent. */
  path: string | null;
}

const SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const DIGITS_RE = /^\d+$/;

/**
 * Splits a Kong service shorthand `url` into the `protocol`, `host`, `port`,
 * and `path` fields that Kong itself stores, or returns `undefined` when the
 * string cannot be split so the caller can pass `url` to Kong untouched.
 */
export function expandServiceUrl(url: string): ExpandedServiceUrl | undefined {
  const schemeSep = url.indexOf('://');
  if (schemeSep <= 0) {
    return undefined;
  }

  const protocol = url.slice(0, schemeSep);
  if (!SCHEME_RE.test(protocol)) {
    return undefined;
  }

  const afterScheme = url.slice(schemeSep + 3);
  const delimIdx = afterScheme.search(/[/?#]/);
  const rawAuthority = delimIdx === -1 ? afterScheme : afterScheme.slice(0, delimIdx);
  const rest = delimIdx === -1 ? '' : afterScheme.slice(delimIdx);

  const atIdx = rawAuthority.lastIndexOf('@');
  const hostPort = atIdx === -1 ? rawAuthority : rawAuthority.slice(atIdx + 1);
  if (hostPort.length === 0) {
    return undefined;
  }

  let host: string;
  let rawPort: string | undefined;

  if (hostPort.startsWith('[')) {
    const closeBracket = hostPort.indexOf(']');
    if (closeBracket <= 1) {
      return undefined;
    }
    host = hostPort.slice(1, closeBracket);
    const afterBracket = hostPort.slice(closeBracket + 1);
    if (afterBracket === '') {
      rawPort = undefined;
    } else if (afterBracket.startsWith(':')) {
      rawPort = afterBracket.slice(1);
    } else {
      return undefined;
    }
  } else {
    const colonIdx = hostPort.indexOf(':');
    if (colonIdx === -1) {
      host = hostPort;
      rawPort = undefined;
    } else {
      host = hostPort.slice(0, colonIdx);
      rawPort = hostPort.slice(colonIdx + 1);
    }
    if (host.length === 0) {
      return undefined;
    }
  }

  let port: number;
  if (rawPort !== undefined) {
    if (!DIGITS_RE.test(rawPort)) {
      return undefined;
    }
    port = Number(rawPort);
  } else {
    port = protocol === 'https' || protocol === 'wss' ? 443 : 80;
  }

  let path: string | null;
  if (rest.startsWith('/')) {
    const endIdx = rest.search(/[?#]/);
    path = endIdx === -1 ? rest : rest.slice(0, endIdx);
  } else {
    path = null;
  }

  return { protocol, host, port, path };
}

/**
 * Merges the four expanded URL fields on top of sibling fields so `url` wins,
 * matching Kong's own precedence. `protocol` is kept as an unvalidated string
 * rather than narrowed to the schema union so Kong itself validates the scheme.
 */
function mergeExpandedUrl<T extends ServiceInput>(
  rest: Omit<T, 'url'>,
  expanded: ExpandedServiceUrl,
): T {
  return {
    ...rest,
    protocol: expanded.protocol,
    host: expanded.host,
    port: expanded.port,
    path: expanded.path,
  } as T;
}

/**
 * Returns a copy of a service input with a splittable `url` expanded into
 * `protocol`, `host`, `port`, and `path` (with `url` removed and taking
 * precedence over those four sibling fields). An unsplittable `url` is left
 * untouched in the payload so Kong answers with its own error.
 */
export function expandServiceInput<T extends ServiceInput>(input: T): T {
  const { url, ...rest } = input;
  if (url === undefined) {
    return { ...input };
  }
  const expanded = expandServiceUrl(url);
  if (expanded === undefined) {
    return { ...input };
  }
  return mergeExpandedUrl<T>(rest, expanded);
}
