import { describe, expect, it } from 'vitest';

import { normalizeDomain, normalizeEmail } from 'src/lib/identity';

describe('normalizeDomain (same cases as the Go backend)', () => {
  it.each([
    ['https://www.acme.ai/about', 'acme.ai'],
    ['www.acme.ai', 'acme.ai'],
    ['ACME.ai:8080/x', 'acme.ai'],
    ['  http://Acme.com/?q=1 ', 'acme.com'],
  ])('%s -> %s', (input, want) => expect(normalizeDomain(input)).toBe(want));

  it.each(['localhost', '', 'not a domain', 'https://user:pw@acme.com'])('rejects %j', (input) => {
    expect(normalizeDomain(input)).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => expect(normalizeEmail(' Jane@Example.COM ')).toBe('jane@example.com'));
  it.each(['Jane <jane@example.com>', 'nope', 'a@b', '', undefined])('rejects %j', (input) => {
    expect(normalizeEmail(input as string)).toBeNull();
  });
});
