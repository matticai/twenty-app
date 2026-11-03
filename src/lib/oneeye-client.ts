import { randomUUID } from 'node:crypto';

import { sign } from 'src/lib/signatures';

// Calls from this app to the 1eye backend (core-lib pkg/twenty CONTRACT.md, sections 1 and 2).

const TIMEOUT_MS = 20_000;

export type OneEyeResponse<T = Record<string, any>> = { status: number; ok: boolean; body: T | null };

const joinUrl = (base: string, path: string): string => `${base.replace(/\/+$/, '')}${path}`;

const parse = async <T>(res: Response): Promise<OneEyeResponse<T>> => {
  let body: T | null = null;
  try {
    body = (await res.json()) as T;
  } catch {
    body = null;
  }
  return { status: res.status, ok: res.ok, body };
};

// pair completes a pairing: the single-use code is the credential. The installation secret comes
// back once in the response and is never logged.
export const pair = async (
  apiUrl: string,
  input: {
    pairingCode: string;
    twentyWorkspaceId: string;
    twentyWorkspaceName: string;
    workspaceUrl: string;
    installationId: string;
    endpointUrl: string;
  },
): Promise<OneEyeResponse<{ installation_secret?: string; account?: Record<string, any> }>> => {
  const res = await fetch(joinUrl(apiUrl, '/integrations/twenty/pair'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      pairing_code: input.pairingCode,
      twenty_workspace_id: input.twentyWorkspaceId,
      twenty_workspace_name: input.twentyWorkspaceName,
      workspace_url: input.workspaceUrl,
      installation_id: input.installationId,
      endpoint_url: input.endpointUrl,
    }),
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return parse(res);
};

// signedPost sends an app-signed request: the signature covers the exact body bytes sent.
export const signedPost = async (
  apiUrl: string,
  path: string,
  secret: string,
  body: Record<string, string>,
  now: () => number = () => Math.floor(Date.now() / 1000),
): Promise<OneEyeResponse> => {
  const raw = JSON.stringify(body);
  const timestamp = String(now());
  const res = await fetch(joinUrl(apiUrl, path), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-1eye-timestamp': timestamp,
      'x-1eye-delivery-id': randomUUID(),
      'x-1eye-signature': sign(secret, timestamp, raw),
    },
    body: raw,
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return parse(res);
};

export const confirmPairing = (apiUrl: string, secret: string, workspaceId: string, installationId: string) =>
  signedPost(apiUrl, '/integrations/twenty/pair/confirm', secret, {
    action: 'confirm_pairing',
    twenty_workspace_id: workspaceId,
    installation_id: installationId,
  });

export const notifyDisconnect = (apiUrl: string, secret: string, workspaceId: string, installationId: string) =>
  signedPost(apiUrl, '/integrations/twenty/disconnect', secret, {
    action: 'disconnect',
    twenty_workspace_id: workspaceId,
    installation_id: installationId,
  });
