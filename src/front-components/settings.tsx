import { useCallback, useEffect, useState } from 'react';

import { defineSettingsFrontComponent } from 'twenty-sdk/define';
import { enqueueSnackbar, useLocation } from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { LightButton, MainButton } from 'twenty-ui/components/input';
import { Heading } from 'twenty-ui/primitives/typography';
import { Input } from 'twenty-ui/primitives/input';

import { APP_DISPLAY_NAME, SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { callFunction } from 'src/lib/call-function';

type Status = { state: 'connected' | 'not_connected'; connectedAt: number | null; oneeyeApiHost: string };
type View = { kind: 'loading' } | { kind: 'ready'; status: Status } | { kind: 'error'; message: string };

const api = new RestApiClient();

// A pairing code in the page URL (?pairing_code=...) pre-fills the box; the user creates the code in 1eye
// and pastes it here.
const readCode = (search: string): string => new URLSearchParams(search).get('pairing_code') ?? '';

const SettingsPage = () => {
  const location = useLocation();
  const [view, setView] = useState<View>({ kind: 'loading' });
  const [code, setCode] = useState(() => readCode(location?.search ?? ''));
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setView({ kind: 'ready', status: await callFunction<Status>(api, '/1eye/status') });
    } catch {
      setView({ kind: 'error', message: 'Could not load the 1eye connection.' });
    }
  }, []);
  useEffect(() => void refresh(), [refresh]);

  const connect = async () => {
    setBusy(true);
    try {
      await callFunction(api, '/1eye/pair', { code: code.trim(), workspaceUrl: location?.origin ?? '' });
      setCode('');
      enqueueSnackbar({ message: '1eye is connected.', variant: 'success' });
    } catch (e: any) {
      const reason = e?.body?.message ?? 'The connection failed. Try again.';
      enqueueSnackbar({ message: e?.body?.detail ? `${reason} (${e.body.detail})` : reason, variant: 'error' });
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      await callFunction(api, '/1eye/disconnect');
      enqueueSnackbar({ message: '1eye was disconnected. Your People and Companies are unchanged.', variant: 'success' });
    } catch {
      enqueueSnackbar({ message: 'Could not disconnect. Try again.', variant: 'error' });
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  if (view.kind === 'loading') return <div>Loading…</div>;
  if (view.kind === 'error') return <div role="alert">{view.message}</div>;
  const { status } = view;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
      <Heading level={2}>{APP_DISPLAY_NAME}</Heading>
      <div>Buyer Signals Infrastructure. Qualified buyers and their companies sync into People and Companies.</div>
      <div>1eye server: {status.oneeyeApiHost || 'not configured'}</div>
      {status.state === 'connected' ? (
        <>
          <div role="status">Status: Connected</div>
          <LightButton disabled={busy} onClick={disconnect}>Disconnect</LightButton>
        </>
      ) : (
        <>
          <div role="status">Status: Not connected</div>
          <label htmlFor="oneeye-pairing-code">Pairing code from 1eye</label>
          <Input id="oneeye-pairing-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" />
          <MainButton disabled={busy || code.trim() === ''} onClick={connect}>Connect with code</MainButton>
        </>
      )}
    </div>
  );
};

export default defineSettingsFrontComponent({
  universalIdentifier: SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: `${APP_DISPLAY_NAME} settings`,
  description: 'Connect or disconnect your 1eye workspace.',
  component: SettingsPage,
});
