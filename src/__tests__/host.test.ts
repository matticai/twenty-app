import { describe, expect, it } from 'vitest';

import { hostOf } from 'src/lib/host';

describe('hostOf', () => {
  it('returns only the host, with port', () => {
    expect(hostOf('http://host.docker.internal:8000/x?y=1')).toBe('host.docker.internal:8000');
    expect(hostOf('https://api.1eye.ai')).toBe('api.1eye.ai');
  });
  it('never exposes credentials and returns empty for a bad value', () => {
    expect(hostOf('https://user:pw@api.example.com/p')).toBe('api.example.com');
    expect(hostOf('not a url')).toBe('');
    expect(hostOf('')).toBe('');
  });
});
