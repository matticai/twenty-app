# 1eye for Twenty

Syncs qualified buyers and their companies from 1eye into Twenty People and Companies, without
duplicates and without overwriting customer data.

## How it works

1. Install the app and open **Settings > 1eye**.
2. Create a pairing code in 1eye, then paste it into the settings page and click **Connect with code**.
3. 1eye then sends signed requests to this app's function (`POST /s/1eye/sync`); the app matches
   existing People and Companies, creates or updates them, and answers per record.

The wire contract is `core-lib/pkg/twenty/CONTRACT.md`. Design decisions and open spikes are in
[docs/decisions.md](docs/decisions.md).

## Development

Uses Node from `.nvmrc` (24.5.0) and Yarn 4:

```bash
nvm use            # 24.5.0
corepack enable
npm install -g twenty
yarn install

yarn lint && yarn typecheck && yarn test:unit
twenty app build
```

Run against a local Twenty server (Docker Desktop must be running), then expose it over https so the
1eye backend, which refuses http and private addresses, can call the function:

```bash
twenty auth login --url https://<your-ngrok-host> --name local
twenty app plan  --remote local
yarn apply:local          # = ONEEYE_ENV=local twenty app apply --remote local
yarn dev:local            # = ONEEYE_ENV=local twenty app dev --remote local
```

## Environments

The 1eye URLs the app uses are chosen **when the app is built**, with `ONEEYE_ENV`
(`prod` | `dev` | `local`, default `prod`). They become the default of the app's `ONEEYE_API_URL`
variable, which a workspace can still change (see below).

| `ONEEYE_ENV` | 1eye API |
| --- | --- |
| `prod` (default) | `https://api.1eye.ai` |
| `dev` | `https://dev.api.1eye.ai` |
| `local` | `http://host.docker.internal:8000` |

Override the URL for one build with `ONEEYE_API_URL=...`. An unknown `ONEEYE_ENV`
fails the build, and `prod` only accepts https. The Twenty server runs in Docker, so its functions reach
a service on your machine as `host.docker.internal`; if Twenty runs directly on the host, use
`ONEEYE_API_URL=http://localhost:8000`.

```bash
ONEEYE_ENV=dev twenty app apply --remote <dev-workspace>
```

## Application identities

On Twenty Cloud an application id can be registered by one owner workspace only, and only that owner can
`apply`, `dev` or `publish` it. So:

- **Production identity** (`9f1171d3-...`, the default) is owned by the `1eye.twenty.com` publisher
  workspace. That account has limited permissions and cannot sync or publish the app, so it is only the owner.
- **Dev identity** (`f7b053db-1b9a-4b91-8d23-d838bbc6e2ee`, shown as "1eye (dev)") is for test workspaces.
  Select it at build time with `ONEEYE_APPLICATION_ID`. The scripts do it for the `testing` remote:

```bash
twenty auth login --url https://1eye-testing.twenty.com --name testing
yarn create:testing       # first time: register and install
yarn dev:testing          # later: watch and sync
```

To point a test install at a local backend through a tunnel, add the address for the first install:
`ONEEYE_API_URL=https://<ngrok-host> yarn create:testing`.

## Layout

- `src/lib` - signature check, request validation, matching, field conversion (pure, unit tested)
- `src/logic-functions` - the signed sync endpoint, pairing, status, disconnect, uninstall hook
- `src/front-components`, `src/settings-menu-items` - the settings page
- `src/fields`, `src/roles` - the 1eye ids on People and Companies, and the least-privilege role
