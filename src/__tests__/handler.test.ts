import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryGateway, MemoryKv, fixedSchema } from 'src/__tests__/fakes';
import { handleRequest, type HandlerDeps } from 'src/lib/handler';
import { sign } from 'src/lib/signatures';
import { CredentialStore, ReplayStore } from 'src/lib/stores';

const SECRET = 'installation-secret';
const INSTALLATION = 'inst-1';
const NOW = 1_700_000_000;

let gateway: MemoryGateway;
let credentials: CredentialStore;
let deps: HandlerDeps;

beforeEach(async () => {
  gateway = new MemoryGateway();
  const kv = new MemoryKv();
  credentials = new CredentialStore(kv);
  await credentials.save({ secret: SECRET, installationId: INSTALLATION });
  deps = { credentials, replay: new ReplayStore(kv, () => NOW), gateway, schema: fixedSchema, workspaceId: 'ws-1', nowSeconds: () => NOW };
});

// request builds a request signed exactly the way the 1eye backend signs it.
const request = (body: object, over: { secret?: string; timestamp?: number; deliveryHeader?: string; rawOverride?: string } = {}) => {
  const raw = over.rawOverride ?? JSON.stringify(body);
  const ts = String(over.timestamp ?? NOW);
  return {
    rawBody: raw,
    headers: {
      'x-1eye-timestamp': ts,
      'x-1eye-signature': sign(over.secret ?? SECRET, ts, raw),
      'x-1eye-delivery-id': over.deliveryHeader ?? (body as any).delivery_id,
    } as Record<string, string | undefined>,
  };
};
const envelope = (action: string, extra: object = {}, id = 'd-' + Math.random()) => ({
  schema_version: '1.0', delivery_id: id, installation_id: INSTALLATION, action, ...extra,
});

describe('authentication', () => {
  it('answers a signed ping with the workspace and installation identity', async () => {
    const out = await handleRequest(request(envelope('ping')), deps);
    expect(out.status).toBe(200);
    expect(out.body).toMatchObject({ twenty_workspace_id: 'ws-1', installation_id: INSTALLATION });
  });

  it.each([
    ['wrong secret', (b: object) => request(b, { secret: 'other' })],
    ['stale timestamp', (b: object) => request(b, { timestamp: NOW - 3600 })],
    ['tampered body', (b: object) => ({ ...request(b), rawBody: JSON.stringify({ ...b, installation_id: 'x' }) })],
  ])('rejects %s with the same generic 401', async (_name, build) => {
    const out = await handleRequest(build(envelope('ping')), deps);
    expect(out.status).toBe(401);
    expect(out.body.error_code).toBe('unauthorized');
  });

  it('rejects a missing signature, a missing raw body and an unknown installation identically', async () => {
    const ok = request(envelope('ping'));
    const noSig = await handleRequest({ ...ok, headers: { ...ok.headers, 'x-1eye-signature': undefined } }, deps);
    const noBody = await handleRequest({ ...ok, rawBody: undefined }, deps);
    const wrongInstall = await handleRequest(request({ ...envelope('ping'), installation_id: 'someone-else' }), deps);
    for (const out of [noSig, noBody, wrongInstall]) {
      expect(out.status).toBe(401);
      expect(out.body.message).toBe('The request could not be verified.');
    }
  });

  it('fails closed when the app is not connected', async () => {
    await credentials.clear();
    expect((await handleRequest(request(envelope('ping')), deps)).status).toBe(401);
  });

  it('rejects a replayed delivery', async () => {
    const body = envelope('ping', {}, 'same-id');
    expect((await handleRequest(request(body), deps)).status).toBe(200);
    const replay = await handleRequest(request(body), deps);
    expect(replay.status).toBe(409);
    expect(replay.body.error_code).toBe('replay');
  });

  it('rejects a delivery header that differs from the signed body, and oversized bodies', async () => {
    expect((await handleRequest(request(envelope('ping', {}, 'a'), { deliveryHeader: 'b' }), deps)).status).toBe(400);
    const big = request({ ...envelope('ping'), pad: 'x'.repeat(300 * 1024) });
    expect((await handleRequest(big, deps)).status).toBe(413);
  });

  it('rejects an invalid envelope after authenticating it', async () => {
    const out = await handleRequest(request({ ...envelope('ping'), action: 'format_disk' }), deps);
    expect(out.status).toBe(400);
  });
});

