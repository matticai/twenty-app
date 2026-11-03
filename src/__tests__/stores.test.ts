import { describe, expect, it } from 'vitest';

import { MemoryKv } from 'src/__tests__/fakes';
import { CredentialStore, ReplayStore } from 'src/lib/stores';

describe('CredentialStore', () => {
  it('saves, loads and clears', async () => {
    const store = new CredentialStore(new MemoryKv());
    expect(await store.load()).toBeNull();
    await store.save({ secret: 's', installationId: 'i' });
    await store.saveInfo({ oneeyeWorkspaceName: 'Acme' });
    expect(await store.load()).toEqual({ secret: 's', installationId: 'i' });
    await store.clear();
    expect(await store.load()).toBeNull();
    expect(await store.loadInfo()).toEqual({});
  });
  it('treats an empty secret as not connected', async () => {
    const kv = new MemoryKv();
    await kv.set('oneeye:credentials', { secret: '', installationId: 'i' });
    expect(await new CredentialStore(kv).load()).toBeNull();
  });
});

describe('ReplayStore', () => {
  it('accepts an id once within the window', async () => {
    let now = 1_000_000;
    const store = new ReplayStore(new MemoryKv(), () => now);
    expect(await store.firstSeen('a')).toBe(true);
    expect(await store.firstSeen('a')).toBe(false);
    now += 600; // two buckets later: still remembered
    expect(await store.firstSeen('a')).toBe(false);
    expect(await store.firstSeen('b')).toBe(true);
  });
  it('forgets old ids and prunes their buckets', async () => {
    let now = 1_000_000;
    const kv = new MemoryKv();
    const store = new ReplayStore(kv, () => now);
    await store.firstSeen('a');
    now += 300 * 6;
    expect(await store.firstSeen('a')).toBe(true);
    const buckets = [...kv.data.keys()].filter((k) => k.startsWith('oneeye:replay:'));
    expect(buckets.length).toBeLessThanOrEqual(2);
  });
});
