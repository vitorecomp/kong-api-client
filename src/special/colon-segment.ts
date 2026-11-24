import { segment } from '../transport.js';

/**
 * Encodes a single path segment while keeping literal colons (`:`), which are valid
 * RFC 3986 path characters (`pchar`) required unencoded by Kong endpoints whose handlers
 * do not percent-decode the path parameter (`/cache/{key}` and target health `{address}`).
 */
export function colonSegment(value: string): string {
  return segment(value).replace(/%3A/gi, ':');
}
