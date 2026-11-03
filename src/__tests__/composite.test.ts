import { describe, expect, it } from 'vitest';

import { companyFields, personFields } from 'src/__tests__/fakes';
import { contractType, convertData } from 'src/lib/composite';

describe('contractType', () => {
  it('calls FULL_NAME NAME, as the contract does', () => {
    expect(contractType('FULL_NAME')).toBe('NAME');
    expect(contractType('TEXT')).toBe('TEXT');
  });
});

describe('convertData: people', () => {
  it('builds the composite name, emails and a text field for a new person', () => {
    const { values, unsupported } = convertData(
      { name: { first_name: 'Jane', last_name: 'Doe' }, emails: { primary: 'jane@acme.com' }, jobTitle: 'VP Sales' },
      personFields,
      null,
    );
    expect(unsupported).toBeUndefined();
    expect(values).toEqual({
      name: { firstName: 'Jane', lastName: 'Doe' },
      emails: { primaryEmail: 'jane@acme.com', additionalEmails: [] },
      jobTitle: 'VP Sales',
    });
  });

  it('keeps existing emails and only adds a new one as additional', () => {
    const existing = { emails: { primaryEmail: 'jane@old.com', additionalEmails: ['j@home.com'] } };
    const { values } = convertData({ emails: { primary: 'jane@acme.com' } }, personFields, existing);
    expect(values.emails).toEqual({ primaryEmail: 'jane@old.com', additionalEmails: ['j@home.com', 'jane@acme.com'] });
  });

  it('does not touch emails that are already present (any casing, primary or additional)', () => {
    expect(convertData({ emails: { primary: 'JANE@acme.com' } }, personFields, { emails: { primaryEmail: 'jane@acme.com' } }).values).toEqual({});
    expect(convertData({ emails: { primary: 'jane@acme.com' } }, personFields, { emails: { primaryEmail: 'x@y.com', additionalEmails: ['jane@acme.com'] } }).values).toEqual({});
  });

  it('does not overwrite a customer phone number', () => {
    const existing = { phones: { primaryPhoneNumber: '+1 (555) 0100', additionalPhones: [] } };
    expect(convertData({ phones: { primary: '+15550100' } }, personFields, existing).values).toEqual({});
    const added = convertData({ phones: { primary: '+15550999' } }, personFields, existing).values.phones as any;
    expect(added.primaryPhoneNumber).toBe('+1 (555) 0100');
    expect(added.additionalPhones).toHaveLength(1);
  });

  it('is a no-op when nothing differs', () => {
    const existing = { name: { firstName: 'Jane', lastName: 'Doe' }, jobTitle: 'VP Sales' };
    const { values } = convertData({ name: { first_name: 'Jane', last_name: 'Doe' }, jobTitle: 'VP Sales' }, personFields, existing);
    expect(values).toEqual({});
  });

  it('maps a select label to its option value and rejects an unknown label', () => {
    expect(convertData({ seniority: 'senior' }, personFields, null).values).toEqual({ seniority: 'SENIOR' });
    expect(convertData({ seniority: 'Wizard' }, personFields, null).unsupported).toBe('seniority');
  });

  it('refuses unknown and read-only fields instead of dropping them silently', () => {
    expect(convertData({ nope: 'x' }, personFields, null).unsupported).toBe('nope');
    expect(convertData({ createdBy: 'x' }, personFields, null).unsupported).toBe('createdBy');
  });

  it('ignores the company relation key in data (it is written from company_twenty_id)', () => {
    expect(convertData({ company: 'ignored' }, personFields, null).values).toEqual({});
  });
});

describe('convertData: companies', () => {
  it('builds links, numbers and fills only empty address parts', () => {
    const { values } = convertData(
      { name: 'Acme', domainName: 'https://acme.com', employees: 250, address: { city: 'Austin', state: 'TX' } },
      companyFields,
      null,
    );
    expect(values.name).toBe('Acme');
    expect(values.domainName).toEqual({ primaryLinkUrl: 'https://acme.com', primaryLinkLabel: '', secondaryLinks: null });
    expect(values.employees).toBe(250);
    expect(values.address).toMatchObject({ addressCity: 'Austin', addressState: 'TX' });

    const existing = { address: { addressCity: 'Dallas', addressState: '' } };
    const merged = convertData({ address: { city: 'Austin', state: 'TX' } }, companyFields, existing).values.address as any;
    expect(merged.addressCity).toBe('Dallas'); // customer value kept
    expect(merged.addressState).toBe('TX'); // empty part filled
  });

  it('keeps a customer link and treats the same domain as unchanged', () => {
    expect(convertData({ linkedinLink: 'https://linkedin.com/company/acme' }, companyFields, { linkedinLink: { primaryLinkUrl: 'https://linkedin.com/company/other' } }).values).toEqual({});
    expect(convertData({ domainName: 'https://acme.com' }, companyFields, { domainName: { primaryLinkUrl: 'http://www.acme.com/' } }).values).toEqual({});
  });

  it('rejects a non-numeric number', () => {
    expect(convertData({ employees: 'many' }, companyFields, null).unsupported).toBe('employees');
  });
});
