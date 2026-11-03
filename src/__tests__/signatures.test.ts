import { describe, expect, it } from 'vitest';

import { sign, verify } from 'src/lib/signatures';

const now = 1_700_000_000;
const body = '{"a":1}';

describe('signatures', () => {
  it('matches the 1eye backend test vector (core-lib pkg/twenty TestSignKnownVector)', () => {
    expect(sign('key', '1', 'x')).toBe('fc4913c41a7bf793267e2a384f3261c9436ec2cd097bd745e7b0d99113f510ec');
  });

  it('accepts a valid signature', () => {
    const signature = sign('secret', String(now), body);
    expect(verify({ secret: 'secret', timestamp: String(now), signature, rawBody: body, nowSeconds: now })).toBeNull();
  });

  it.each([
    ['missing signature', { signature: '' }, 'missing_signature'],
    ['tampered body', { rawBody: '{"a":2}' }, 'bad_signature'],
    ['wrong secret', { secret: 'other' }, 'bad_signature'],
    ['not hex', { signature: 'zz' }, 'bad_signature'],
    ['stale timestamp', { nowSeconds: now + 301 }, 'bad_timestamp'],
    ['future timestamp', { nowSeconds: now - 301 }, 'bad_timestamp'],
    ['bad timestamp', { timestamp: 'abc' }, 'bad_timestamp'],
    ['missing timestamp', { timestamp: undefined }, 'bad_timestamp'],
  ])('rejects %s', (_name, override, want) => {
    const base = { secret: 'secret', timestamp: String(now), signature: sign('secret', String(now), body), rawBody: body, nowSeconds: now };
    expect(verify({ ...base, ...override } as Parameters<typeof verify>[0])).toBe(want);
  });

  it('signs multi-byte bodies as UTF-8 bytes, like the Go backend', () => {
    const signature = sign('s', '1', '{"name":"Zoë 日本"}');
    expect(verify({ secret: 's', timestamp: '1', signature, rawBody: '{"name":"Zoë 日本"}', nowSeconds: 1 })).toBeNull();
  });
});