describe('describe_schema failures', () => {
  it('answers with a fixed error, not an empty 500, when the schema cannot be read', async () => {
    const failing = { ...deps, schema: { load: async () => { throw new Error('permission denied for internal detail'); } } };
    for (const action of ['describe_schema', 'sync'] as const) {
      const out = await handleRequest(request(envelope(action, action === 'sync' ? { records: [] } : {})), failing);
      expect(out.status).toBe(502);
      expect(JSON.stringify(out.body)).not.toContain('internal detail');
    }
  });
});

describe('describe_schema', () => {
  it('lists writable fields with contract types and option labels', async () => {
    const out = await handleRequest(request(envelope('describe_schema')), deps);
    const person = out.body.person as any[];
    expect(person.find((f) => f.name === 'name').type).toBe('NAME');
    expect(person.find((f) => f.name === 'createdBy').writable).toBe(false);
    expect(person.find((f) => f.name === 'seniority').options).toEqual(['Junior', 'Senior']);
  });
});

describe('sync', () => {
  const companyRec = { record_type: 'company', source_id: 'com_1', operation: 'upsert', identity: { oneeye_id: 'com_1', domain: 'acme.com' }, data: { name: 'Acme', domainName: 'https://acme.com' } };
  const personRec = (companyId?: string) => ({ record_type: 'person', source_id: 'con_1', operation: 'upsert', identity: { oneeye_id: 'con_1', email: 'jane@acme.com' }, company_twenty_id: companyId, data: { name: { first_name: 'Jane', last_name: 'Doe' }, emails: { primary: 'jane@acme.com' } } });

  it('returns exactly one result per record, in order', async () => {
    const out = await handleRequest(request(envelope('sync', { records: [companyRec] })), deps);
    const results = out.body.results as any[];
    expect(out.status).toBe(200);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ source_id: 'com_1', status: 'created' });
  });

  it('links the person to the company id the first call returned, and is idempotent on repeat', async () => {
    const first = await handleRequest(request(envelope('sync', { records: [companyRec] })), deps);
    const companyId = (first.body.results as any[])[0].provider_record_id;
    const second = await handleRequest(request(envelope('sync', { records: [personRec(companyId)] })), deps);
    const personId = (second.body.results as any[])[0].provider_record_id;
    expect(gateway.people.get(personId)?.companyId).toBe(companyId);

    // The 1eye ids are stamped on creation, so a repeat sends nothing new.
    const repeat = await handleRequest(request(envelope('sync', { records: [companyRec, personRec(companyId)] })), deps);
    expect((repeat.body.results as any[]).map((r) => r.status)).toEqual(['unchanged', 'unchanged']);
    const writesBefore = gateway.writes;
    await handleRequest(request(envelope('sync', { records: [companyRec, personRec(companyId)] })), deps);
    expect(gateway.writes).toBe(writesBefore);
    expect(gateway.companies.size).toBe(1);
    expect(gateway.people.size).toBe(1);
  });

  it('reports a partial batch accurately: one record fails, the other still succeeds', async () => {
    gateway.addCompany({ name: 'A', domainName: { primaryLinkUrl: 'https://dup.com' } });
    gateway.addCompany({ name: 'B', domainName: { primaryLinkUrl: 'https://dup.com' } });
    const ambiguousCompany = { ...companyRec, source_id: 'com_2', identity: { oneeye_id: 'com_2', domain: 'dup.com' } };
    const out = await handleRequest(request(envelope('sync', { records: [ambiguousCompany, companyRec] })), deps);
    const results = out.body.results as any[];
    expect(results[0]).toMatchObject({ source_id: 'com_2', status: 'failed', error_code: 'ambiguous_match' });
    expect(results[1]).toMatchObject({ source_id: 'com_1', status: 'created' });
  });

  it('turns a write error into a failed result with a fixed message, never raw text', async () => {
    gateway.failWith = new Error('db exploded for jane@acme.com');
    const out = await handleRequest(request(envelope('sync', { records: [companyRec] })), deps);
    const result = (out.body.results as any[])[0];
    expect(out.status).toBe(200);
    expect(result.status).toBe('failed');
    expect(JSON.stringify(result)).not.toContain('jane@acme.com');
    gateway.failWith = new Error('Forbidden: permission denied');
    const denied = (await handleRequest(request(envelope('sync', { records: [companyRec] })), deps)).body.results as any[];
    expect(denied[0].error_code).toBe('permission_denied');
  });
});

describe('disconnect', () => {
  it('clears the credentials and refuses every later request', async () => {
    const out = await handleRequest(request(envelope('disconnect')), deps);
    expect(out.status).toBe(200);
    expect(await credentials.load()).toBeNull();
    expect((await handleRequest(request(envelope('ping')), deps)).status).toBe(401);
  });
});
