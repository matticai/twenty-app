import { SYNC_ROUTE_PATH } from 'src/constants/config';

// The public URL of this app's sync function, which 1eye calls. Twenty injects two relevant names into
// every function run: TWENTY_FUNCTIONS_URL (the workspace's public functions base, set to an EMPTY STRING
// when the workspace has no public subdomain, as on a single-domain self-hosted server) and
// TWENTY_API_URL (the server's own public URL, from SERVER_URL). Functions are served at
// <server>/s<path>, so with no functions base the address is <server>/s<path>.
//
// Returns null when no usable absolute http(s) address can be built, so the caller can say so instead of
// sending 1eye a relative URL.
export const buildSyncEndpoint = (env: Record<string, string | undefined>): string | null => {
  const functionsBase = (env.TWENTY_FUNCTIONS_URL ?? '').trim();
  const server = (env.TWENTY_API_URL ?? '').trim().replace(/\/+$/, '');
  const base = functionsBase !== '' ? functionsBase : server !== '' ? `${server}/s` : '';
  if (base === '') return null;
  const endpoint = `${base.replace(/\/+$/, '')}${SYNC_ROUTE_PATH}`;
  try {
    const url = new URL(endpoint);
    return url.protocol === 'https:' || url.protocol === 'http:' ? endpoint : null;
  } catch {
    return null;
  }
};
