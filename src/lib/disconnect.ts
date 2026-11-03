import { notifyDisconnect } from 'src/lib/oneeye-client';
import type { CredentialStore } from 'src/lib/stores';

// disconnectFromOneEye tells 1eye (signed) and then always clears the local secret: the local purge
// is what stops this app serving requests, so it never depends on 1eye answering. No CRM record is
// touched.
export const disconnectFromOneEye = async (
  store: Pick<CredentialStore, 'load' | 'clear'>,
  apiUrl: string,
  workspaceId: string,
  notify: typeof notifyDisconnect = notifyDisconnect,
): Promise<{ notified: boolean }> => {
  const credentials = await store.load();
  let notified = false;
  if (credentials && apiUrl) {
    try {
      notified = (await notify(apiUrl, credentials.secret, workspaceId, credentials.installationId)).ok;
    } catch {
      notified = false;
    }
  }
  await store.clear();
  return { notified };
};
