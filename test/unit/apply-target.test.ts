import { describe, expect, it } from 'vitest';
import { normalizeTargetAddress } from '../../src/apply/target.js';

describe('normalizeTargetAddress', () => {
  it.each([
    { input: '10.0.0.5', expected: '10.0.0.5:8000' },
    { input: '10.0.0.5:8080', expected: '10.0.0.5:8080' },
    { input: 'example.com', expected: 'example.com:8000' },
    { input: 'Example.COM', expected: 'Example.COM:8000' },
    { input: 'localhost:0080', expected: 'localhost:80' },
    { input: '::1', expected: '[0000:0000:0000:0000:0000:0000:0000:0001]:8000' },
    { input: '[::1]', expected: '[0000:0000:0000:0000:0000:0000:0000:0001]:8000' },
    { input: '::', expected: '[0000:0000:0000:0000:0000:0000:0000:0000]:8000' },
    { input: '[2001:DB8::1]:81', expected: '[2001:0db8:0000:0000:0000:0000:0000:0001]:81' },
    { input: '[2001:DB8::1]:0081', expected: '[2001:0db8:0000:0000:0000:0000:0000:0001]:81' },
    {
      input: '[2001:0db8:0000:0000:0000:0000:0000:0001]:81',
      expected: '[2001:0db8:0000:0000:0000:0000:0000:0001]:81',
    },
    { input: '::ffff:192.0.2.1', expected: '[0000:0000:0000:0000:0000:ffff:c000:0201]:8000' },
    {
      input: '[::ffff:192.0.2.1]:9000',
      expected: '[0000:0000:0000:0000:0000:ffff:c000:0201]:9000',
    },
  ])('normalizes $input to $expected', ({ input, expected }) => {
    expect(normalizeTargetAddress(input)).toBe(expected);
  });

  it.each([
    '',
    '[::1',
    '[::1]extra',
    '[::1]:abc',
    '[1::2::3]:80',
    '[1:2:3:4:5:6:7]:80',
    '[1:2:3:4:5:6:7:8::]:80',
    '[zzzz::1]:80',
    '[192.0.2.1]:80',
    '[::ffff:192.0.2]:80',
    '[::ffff:192.0.2.abc]:80',
    '[::ffff:192.0.2.999]:80',
    '1::2::3',
    ':8080',
    'host:abc',
  ])('leaves unparseable address %s untouched for Kong to validate', (input) => {
    expect(normalizeTargetAddress(input)).toBe(input);
  });
});
