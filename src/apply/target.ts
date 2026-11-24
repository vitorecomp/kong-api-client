const HEX_GROUP_RE = /^[0-9a-fA-F]{1,4}$/;
const DIGITS_RE = /^\d+$/;
const OCTET_RE = /^\d{1,3}$/;

function expandIpv6(address: string): string | undefined {
  let working = address;
  if (working.includes('.')) {
    const lastColon = working.lastIndexOf(':');
    if (lastColon === -1) {
      return undefined;
    }
    const ipv4Part = working.slice(lastColon + 1);
    const octets = ipv4Part.split('.');
    if (octets.length !== 4) {
      return undefined;
    }
    const nums: number[] = [];
    for (const part of octets) {
      if (!OCTET_RE.test(part)) {
        return undefined;
      }
      const n = Number(part);
      if (n > 255) {
        return undefined;
      }
      nums.push(n);
    }
    const hi = ((nums[0]! << 8) | nums[1]!).toString(16);
    const lo = ((nums[2]! << 8) | nums[3]!).toString(16);
    working = `${working.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = working.split('::');
  if (halves.length > 2) {
    return undefined;
  }

  let groups: string[];
  if (halves.length === 2) {
    const left = halves[0] === '' ? [] : halves[0]!.split(':');
    const right = halves[1] === '' ? [] : halves[1]!.split(':');
    const missing = 8 - (left.length + right.length);
    if (missing < 1) {
      return undefined;
    }
    groups = [...left, ...Array<string>(missing).fill('0'), ...right];
  } else {
    groups = working.split(':');
    if (groups.length !== 8) {
      return undefined;
    }
  }

  const normalized: string[] = [];
  for (const group of groups) {
    if (!HEX_GROUP_RE.test(group)) {
      return undefined;
    }
    normalized.push(group.toLowerCase().padStart(4, '0'));
  }
  return normalized.join(':');
}

/**
 * Normalizes a Kong upstream target address to the canonical form Kong stores:
 * - adds default port `:8000` when omitted;
 * - formats ports as plain decimal numbers (e.g. `localhost:0080` -> `localhost:80`);
 * - expands IPv6 literals to eight 4-digit lower-case hex groups inside brackets;
 * - preserves host case otherwise, returning unparseable inputs untouched for Kong to validate.
 */
export function normalizeTargetAddress(raw: string): string {
  if (raw.startsWith('[')) {
    const close = raw.indexOf(']');
    if (close === -1) {
      return raw;
    }
    const inner = raw.slice(1, close);
    const rest = raw.slice(close + 1);
    let port = 8000;
    if (rest !== '') {
      if (!rest.startsWith(':')) {
        return raw;
      }
      const portStr = rest.slice(1);
      if (!DIGITS_RE.test(portStr)) {
        return raw;
      }
      port = Number(portStr);
    }
    const expanded = expandIpv6(inner);
    return expanded !== undefined ? `[${expanded}]:${port}` : raw;
  }

  const firstColon = raw.indexOf(':');
  const lastColon = raw.lastIndexOf(':');
  if (firstColon !== lastColon) {
    const expanded = expandIpv6(raw);
    return expanded !== undefined ? `[${expanded}]:8000` : raw;
  }

  if (firstColon === -1) {
    return raw.length === 0 ? raw : `${raw}:8000`;
  }

  const host = raw.slice(0, firstColon);
  const portStr = raw.slice(firstColon + 1);
  if (host.length === 0 || !DIGITS_RE.test(portStr)) {
    return raw;
  }
  return `${host}:${Number(portStr)}`;
}
