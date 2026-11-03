import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type LogicFunctionExecutionContext, type RoutePayload } from 'twenty-sdk/logic-function';

import { PAIR_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { confirmPairing, pair } from 'src/lib/oneeye-client';
import { completePairing } from 'src/lib/pairing';
import { credentialStore, oneeyeApiUrl, syncEndpointUrl } from 'src/runtime';

type PairBody = { code?: string; workspaceName?: string; workspaceUrl?: string };

const MAX_FIELD = 200;
const clean = (v: unknown): string => (typeof v === 'string' ? v.trim().slice(0, MAX_FIELD) : '');

const fail = (status: number, message: string, detail?: string) =>
  new Response({ connected: false, message, ...(detail ? { detail } : {}) }, { status });

// Pairs this workspace with a 1eye workspace. It runs on the server, never in the browser, and only
// for a signed-in Twenty user.
const handler = async (event: RoutePayload<PairBody>, context: LogicFunctionExecutionContext) => {
  if (!context.userWorkspaceId) return fail(403, 'Sign in to Twenty to connect 1eye.');
  const body = event.body ?? {};
  const code = clean(body.code);
  const apiUrl = oneeyeApiUrl();
  if (code === '') return fail(400, 'Enter the pairing code from 1eye.');
  if (!apiUrl) return fail(500, 'The 1eye API URL is not configured for this app.');
  const endpointUrl = syncEndpointUrl();
  if (!endpointUrl) return fail(500, 'This workspace has no public address for the app. Set the Twenty server URL and try again.');

  const outcome = await completePairing(
    {
      apiUrl,
      code,
      workspaceId: context.workspaceId,
      workspaceName: clean(body.workspaceName),
      workspaceUrl: clean(body.workspaceUrl),
      endpointUrl,
    },
    { store: credentialStore(), pair, confirm: confirmPairing },
  );
  if (!outcome.connected) {
    // Visible in `twenty app logs`; contains no code, secret or response body.
    console.warn(`1eye pairing failed: ${outcome.detail}`);
    return fail(outcome.status, outcome.message, outcome.detail);
  }
  return new Response({ connected: true });
};

export default defineLogicFunction({
  universalIdentifier: PAIR_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'oneeye-pair',
  description: 'Completes the connection to a 1eye workspace (server side).',
  timeoutSeconds: 60,
  handler,
  httpRouteTriggerSettings: { path: '/1eye/pair', httpMethod: 'POST', isAuthRequired: true },
});
