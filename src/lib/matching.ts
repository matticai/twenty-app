import { FIELD_COMPANY_ID, FIELD_PERSON_BUYER_ID, RESULT_STATUS } from 'src/constants/config';
import { convertData, type SchemaField } from 'src/lib/composite';
import type { SyncRecord } from 'src/lib/envelope';
import type { DataGateway, TwentyRecord } from 'src/lib/gateway';
import { normalizeDomain, normalizeEmail } from 'src/lib/identity';
import { ambiguous, failed, fieldUnsupported, ok, skipped, type RecordResult } from 'src/lib/results';

type Resolution = { kind: 'found'; record: TwentyRecord } | { kind: 'none' } | { kind: 'ambiguous' };

const one = (candidates: TwentyRecord[]): Resolution =>
  candidates.length === 0 ? { kind: 'none' } : candidates.length === 1 ? { kind: 'found', record: candidates[0]! } : { kind: 'ambiguous' };

const companyHasDomain = (record: TwentyRecord, domain: string): boolean =>
  normalizeDomain(record.domainName?.primaryLinkUrl) === domain;

const personEmails = (record: TwentyRecord): string[] => {
  const emails = record.emails ?? {};
  const all: unknown[] = [emails.primaryEmail, ...(Array.isArray(emails.additionalEmails) ? emails.additionalEmails : [])];
  return all.map((e) => normalizeEmail(typeof e === 'string' ? e : undefined)).filter((e): e is string => e !== null);
};

// Company identity, in order: the stored Twenty id (if it still exists), the 1eye id, the canonical
// domain. Never the name. More than one candidate at any step is an ambiguity, never a guess.
export const resolveCompany = async (gateway: DataGateway, identity: SyncRecord['identity']): Promise<Resolution> => {
  if (identity.twenty_id) {
    const record = await gateway.getCompany(identity.twenty_id);
    if (record) return { kind: 'found', record };
  }
  if (identity.oneeye_id) {
    const byId = await gateway.findCompaniesByOneeyeId(identity.oneeye_id);
    if (byId.length > 0) return one(byId);
  }
  const domain = normalizeDomain(identity.domain);
  if (domain) return one((await gateway.findCompaniesByDomain(domain)).filter((r) => companyHasDomain(r, domain)));
  return { kind: 'none' };
};

// Person identity, in order: stored Twenty id, the 1eye buyer id, the verified work email. Never
// the name or the job title.
export const resolvePerson = async (gateway: DataGateway, identity: SyncRecord['identity']): Promise<Resolution> => {
  if (identity.twenty_id) {
    const record = await gateway.getPerson(identity.twenty_id);
    if (record) return { kind: 'found', record };
  }
  if (identity.oneeye_id) {
    const byId = await gateway.findPeopleByOneeyeId(identity.oneeye_id);
    if (byId.length > 0) return one(byId);
  }
  const email = normalizeEmail(identity.email);
  if (email) return one((await gateway.findPeopleByEmail(email)).filter((r) => personEmails(r).includes(email)));
  return { kind: 'none' };
};

export const syncCompany = async (
  gateway: DataGateway,
  fields: SchemaField[],
  rec: SyncRecord,
): Promise<RecordResult> => {
  const resolution = await resolveCompany(gateway, rec.identity);
  if (resolution.kind === 'ambiguous') return ambiguous(rec.source_id);
  const existing = resolution.kind === 'found' ? resolution.record : null;

  // A record already linked to a different 1eye company is not ours to take over.
  if (existing && existing[FIELD_COMPANY_ID] && rec.identity.oneeye_id && existing[FIELD_COMPANY_ID] !== rec.identity.oneeye_id) {
    return ambiguous(rec.source_id);
  }

  const conversion = convertData(rec.data, fields, existing);
  if (conversion.unsupported) return fieldUnsupported(rec.source_id, conversion.unsupported);
  const values = conversion.values;
  if (rec.identity.oneeye_id && existing?.[FIELD_COMPANY_ID] !== rec.identity.oneeye_id) {
    values[FIELD_COMPANY_ID] = rec.identity.oneeye_id;
  }

  if (!existing) {
    if (!values.name) return skipped(rec.source_id, 'A company name is required to create a company.');
    const created = await gateway.createCompany(values);
    return ok(rec.source_id, RESULT_STATUS.created, created.id);
  }
  if (Object.keys(values).length === 0) return ok(rec.source_id, RESULT_STATUS.unchanged, existing.id);
  const updated = await gateway.updateCompany(existing.id, values);
  return ok(rec.source_id, RESULT_STATUS.updated, updated.id);
};

export const syncPerson = async (
  gateway: DataGateway,
  fields: SchemaField[],
  rec: SyncRecord,
): Promise<RecordResult> => {
  if (!rec.identity.twenty_id && !rec.identity.oneeye_id && !normalizeEmail(rec.identity.email)) {
    return skipped(rec.source_id, 'A verified work email is required to match a person.');
  }
  const resolution = await resolvePerson(gateway, rec.identity);
  if (resolution.kind === 'ambiguous') return ambiguous(rec.source_id);
  const existing = resolution.kind === 'found' ? resolution.record : null;

  const conversion = convertData(rec.data, fields, existing);
  if (conversion.unsupported) return fieldUnsupported(rec.source_id, conversion.unsupported);
  const values = conversion.values;
  if (rec.identity.oneeye_id && existing?.[FIELD_PERSON_BUYER_ID] !== rec.identity.oneeye_id) {
    values[FIELD_PERSON_BUYER_ID] = rec.identity.oneeye_id;
  }
  // Link the company only when the person has none: a person already attached to another company
  // keeps it (customer data), and a person without a resolved company is never attached to one.
  if (rec.company_twenty_id && !existing?.companyId) values.companyId = rec.company_twenty_id;

  if (!existing) {
    const email = normalizeEmail(rec.identity.email);
    const emailField = fields.find((f) => f.name === 'emails' && f.writable);
    if (!values.emails && email && emailField) values.emails = { primaryEmail: email, additionalEmails: [] };
    if (!values.emails) return skipped(rec.source_id, 'A verified work email is required to create a person.');
    const created = await gateway.createPerson(values);
    return ok(rec.source_id, RESULT_STATUS.created, created.id);
  }
  if (Object.keys(values).length === 0) return ok(rec.source_id, RESULT_STATUS.unchanged, existing.id);
  const updated = await gateway.updatePerson(existing.id, values);
  return ok(rec.source_id, RESULT_STATUS.updated, updated.id);
};

export const syncRecord = async (gateway: DataGateway, schema: { person: SchemaField[]; company: SchemaField[] }, rec: SyncRecord): Promise<RecordResult> => {
  try {
    return rec.record_type === 'company'
      ? await syncCompany(gateway, schema.company, rec)
      : await syncPerson(gateway, schema.person, rec);
  } catch (error) {
    // Only a fixed message leaves the function: errors can carry customer data or internals.
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    if (message.includes('permission') || message.includes('forbidden')) {
      return failed(rec.source_id, 'permission_denied', 'The 1eye app is not allowed to write this record.');
    }
    return failed(rec.source_id, 'validation', 'The record could not be written.');
  }
};
