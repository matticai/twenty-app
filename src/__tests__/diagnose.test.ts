import { describe, expect, it } from 'vitest';

import { companyFields, personFields } from 'src/__tests__/fakes';
import { describeError, runDiagnostics } from 'src/lib/diagnose';

const okSchema = { load: async () => ({ person: personFields, company: companyFields }) };
const okGateway = { findPeopleByOneeyeId: async () => [] };

describe('runDiagnostics', () => {
  it('reports both steps ok with the 1eye fields found', async () => {
    const r = await runDiagnostics({ schema: okSchema, gateway: okGateway });
    expect(r.ok).toBe(true);
    expect(r.steps.map((s) => [s.step, s.ok])).toEqual([['schema', true], ['records', true]]);
    expect(r.steps[0]!.detail).toContain('oneeyeBuyerId');
    expect(r.steps[0]!.detail).toContain('oneeyeCompanyId');
  });

  it('names the step that fails and why, and still runs the other step', async () => {
    const r = await runDiagnostics({
      schema: { load: async () => { throw new Error('permission denied for objects'); } },
      gateway: okGateway,
    });
    expect(r.ok).toBe(false);
    expect(r.steps[0]).toMatchObject({ step: 'schema', ok: false });
    expect(r.steps[0]!.error).toContain('permission denied for objects');
    expect(r.steps[1]).toMatchObject({ step: 'records', ok: true });
  });

  it('lists the attributes the app can query when the schema read fails', async () => {
    const r = await runDiagnostics({
      schema: { load: async () => { throw new Error('Cannot query field "writability" on type "Field"'); } },
      gateway: okGateway,
      introspect: async () => ['id', 'name', 'type'],
    });
    expect(r.steps[0]!.availableFieldAttributes).toEqual(['id', 'name', 'type']);
  });

  it('still reports the original error when introspection itself fails', async () => {
    const r = await runDiagnostics({
      schema: { load: async () => { throw new Error('boom'); } },
      gateway: okGateway,
      introspect: async () => { throw new Error('also broken'); },
    });
    expect(r.steps[0]!.error).toContain('boom');
    expect(r.steps[0]!.availableFieldAttributes).toBeUndefined();
  });

  it('reports a failing record read', async () => {
    const r = await runDiagnostics({ schema: okSchema, gateway: { findPeopleByOneeyeId: async () => { throw new Error('forbidden'); } } });
    expect(r.steps[1]).toMatchObject({ step: 'records', ok: false });
  });
});

describe('describeError', () => {
  it('bounds the message and handles non-errors', () => {
    expect(describeError(new Error('x'.repeat(1000))).length).toBe(300);
    expect(describeError('plain')).toBe('plain');
    expect(describeError(new TypeError('bad'))).toBe('TypeError: bad');
  });
});
