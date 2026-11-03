// Converts the logical values the 1eye backend sends (CONTRACT.md) into the values Twenty stores,
// using the workspace's own field types. Composite shapes below follow Twenty's standard data
// model; spike E verifies them against the generated client types before release.
//
// The conversion also decides what actually changes: a key is only emitted when it differs from
// the existing record, and composite fields are merged conservatively so customer-entered data
// is never replaced or cleared.

import { normalizeDomain } from 'src/lib/identity';

export type FieldOption = { label: string; value: string };

export type SchemaField = {
  name: string;
  label: string;
  custom: boolean;
  /** Contract type: NAME, EMAILS, PHONES, LINKS, ADDRESS, TEXT, NUMBER, BOOLEAN, DATE_TIME, SELECT, ... */
  type: string;
  writable: boolean;
  multiselect?: boolean;
  options?: FieldOption[];
};

// Twenty's FULL_NAME is called NAME in the contract.
export const contractType = (twentyType: string): string => (twentyType === 'FULL_NAME' ? 'NAME' : twentyType);

type Existing = Record<string, any> | null | undefined;

export type Conversion = { values: Record<string, unknown>; unsupported?: string };

const isEmpty = (v: unknown): boolean => v === undefined || v === null || v === '';

const asRecord = (v: unknown): Record<string, any> => (typeof v === 'object' && v !== null ? (v as Record<string, any>) : {});

const digits = (s: string): string => s.replace(/\D/g, '');

const convertEmails = (logical: unknown, existing: Existing, name: string): unknown | undefined => {
  const primary = String(asRecord(logical).primary ?? '').trim();
  if (primary === '') return undefined;
  const current = asRecord(existing?.[name]);
  const additional: string[] = Array.isArray(current.additionalEmails) ? current.additionalEmails : [];
  const all = [current.primaryEmail, ...additional].filter((e): e is string => typeof e === 'string' && e !== '');
  if (all.some((e) => e.toLowerCase() === primary.toLowerCase())) return undefined;
  if (isEmpty(current.primaryEmail)) return { primaryEmail: primary, additionalEmails: additional };
  return { primaryEmail: current.primaryEmail, additionalEmails: [...additional, primary] };
};

const convertPhones = (logical: unknown, existing: Existing, name: string): unknown | undefined => {
  const primary = String(asRecord(logical).primary ?? '').trim();
  if (primary === '') return undefined;
  const current = asRecord(existing?.[name]);
  const additional: any[] = Array.isArray(current.additionalPhones) ? current.additionalPhones : [];
  const known = [current.primaryPhoneNumber, ...additional.map((p) => asRecord(p).number)]
    .filter((p): p is string => typeof p === 'string' && p !== '')
    .map(digits);
  if (known.includes(digits(primary))) return undefined;
  if (isEmpty(current.primaryPhoneNumber)) {
    return {
      primaryPhoneNumber: primary,
      primaryPhoneCountryCode: current.primaryPhoneCountryCode ?? '',
      primaryPhoneCallingCode: current.primaryPhoneCallingCode ?? '',
      additionalPhones: additional,
    };
  }
  return { ...current, additionalPhones: [...additional, { number: primary, countryCode: '', callingCode: '' }] };
};

const convertLinks = (logical: unknown, existing: Existing, name: string, field: SchemaField): unknown | undefined => {
  const url = String(logical ?? '').trim();
  if (url === '') return undefined;
  const current = asRecord(existing?.[name]);
  if (isEmpty(current.primaryLinkUrl)) return { primaryLinkUrl: url, primaryLinkLabel: '', secondaryLinks: current.secondaryLinks ?? null };
  // Same site (domain fields): nothing to do. A different existing link is customer data: keep it.
  if (name === 'domainName' && normalizeDomain(current.primaryLinkUrl) === normalizeDomain(url)) return undefined;
  void field;
  return undefined;
};

const ADDRESS_PARTS: Record<string, string> = {
  street: 'addressStreet1',
  city: 'addressCity',
  state: 'addressState',
  postal_code: 'addressPostcode',
  country: 'addressCountry',
};

const convertAddress = (logical: unknown, existing: Existing, name: string): unknown | undefined => {
  const parts = asRecord(logical);
  const current = asRecord(existing?.[name]);
  const next: Record<string, unknown> = { ...current };
  let changed = false;
  for (const [logicalKey, twentyKey] of Object.entries(ADDRESS_PARTS)) {
    const value = String(parts[logicalKey] ?? '').trim();
    if (value !== '' && isEmpty(current[twentyKey])) {
      next[twentyKey] = value;
      changed = true;
    }
  }
  return changed ? next : undefined;
};

const optionValue = (field: SchemaField, label: unknown): string | undefined => {
  const wanted = String(label ?? '').trim().toLowerCase();
  return field.options?.find((o) => o.label.toLowerCase() === wanted || o.value.toLowerCase() === wanted)?.value;
};

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// convertData turns the contract's logical values into the values to write for one record.
export const convertData = (
  data: Record<string, unknown>,
  fields: SchemaField[],
  existing: Existing,
): Conversion => {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const values: Record<string, unknown> = {};
  for (const [name, logical] of Object.entries(data)) {
    if (name === 'company') continue; // the relation is written from company_twenty_id, never from data
    const field = byName.get(name);
    if (!field || !field.writable) return { values: {}, unsupported: name };
    let converted: unknown | undefined;
    switch (field.type) {
      case 'NAME': {
        const n = asRecord(logical);
        const next = { firstName: String(n.first_name ?? ''), lastName: String(n.last_name ?? '') };
        const current = asRecord(existing?.[name]);
        converted = sameValue(next, { firstName: current.firstName ?? '', lastName: current.lastName ?? '' }) ? undefined : next;
        break;
      }
      case 'EMAILS':
        converted = convertEmails(logical, existing, name);
        break;
      case 'PHONES':
        converted = convertPhones(logical, existing, name);
        break;
      case 'LINKS':
        converted = convertLinks(logical, existing, name, field);
        break;
      case 'ADDRESS':
        converted = convertAddress(logical, existing, name);
        break;
      case 'TEXT':
      case 'RICH_TEXT':
        converted = isEmpty(logical) || existing?.[name] === String(logical) ? undefined : String(logical);
        break;
      case 'NUMBER': {
        const n = Number(logical);
        if (!Number.isFinite(n)) return { values: {}, unsupported: name };
        converted = existing?.[name] === n ? undefined : n;
        break;
      }
      case 'BOOLEAN':
        converted = typeof logical === 'boolean' && existing?.[name] !== logical ? logical : undefined;
        break;
      case 'DATE_TIME':
      case 'DATE':
        converted = isEmpty(logical) || existing?.[name] === logical ? undefined : String(logical);
        break;
      case 'SELECT': {
        const v = optionValue(field, logical);
        if (v === undefined) return { values: {}, unsupported: name };
        converted = existing?.[name] === v ? undefined : v;
        break;
      }
      case 'MULTI_SELECT': {
        const labels = Array.isArray(logical) ? logical : [logical];
        const vals = labels.map((l) => optionValue(field, l));
        if (vals.length === 0 || vals.some((v) => v === undefined)) return { values: {}, unsupported: name };
        converted = sameValue(existing?.[name], vals) ? undefined : vals;
        break;
      }
      default:
        return { values: {}, unsupported: name };
    }
    if (converted !== undefined) values[name] = converted;
  }
  return { values };
};
