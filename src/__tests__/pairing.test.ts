import { describe, expect, it, vi } from 'vitest';

import { MemoryKv } from 'src/__tests__/fakes';
import { disconnectFromOneEye } from 'src/lib/disconnect';
import { completePairing, userMessage } from 'src/lib/pairing';
import { CredentialStore } from 'src/lib/stores';

const input = { apiUrl: 'https://api.example.com', code: 'code-1', workspaceId: 'ws-1', workspaceName: 'Acme', workspaceUrl: 'https://acme.twenty.com', endpointUrl: 'https://acme.twenty.com/s/1eye/sync' };

const resp = (status: number, body: any = null) => ({ status, ok: status >= 200 && status < 300, body });

describe('completePairing', () => {
  it('stores the secret before confirming and records the connection', async () => {
    const store = new CredentialStore(new MemoryKv());
    const confirm = vi.fn(async () => {
      // 1eye calls this app back during confirmation, so the secret must already be stored.
      expect(await store.load()).toEqual({ secret: 'sekret', installationId: 'inst-1' });
      return resp(200, {});
    });
    const pair = vi.fn(async () => resp(200, { installation_secret: 'sekret' }));
    const out = await completePairing(input, { store, pair, confirm, newId: () => 'inst-1', now: () => 1_700_000_000 });
    expect(out).toEqual({ connected: true });
    expect(pair).toHaveBeenCalledWith('https://api.example.com', expect.objectContaining({ pairingCode: 'code-1', twentyWorkspaceId: 'ws-1', installationId: 'inst-1', endpointUrl: input.endpointUrl }));
    expect(confirm).toHaveBeenCalledWith('https://api.example.com', 'sekret', 'ws-1', 'inst-1');
    expect(await store.loadInfo()).toMatchObject({ workspaceId: 'ws-1' });
  });

  it('stores nothing when 1eye refuses the code, and shows only a bounded message', async () => {
    const store = new CredentialStore(new MemoryKv());
    const out = await completePairing(input, {
      store,
      pair: async () => resp(400, { message: 'The pairing code is invalid or has expired.' }),
      confirm: vi.fn(),
    });
    expect(out).toEqual({ connected: false, status: 400, message: 'The pairing code is invalid or has expired.', detail: 'HTTP 400 from api.example.com' });
    expect(await store.load()).toBeNull();
  });

  it('rolls the secret back when confirmation fails', async () => {
    const store = new CredentialStore(new MemoryKv());
    const out = await completePairing(input, {
      store,
      pair: async () => resp(200, { installation_secret: 'sekret' }),
      confirm: async () => resp(502, { message: '1eye could not verify the installed Twenty app.' }),
    });
    expect(out.connected).toBe(false);
    expect(await store.load()).toBeNull();
  });

  it('rolls back when the confirmation request itself throws', async () => {
    const store = new CredentialStore(new MemoryKv());
    const out = await completePairing(input, {
      store,
      pair: async () => resp(200, { installation_secret: 'sekret' }),
      confirm: async () => { throw new Error('network down'); },
    });
    expect(out.connected).toBe(false);
    expect(await store.load()).toBeNull();
  });

  it('treats a 200 without a secret as a failure', async () => {
    const store = new CredentialStore(new MemoryKv());
    const out = await completePairing(input, { store, pair: async () => resp(200, {}), confirm: vi.fn() });
    expect(out.connected).toBe(false);
  });

  it('maps a backend 5xx to a 502', async () => {
    const out = await completePairing(input, { store: new CredentialStore(new MemoryKv()), pair: async () => resp(503), confirm: vi.fn() });
    expect(out).toMatchObject({ connected: false, status: 502 });
  });
});

describe('error reporting', () => {
  it('shows the message 1eye actually returned ({ error: { message } }), not the generic fallback', async () => {
    const out = await completePairing(input, {
      store: new CredentialStore(new MemoryKv()),
      pair: async () => resp(400, { error: { code: 'ERROR_CODE_INVALID_FIELD', message: 'The Twenty app endpoint is not valid.' } }),
      confirm: vi.fn(),
    });
    expect(out).toMatchObject({ connected: false, message: 'The Twenty app endpoint is not valid.', detail: 'HTTP 400 from api.example.com' });
  });

  it('names the host and status when the answer has no usable message (for example a wrong API URL)', async () => {
    const out = await completePairing({ ...input, apiUrl: 'https://api.1eye.ai' }, {
      store: new CredentialStore(new MemoryKv()),
      pair: async () => resp(404, null),
      confirm: vi.fn(),
    });
    expect(out).toMatchObject({ connected: false, detail: 'HTTP 404 from api.1eye.ai' });
  });

  it('never puts the code or secret in the diagnostic', async () => {
    const out = await completePairing(input, {
      store: new CredentialStore(new MemoryKv()),
      pair: async () => resp(200, { installation_secret: 'sekret' }),
      confirm: async () => resp(502, null),
    });
    expect(JSON.stringify(out)).not.toMatch(/sekret|code-1/);
  });
});

describe('userMessage', () => {
  it('rejects non-strings and long text', () => {
    expect(userMessage({ message: 5 }, 'fb')).toBe('fb');
    expect(userMessage({ message: 'x'.repeat(201) }, 'fb')).toBe('fb');
    expect(userMessage(null, 'fb')).toBe('fb');
    expect(userMessage({ message: 'ok' }, 'fb')).toBe('ok');
  });
});

describe('disconnectFromOneEye', () => {
  it('tells 1eye and clears the secret', async () => {
    const store = new CredentialStore(new MemoryKv());
    await store.save({ secret: 's', installationId: 'i' });
    const notify = vi.fn(async () => resp(200, {}));
    expect(await disconnectFromOneEye(store, 'https://api.example.com', 'ws-1', notify)).toEqual({ notified: true });
    expect(notify).toHaveBeenCalledWith('https://api.example.com', 's', 'ws-1', 'i');
    expect(await store.load()).toBeNull();
  });

  it('clears the secret even when 1eye cannot be reached', async () => {
    const store = new CredentialStore(new MemoryKv());
    await store.save({ secret: 's', installationId: 'i' });
    const out = await disconnectFromOneEye(store, 'https://api.example.com', 'ws-1', async () => { throw new Error('offline'); });
    expect(out).toEqual({ notified: false });
    expect(await store.load()).toBeNull();
  });

  it('is a harmless no-op when not connected', async () => {
    const store = new CredentialStore(new MemoryKv());
    const notify = vi.fn();
    expect(await disconnectFromOneEye(store, 'https://api.example.com', 'ws-1', notify as never)).toEqual({ notified: false });
    expect(notify).not.toHaveBeenCalled();
  });
});
