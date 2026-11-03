import {
  ACTIONS,
  MAX_RECORDS_PER_REQUEST,
  RECORD_TYPES,
  SCHEMA_VERSION,
  type Action,
  type RecordType,
} from 'src/constants/config';

export type Identity = {
  twenty_id?: string;
  oneeye_id?: string;
  domain?: string;
  email?: string;
};

export type SyncRecord = {
  record_type: RecordType;
  source_id: string;
  operation: 'upsert';
  identity: Identity;
  company_twenty_id?: string;
  data: Record<string, unknown>;
};

export type Envelope = {
  schema_version: string;
  delivery_id: string;
  installation_id: string;
  action: Action;
  records: SyncRecord[];
};

export type ParseResult = { ok: true; envelope: Envelope } | { ok: false; error: string };

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const optionalString = (v: unknown): string | undefined | null =>
  v === undefined || v === null || v === '' ? undefined : typeof v === 'string' ? v : null;

const parseIdentity = (raw: unknown): Identity | null => {
  if (!isObject(raw)) return null;
  const out: Identity = {};
  for (const key of ['twenty_id', 'oneeye_id', 'domain', 'email'] as const) {
    const v = optionalString(raw[key]);
    if (v === null) return null;
    if (v !== undefined) out[key] = v;
  }
  return out;
};

const parseRecord = (raw: unknown): SyncRecord | string => {
  if (!isObject(raw)) return 'record must be an object';
  if (!(RECORD_TYPES as readonly unknown[]).includes(raw.record_type)) return 'unknown record_type';
  if (typeof raw.source_id !== 'string' || raw.source_id === '') return 'source_id is required';
  if (raw.operation !== 'upsert') return 'unsupported operation';
  const identity = parseIdentity(raw.identity);
  if (!identity) return 'invalid identity';
  const company = optionalString(raw.company_twenty_id);
  if (company === null) return 'invalid company_twenty_id';
  if (!isObject(raw.data)) return 'data must be an object';
  return {
    record_type: raw.record_type as RecordType,
    source_id: raw.source_id,
    operation: 'upsert',
    identity,
    ...(company ? { company_twenty_id: company } : {}),
    data: raw.data,
  };
};

// parseEnvelope validates the signed request body. The minor version may grow; the major must match.
export const parseEnvelope = (rawBody: string): ParseResult => {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return { ok: false, error: 'body is not valid JSON' };
  }
  if (!isObject(json)) return { ok: false, error: 'body must be an object' };
  if (typeof json.schema_version !== 'string' || json.schema_version.split('.')[0] !== SCHEMA_VERSION.split('.')[0]) {
    return { ok: false, error: 'unsupported schema_version' };
  }
  if (typeof json.delivery_id !== 'string' || json.delivery_id === '') return { ok: false, error: 'delivery_id is required' };
  if (typeof json.installation_id !== 'string' || json.installation_id === '') return { ok: false, error: 'installation_id is required' };
  if (!(ACTIONS as readonly unknown[]).includes(json.action)) return { ok: false, error: 'unknown action' };

  const rawRecords = json.records === undefined || json.records === null ? [] : json.records;
  if (!Array.isArray(rawRecords)) return { ok: false, error: 'records must be an array' };
  if (rawRecords.length > MAX_RECORDS_PER_REQUEST) return { ok: false, error: 'too many records' };
  const records: SyncRecord[] = [];
  for (const raw of rawRecords) {
    const parsed = parseRecord(raw);
    if (typeof parsed === 'string') return { ok: false, error: parsed };
    records.push(parsed);
  }
  return {
    ok: true,
    envelope: {
      schema_version: json.schema_version,
      delivery_id: json.delivery_id,
      installation_id: json.installation_id,
      action: json.action as Action,
      records,
    },
  };
};
