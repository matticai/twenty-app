import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { SYNC_ROUTE_PATH } from 'src/constants/config';
import { SYNC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { handleRequest } from 'src/lib/handler';
import { buildHandlerDeps } from 'src/runtime';

// The signed endpoint 1eye sends its sync batches to (CONTRACT.md). It is deliberately reachable
// without a Twenty login: every request is authenticated inside handleRequest by the installation's
// HMAC signature, and writes run as the app's own least-privilege role.
const handler = async (event: RoutePayload, context: LogicFunctionExecutionContext) => {
  const outcome = await handleRequest(
    { headers: event.headers, rawBody: event.rawBody },
    buildHandlerDeps(context.workspaceId),
  );
  return new Response(outcome.body, { status: outcome.status, headers: { 'content-type': 'application/json' } });
};

export default defineLogicFunction({
  universalIdentifier: SYNC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'oneeye-sync',
  description: 'Receives signed requests from 1eye (ping, describe_schema, sync, disconnect).',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: {
    path: SYNC_ROUTE_PATH,
    httpMethod: 'POST',
    isAuthRequired: false,
    // Headers are not forwarded unless listed; the signature check needs all three.
    forwardedRequestHeaders: ['x-1eye-timestamp', 'x-1eye-delivery-id', 'x-1eye-signature', 'content-type'],
  },
});
