import { randomUUID } from 'node:crypto';

import { confirmPairing, pair } from 'src/lib/oneeye-client';
import { hostOf } from 'src/lib/host';
import type { CredentialStore } from 'src/lib/stores';

// detail is a short, non-sensitive diagnostic (HTTP status and the host that answered); it never
// carries the pairing code, the secret or a response body.
export type PairingOutcome = { connected: true } | { connected: false; status: number; message: string; detail: string };

type Deps = {
  store: Pick<CredentialStore, 'save' | 'clear' | 'saveInfo'>;
  pair: typeof pair;
  confirm: typeof confirmPairing;
  newId?: () => string;
  /** Unix seconds. */
  now?: () => number;
};

const MAX_MESSAGE = 200;

// Only a bounded, plain-text message from 1eye is shown; anything else gets the fallback. The 1eye API
// reports errors as { error: { code, message } }; a flat { message } is accepted too.
export const userMessage = (body: Record<string, any> | null | undefined, fallback: string): string => {
  for (const m of [body?.error?.message, body?.message]) {
    if (typeof m === 'string' && m.length > 0 && m.length <= MAX_MESSAGE) return m;
  }
  return fallback;
};

const detail = (status: number, apiUrl: string): string => `HTTP ${status} from ${hostOf(apiUrl) || 'unknown host'}`;

// completePairing runs the server-side pairing (CONTRACT.md section 1). `workspaceId` must come from the
// server-side execution context: the browser is not trusted for identity.
export const completePairing = async (
  input: {
    apiUrl: string;
    code: string;
    workspaceId: string;
    workspaceName: string;
    workspaceUrl: string;
    endpointUrl: string;
  },
  deps: Deps,
): Promise<PairingOutcome> => {
  const installationId = (deps.newId ?? randomUUID)();

  const paired = await deps.pair(input.apiUrl, {
    pairingCode: input.code,
    twentyWorkspaceId: input.workspaceId,
    twentyWorkspaceName: input.workspaceName,
    workspaceUrl: input.workspaceUrl,
    installationId,
    endpointUrl: input.endpointUrl,
  });
  const secret = paired.body?.installation_secret;
  if (!paired.ok || !secret) {
    return {
      connected: false,
      status: paired.status >= 500 ? 502 : 400,
      message: userMessage(paired.body, 'The pairing code is invalid or has expired. Start again from 1eye.'),
      detail: detail(paired.status, input.apiUrl),
    };
  }

  // The secret must be stored before confirming: 1eye answers the confirmation by calling this app's
  // signed endpoint, which can only verify against the stored secret.
  await deps.store.save({ secret, installationId });
  let confirmed;
  try {
    confirmed = await deps.confirm(input.apiUrl, secret, input.workspaceId, installationId);
  } catch {
    confirmed = { ok: false, status: 502, body: null };
  }
  if (!confirmed.ok) {
    await deps.store.clear(); // roll back: never leave a half-paired installation holding a secret
    return {
      connected: false,
      status: 502,
      message: userMessage(confirmed.body, '1eye could not verify this app. Check the app and try again.'),
      detail: detail(confirmed.status, input.apiUrl),
    };
  }
  await deps.store.saveInfo({ connectedAt: (deps.now ?? (() => Math.floor(Date.now() / 1000)))(), workspaceId: input.workspaceId });
  return { connected: true };
};
