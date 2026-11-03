import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { STATUS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { credentialStore, oneeyeApiUrl } from 'src/runtime';
import { hostOf } from 'src/lib/host';

// What the settings page shows. It reports local state only and never returns the secret.
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.userWorkspaceId) return new Response({ message: 'Sign in to Twenty.' }, { status: 403 });
  const store = credentialStore();
  const connected = (await store.load()) !== null;
  const info = connected ? await store.loadInfo() : {};
  return new Response({
    state: connected ? 'connected' : 'not_connected',
    connectedAt: info.connectedAt ?? null,
    // Only the host: shown so a wrong server (for example production while testing locally) is visible.
    oneeyeApiHost: hostOf(oneeyeApiUrl()),
  });
};

export default defineLogicFunction({
  universalIdentifier: STATUS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'oneeye-status',
  description: 'Connection status for the settings page.',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: { path: '/1eye/status', httpMethod: 'POST', isAuthRequired: true },
});
