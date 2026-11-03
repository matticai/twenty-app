import { kv } from 'twenty-sdk/logic-function';

import type { HandlerDeps } from 'src/lib/handler';
import { CoreApiGateway } from 'src/lib/gateway-twenty';
import { MetadataSchemaProvider } from 'src/lib/schema-twenty';
import { buildSyncEndpoint } from 'src/lib/endpoint';
import { CredentialStore, ReplayStore, type KeyValue } from 'src/lib/stores';

// The app's persisted state lives in the workspace-scoped key-value store.
export const workspaceKv: KeyValue = {
  get: <T>(key: string) => kv.get<T>(key, { scope: 'WORKSPACE' }),
  set: <T>(key: string, value: T) => kv.set(key, value, { scope: 'WORKSPACE' }),
  delete: (key: string) => kv.delete(key, { scope: 'WORKSPACE' }),
};

export const credentialStore = () => new CredentialStore(workspaceKv);

export const buildHandlerDeps = (workspaceId: string | undefined): HandlerDeps => ({
  credentials: credentialStore(),
  replay: new ReplayStore(workspaceKv),
  gateway: new CoreApiGateway(),
  schema: new MetadataSchemaProvider(),
  workspaceId,
  nowSeconds: () => Math.floor(Date.now() / 1000),
});

export const oneeyeApiUrl = (): string => process.env.ONEEYE_API_URL ?? '';

// The public URL of this app's sync function (see lib/endpoint.ts), or null when it cannot be worked out.
export const syncEndpointUrl = (): string | null => buildSyncEndpoint(process.env);
