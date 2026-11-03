import { describe, expect, it } from 'vitest';

import { resolveApplicationIdentity } from 'src/constants/application-identity';
import { APP_DISPLAY_NAME, APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

const DEV = 'f7b053db-1b9a-4b91-8d23-d838bbc6e2ee';

describe('resolveApplicationIdentity', () => {
  it('is the production identity by default', () => {
    expect(resolveApplicationIdentity(undefined)).toEqual({ universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, displayName: APP_DISPLAY_NAME });
    expect(resolveApplicationIdentity('  ')).toEqual({ universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, displayName: APP_DISPLAY_NAME });
  });

  it('uses a separate, clearly named identity when an id is given', () => {
    expect(resolveApplicationIdentity(DEV.toUpperCase())).toEqual({ universalIdentifier: DEV, displayName: '1eye (dev)' });
  });

  it('keeps the plain name when the override is the production id', () => {
    expect(resolveApplicationIdentity(APPLICATION_UNIVERSAL_IDENTIFIER).displayName).toBe(APP_DISPLAY_NAME);
  });

  it('refuses anything that is not a UUID v4', () => {
    for (const bad of ['nope', '12345678-1234-1234-1234-123456789012', DEV.slice(1), `${DEV}0`]) {
      expect(() => resolveApplicationIdentity(bad)).toThrow(/UUID v4/);
    }
  });
});
