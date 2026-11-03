import { APP_DISPLAY_NAME, APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// The application identity of a build. The production identity is registered once on Twenty Cloud and
// owned by the 1eye publisher workspace; only that owner may apply, develop or publish it. A QA or
// test workspace therefore builds under its OWN identity, chosen at build time:
//
//   ONEEYE_APPLICATION_ID=<uuid v4> ONEEYE_ENV=dev twenty app apply --create --remote <workspace>
//
// That registers a separate "1eye (dev)" app in that workspace and leaves the production id untouched.
// With nothing set the build is the production identity.

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ApplicationIdentity = { universalIdentifier: string; displayName: string };

export const resolveApplicationIdentity = (override: string | undefined): ApplicationIdentity => {
  const id = (override ?? '').trim();
  if (id === '') return { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, displayName: APP_DISPLAY_NAME };
  if (!UUID_V4.test(id)) throw new Error('ONEEYE_APPLICATION_ID must be a valid UUID v4');
  if (id.toLowerCase() === APPLICATION_UNIVERSAL_IDENTIFIER) {
    return { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER, displayName: APP_DISPLAY_NAME };
  }
  // A visibly different name, so a test install is never mistaken for the real app.
  return { universalIdentifier: id.toLowerCase(), displayName: `${APP_DISPLAY_NAME} (dev)` };
};
