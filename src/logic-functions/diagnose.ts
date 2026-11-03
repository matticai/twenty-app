import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { DIAGNOSE_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { runDiagnostics } from 'src/lib/diagnose';
import { CoreApiGateway } from 'src/lib/gateway-twenty';
import { MetadataSchemaProvider } from 'src/lib/schema-twenty';

// For a signed-in Twenty user only. Runs the reads the sync endpoint relies on, as the application's own
// role, and says which one fails. It reads metadata and probes for an id that does not exist; it writes
// nothing and returns no record data.
const handler = async (_event: RoutePayload, context: LogicFunctionExecutionContext) => {
  if (!context.userWorkspaceId) return new Response({ message: 'Sign in to Twenty.' }, { status: 403 });
  const schema = new MetadataSchemaProvider();
  const result = await runDiagnostics({
    schema,
    gateway: new CoreApiGateway(),
    introspect: () => schema.introspectFieldNames(),
  });
  return new Response(result);
};

export default defineLogicFunction({
  universalIdentifier: DIAGNOSE_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'oneeye-diagnose',
  description: 'Self-test of the app-side reads used by the sync endpoint.',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: { path: '/1eye/diagnose', httpMethod: 'POST', isAuthRequired: true },
});
