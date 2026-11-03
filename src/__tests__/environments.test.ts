import { describe, expect, it } from 'vitest';

import { ENVIRONMENTS, resolveEnvironment } from 'src/constants/environments';

describe('resolveEnvironment', () => {
  it('defaults to production when nothing is set', () => {
    expect(resolveEnvironment(undefined)).toEqual({ environment: 'prod', ...ENVIRONMENTS.prod });
    expect(resolveEnvironment('  ').environment).toBe('prod');
  });

  it.each(['prod', 'dev', 'local'] as const)('selects the %s profile', (name) => {
    expect(resolveEnvironment(name)).toEqual({ environment: name, ...ENVIRONMENTS[name] });
  });

  it('refuses an unknown environment instead of falling back', () => {
    expect(() => resolveEnvironment('staging')).toThrow(/ONEEYE_ENV/);
    expect(() => resolveEnvironment('PROD')).toThrow(/ONEEYE_ENV/);
  });

  it('applies overrides, trims them and drops a trailing slash', () => {
    const out = resolveEnvironment('local', { apiUrl: ' http://localhost:8000/ ' });
    expect(out.apiUrl).toBe('http://localhost:8000');
  });

  it('requires https in production, even through an override', () => {
    expect(() => resolveEnvironment('prod', { apiUrl: 'http://api.example.com' })).toThrow(/https/);
    expect(resolveEnvironment('dev', { apiUrl: 'http://localhost:8000' }).apiUrl).toBe('http://localhost:8000');
  });

  it('rejects malformed URLs, other schemes and embedded credentials', () => {
    expect(() => resolveEnvironment('dev', { apiUrl: 'not a url' })).toThrow(/valid URL/);
    expect(() => resolveEnvironment('dev', { apiUrl: 'ftp://x.example.com' })).toThrow(/http/);
    expect(() => resolveEnvironment('dev', { apiUrl: 'https://user:pw@x.example.com' })).toThrow(/credentials/);
  });

  it('has no web-app URL: the app never sends the user to 1eye', () => {
    for (const env of Object.values(ENVIRONMENTS)) expect(Object.keys(env)).toEqual(['apiUrl']);
  });

  it('keeps production on the real 1eye hosts', () => {
    expect(ENVIRONMENTS.prod.apiUrl).toBe('https://api.1eye.ai');
    expect(ENVIRONMENTS.dev.apiUrl).toBe('https://dev.api.1eye.ai');
  });
});
