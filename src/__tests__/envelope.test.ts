import { describe, expect, it } from 'vitest';

import { parseEnvelope } from 'src/lib/envelope';

const valid = {
  schema_version: '1.0', delivery_id: 'd1', installation_id: 'i1', action: 'sync',
  records: [{ record_type: 'company', source_id: 'com_1', operation: 'upsert', identity: { domain: 'acme.com' }, data: { name: 'Acme' } }],
};

describe('parseEnvelope', () => {
  it('accepts a valid sync request and a ping without records', () => {
    expect(parseEnvelope(JSON.stringify(valid)).ok).toBe(true);
    expect(parseEnvelope(JSON.stringify({ ...valid, action: 'ping', records: undefined })).ok).toBe(true);
  });
  it('accepts a newer minor version, refuses another major', () => {
    expect(parseEnvelope(JSON.stringify({ ...valid, schema_version: '1.7' })).ok).toBe(true);
    expect(parseEnvelope(JSON.stringify({ ...valid, schema_version: '2.0' })).ok).toBe(false);
  });
  it.each([
    ['not json', 'nope'],
    ['not an object', '[]'],
    ['no delivery id', JSON.stringify({ ...valid, delivery_id: '' })],
    ['no installation id', JSON.stringify({ ...valid, installation_id: undefined })],
    ['unknown action', JSON.stringify({ ...valid, action: 'drop_tables' })],
    ['records not an array', JSON.stringify({ ...valid, records: {} })],
    ['unknown record type', JSON.stringify({ ...valid, records: [{ ...valid.records[0], record_type: 'deal' }] })],
    ['missing source id', JSON.stringify({ ...valid, records: [{ ...valid.records[0], source_id: '' }] })],
    ['bad operation', JSON.stringify({ ...valid, records: [{ ...valid.records[0], operation: 'delete' }] })],
    ['bad identity', JSON.stringify({ ...valid, records: [{ ...valid.records[0], identity: { email: 5 } }] })],
    ['data not an object', JSON.stringify({ ...valid, records: [{ ...valid.records[0], data: 'x' }] })],
    ['too many records', JSON.stringify({ ...valid, records: Array(51).fill(valid.records[0]) })],
  ])('rejects %s', (_n, body) => expect(parseEnvelope(body).ok).toBe(false));
});
