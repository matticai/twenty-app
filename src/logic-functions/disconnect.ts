import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { DISCONNECT_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { disconnectFromOneEye } from 'src/lib/disconnect';
import { credentialStore, oneeyeApiUrl } from 'src/runtime';

const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.userWorkspaceId) return new Response({ message: 'Sign in to Twenty.' }, { status: 403 });
  const result = await disconnectFromOneEye(credentialStore(), oneeyeApiUrl(), context.workspaceId);
  return new Response({ disconnected: true, notified: result.notified });
};

export default defineLogicFunction({
  universalIdentifier: DISCONNECT_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'oneeye-disconnect',
  description: 'Disconnects this workspace from 1eye. Never deletes CRM records.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/1eye/disconnect', httpMethod: 'POST', isAuthRequired: true },
});
