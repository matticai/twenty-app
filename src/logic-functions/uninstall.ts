import { defineUninstallLogicFunction } from 'twenty-sdk/define';

import { UNINSTALL_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { disconnectFromOneEye } from 'src/lib/disconnect';
import { credentialStore, oneeyeApiUrl } from 'src/runtime';

// Runs before the app is removed (best effort): 1eye is told so it stops pushing and the secret is
// cleared. People and Companies are never deleted.
export default defineUninstallLogicFunction({
  universalIdentifier: UNINSTALL_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'oneeye-uninstall',
  description: 'Tells 1eye the app was uninstalled and discards the connection secret.',
  timeoutSeconds: 30,
  handler: async () => {
    // The uninstall payload carries no workspace id; use the one stored at pairing.
    const workspaceId = (await credentialStore().loadInfo()).workspaceId ?? '';
    await disconnectFromOneEye(credentialStore(), oneeyeApiUrl(), workspaceId);
  },
});
