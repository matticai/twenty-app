import {
  KV_CONNECTION,
  KV_CREDENTIALS,
  KV_REPLAY_PREFIX,
  REPLAY_BUCKET_SECONDS,
  REPLAY_BUCKETS_KEPT,
} from 'src/constants/config';

// Minimal key-value surface (the SDK's `kv` satisfies it), so stores can be tested without a server.
export interface KeyValue {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

export type Credentials = { secret: string; installationId: string };

// Display-only state shown on the settings page; never a secret.
export type ConnectionInfo = { oneeyeWorkspaceName?: string; connectedAt?: number; workspaceId?: string };

export class CredentialStore {
  constructor(private readonly kv: KeyValue) {}
  async load(): Promise<Credentials | null> {
    const c = await this.kv.get<Credentials>(KV_CREDENTIALS);
    return c && typeof c.secret === 'string' && c.secret !== '' && typeof c.installationId === 'string' ? c : null;
  }
  async save(credentials: Credentials): Promise<void> {
    await this.kv.set(KV_CREDENTIALS, credentials);
  }
  async clear(): Promise<void> {
    await this.kv.delete(KV_CREDENTIALS);
    await this.kv.delete(KV_CONNECTION);
  }
  async loadInfo(): Promise<ConnectionInfo> {
    return (await this.kv.get<ConnectionInfo>(KV_CONNECTION)) ?? {};
  }
  async saveInfo(info: ConnectionInfo): Promise<void> {
    await this.kv.set(KV_CONNECTION, info);
  }
}

// ReplayStore remembers recently accepted delivery ids. Ids live in time buckets so old ones are
// dropped without a TTL feature. It is best effort (read-modify-write, not atomic): the upserts are
// idempotent by identity, which is the real protection; this stops a captured request being replayed.
export class ReplayStore {
  constructor(
    private readonly kv: KeyValue,
    private readonly clock: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  private bucket(seconds: number): number {
    return Math.floor(seconds / REPLAY_BUCKET_SECONDS);
  }

  /** Returns true when the id was not seen in the window, and records it. */
  async firstSeen(deliveryId: string): Promise<boolean> {
    const current = this.bucket(this.clock());
    for (let b = current; b > current - REPLAY_BUCKETS_KEPT; b--) {
      const ids = await this.kv.get<string[]>(KV_REPLAY_PREFIX + b);
      if (ids?.includes(deliveryId)) return false;
    }
    const ids = (await this.kv.get<string[]>(KV_REPLAY_PREFIX + current)) ?? [];
    await this.kv.set(KV_REPLAY_PREFIX + current, [...ids, deliveryId]);
    await this.kv.delete(KV_REPLAY_PREFIX + (current - REPLAY_BUCKETS_KEPT));
    return true;
  }
}
