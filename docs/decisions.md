# Decisions and spike log

The app talks to the 1eye backend through the contract in `core-lib/pkg/twenty/CONTRACT.md`. Change
one, change the other in the same pull request.

## Verified offline (SDK 2.53.0 types and docs)

| Topic | Result |
| --- | --- |
| HTTP function | `defineLogicFunction` + `httpRouteTriggerSettings { path, httpMethod, isAuthRequired, forwardedRequestHeaders }`. Headers are only forwarded when listed. `event.rawBody` carries the original UTF-8 body. Deployed URL is `<server>/s<path>`. |
| Signature parity | `sign('key','1','x')` equals the Go backend's value (`src/__tests__/signatures.test.ts`). |
| Role | `defineApplicationRole` with per-object permissions: People and Companies read/update only, no delete, no settings. |
| Standard fields | `STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person` has `name`, `emails`, `phones`, `jobTitle`, `linkedinLink`, `company`. |
| Persisted state | The SDK ships a key-value store (`kv`, `WORKSPACE` scope). Used for the installation secret and replay ids. |
| Uninstall | `defineUninstallLogicFunction` runs before removal, best effort. Used to tell 1eye and clear the secret. |
| Settings page | `defineSettingsFrontComponent` + `defineSettingsMenuItem`; `useLocation` is available to read the pairing code from the URL. |

## Environments

`ONEEYE_ENV` (build time) picks the default API and web URLs; see README. Prod is the default and must be
https. For the public listing, consider removing the in-workspace override and hard-coding the prod URLs,
so a workspace admin cannot point the app, and the pairing code and secret it handles, at another server.

## Application identities

The production id is registered under the `1eye.twenty.com` publisher workspace, whose account only has the
Applications, API keys and Billing permissions: `apply` there fails with "Entity performing the request does
not have permission", and so does `publish --private`. Only an owner can apply or publish an app, so test
workspaces use a separate dev identity chosen at build time (`ONEEYE_APPLICATION_ID`, see README).
Releasing the production identity needs either more permissions on the publisher workspace or the npm
publish and claim flow.

## Open gates (need a running Twenty server)

- **B secret storage.** The secret is in the workspace key-value store. Whether that is encrypted at
  rest is not documented. Alternatives: an `isSecret` application variable written through
  `MetadataApiClient`, or a custom connection provider `accessToken`. Decide after checking the server
  code or asking Twenty, before the first public release.
- **C route.** Verified on a self-hosted server: functions are served at `<server>/s<path>`; Twenty injects
  `TWENTY_API_URL` (the server URL) and `TWENTY_FUNCTIONS_URL`, which is an EMPTY STRING without a public
  subdomain (see `src/lib/endpoint.ts`). Still to confirm through the tunnel: `rawBody` is byte exact, the three `x-1eye-*` headers
  arrive, the function context carries the workspace id for an unauthenticated call, and the function
  URL derivation in `src/runtime.ts` (`TWENTY_FUNCTIONS_URL`, else `<API_URL>/s`).
- **D role.** Confirm calls with `runAs: 'application'` succeed with only the role in `src/roles`.
  Create may need an additional permission flag; the docs show no separate create flag.
- **E data shapes.** Composite shapes (name, emails, phones, additional phones, links, address) and the
  query/mutation argument names are **verified** against the schema generated from a real server. Still
  open: the metadata query in `src/lib/schema-twenty.ts`, and phone number parsing (country and calling
  code). Note: this Twenty version has no `employees` field on Company; the schema-driven mapping skips
  it, so employee count is not synced unless a custom field is mapped.
- **F idempotency.** `additionalEmails` accepts a JSON `ilike` filter: **verified**, used for person
  search. Still open: whether a unique index on `oneeyeBuyerId` / `oneeyeCompanyId` is supported.
- **Front component.** Confirm `useLocation().search` exposes `pairing_code`; the paste-code box is the
  fallback.
- **Metering.** Measure function duration and credit use for a 10-record batch.

## Security note: redirect pairing (not used today)

The settings page has no Connect button: the user pastes a pairing code created in 1eye, and the code never
travels in a URL. If a redirect flow is added later (`?pairing_code=` is already accepted to pre-fill the
box), note this: a crafted link
with an attacker's `return_url` could send a victim's code to the attacker's Twenty workspace and
pair the victim's 1eye workspace with it. The 1eye page that issues the code must:

1. show the Twenty host and require an explicit click before creating the code;
2. accept only https return URLs;
3. keep the code out of logs and referrers.

Safer option for a later version: app-initiated pairing, where the code never travels in a URL. The
paste-code path stays supported either way.

## Not built yet

Buyer Signal object, signal summary fields, widgets, AI tools, 1eye Buyer/Company URL fields (the
backend does not send them yet), Marketplace publishing.
