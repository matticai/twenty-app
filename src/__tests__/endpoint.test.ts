import { describe, expect, it } from 'vitest';

import { buildSyncEndpoint } from 'src/lib/endpoint';

describe('buildSyncEndpoint', () => {
  it('uses <server>/s when Twenty sets the functions base to an empty string (the bug that sent "/1eye/sync")', () => {
    expect(buildSyncEndpoint({ TWENTY_FUNCTIONS_URL: '', TWENTY_API_URL: 'https://jolt-guzzler-herring.ngrok-free.dev' })).toBe(
      'https://jolt-guzzler-herring.ngrok-free.dev/s/1eye/sync',
    );
  });

  it('prefers the functions base when Twenty provides one', () => {
    expect(buildSyncEndpoint({ TWENTY_FUNCTIONS_URL: 'https://acme.twenty.com/s/', TWENTY_API_URL: 'https://api.twenty.com' })).toBe(
      'https://acme.twenty.com/s/1eye/sync',
    );
  });

  it('works when only the server URL is present, with or without a trailing slash', () => {
    expect(buildSyncEndpoint({ TWENTY_API_URL: 'https://x.example.com/' })).toBe('https://x.example.com/s/1eye/sync');
  });

  it('returns null instead of a relative or invalid address', () => {
    expect(buildSyncEndpoint({})).toBeNull();
    expect(buildSyncEndpoint({ TWENTY_FUNCTIONS_URL: '', TWENTY_API_URL: '' })).toBeNull();
    expect(buildSyncEndpoint({ TWENTY_API_URL: 'not a url' })).toBeNull();
    expect(buildSyncEndpoint({ TWENTY_API_URL: 'ftp://x.example.com' })).toBeNull();
  });

  it('does not read the old API_URL name, which Twenty does not set', () => {
    expect(buildSyncEndpoint({ API_URL: 'https://x.example.com' })).toBeNull();
  });
});
