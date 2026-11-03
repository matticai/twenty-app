import { describe, expect, it } from 'vitest';

import { MemoryGateway, companyFields, personFields } from 'src/__tests__/fakes';
import type { SyncRecord } from 'src/lib/envelope';
import { syncCompany, syncPerson } from 'src/lib/matching';

const company = (over: Partial<SyncRecord> = {}): SyncRecord => ({
  record_type: 'company', source_id: 'com_1', operation: 'upsert',
  identity: { oneeye_id: 'com_1', domain: 'acme.com' },
  data: { name: 'Acme', domainName: 'https://acme.com' }, ...over,
});
const person = (over: Partial<SyncRecord> = {}): SyncRecord => ({
  record_type: 'person', source_id: 'con_1', operation: 'upsert',
  identity: { oneeye_id: 'con_1', email: 'jane@acme.com' },
  data: { name: { first_name: 'Jane', last_name: 'Doe' }, emails: { primary: 'jane@acme.com' } }, ...over,
});

describe('company matching', () => {
  it('creates a new company and stamps the 1eye id', async () => {
    const gw = new MemoryGateway();
    const res = await syncCompany(gw, companyFields, company());
    expect(res.status).toBe('created');
    expect(gw.companies.get(res.provider_record_id!)?.oneeyeCompanyId).toBe('com_1');
  });

  it('reuses an existing company by domain instead of creating a duplicate, and adopts it', async () => {
    const gw = new MemoryGateway();
    const existing = gw.addCompany({ name: 'Acme Inc', domainName: { primaryLinkUrl: 'https://www.acme.com' } });
    const res = await syncCompany(gw, companyFields, company());
    expect(res.status).toBe('updated');
    expect(res.provider_record_id).toBe(existing.id);
    expect(gw.companies.size).toBe(1);
    expect(gw.companies.get(existing.id)?.oneeyeCompanyId).toBe('com_1');
  });

  it('prefers the stored twenty id, then the 1eye id, and is unchanged on repeat', async () => {
    const gw = new MemoryGateway();
    const first = await syncCompany(gw, companyFields, company());
    const again = await syncCompany(gw, companyFields, company({ identity: { twenty_id: first.provider_record_id, oneeye_id: 'com_1', domain: 'acme.com' } }));
    expect(again.status).toBe('unchanged');
    expect(gw.writes).toBe(1);
    const byOneeyeId = await syncCompany(gw, companyFields, company({ identity: { oneeye_id: 'com_1' } }));
    expect(byOneeyeId.provider_record_id).toBe(first.provider_record_id);
  });

  it('re-resolves a deleted mapped company by identity, never blindly recreating', async () => {
    const gw = new MemoryGateway();
    const live = gw.addCompany({ name: 'Acme', oneeyeCompanyId: 'com_1', domainName: { primaryLinkUrl: 'https://acme.com' } });
    const res = await syncCompany(gw, companyFields, company({ identity: { twenty_id: 'gone', oneeye_id: 'com_1', domain: 'acme.com' } }));
    expect(res.provider_record_id).toBe(live.id);
    expect(gw.companies.size).toBe(1);
  });

  it('fails as ambiguous, writing nothing, when several companies share the domain', async () => {
    const gw = new MemoryGateway();
    gw.addCompany({ name: 'A', domainName: { primaryLinkUrl: 'https://acme.com' } });
    gw.addCompany({ name: 'B', domainName: { primaryLinkUrl: 'https://www.acme.com/x' } });
    const res = await syncCompany(gw, companyFields, company());
    expect(res.status).toBe('failed');
    expect(res.error_code).toBe('ambiguous_match');
    expect(gw.writes).toBe(0);
  });

  it('does not match a look-alike domain', async () => {
    const gw = new MemoryGateway();
    gw.addCompany({ name: 'Other', domainName: { primaryLinkUrl: 'https://acme.org' } });
    const res = await syncCompany(gw, companyFields, company());
    expect(res.status).toBe('created');
    expect(gw.companies.size).toBe(2);
  });

  it('never takes over a company already linked to a different 1eye company', async () => {
    const gw = new MemoryGateway();
    gw.addCompany({ name: 'Acme', oneeyeCompanyId: 'com_OTHER', domainName: { primaryLinkUrl: 'https://acme.com' } });
    const res = await syncCompany(gw, companyFields, company());
    expect(res.status).toBe('failed');
    expect(res.error_code).toBe('ambiguous_match');
  });

  it('refuses to create a company without a name', async () => {
    const res = await syncCompany(new MemoryGateway(), companyFields, company({ data: { domainName: 'https://acme.com' } }));
    expect(res.status).toBe('skipped');
  });

  it('reports an unavailable field instead of ignoring it', async () => {
    const res = await syncCompany(new MemoryGateway(), companyFields, company({ data: { name: 'Acme', favouriteColour: 'blue' } }));
    expect(res.status).toBe('failed');
    expect(res.error_code).toBe('field_unsupported');
  });
});

describe('person matching', () => {
  it('creates a person linked to the resolved company', async () => {
    const gw = new MemoryGateway();
    const res = await syncPerson(gw, personFields, person({ company_twenty_id: 'tw-company-1' }));
    expect(res.status).toBe('created');
    const stored = gw.people.get(res.provider_record_id!)!;
    expect(stored.companyId).toBe('tw-company-1');
    expect(stored.oneeyeBuyerId).toBe('con_1');
  });

  it('matches an existing person by verified email and keeps their other emails', async () => {
    const gw = new MemoryGateway();
    const existing = gw.addPerson({ name: { firstName: 'Jane', lastName: 'Doe' }, emails: { primaryEmail: 'jane@old.com', additionalEmails: ['JANE@acme.com'] }, jobTitle: 'CEO' });
    const res = await syncPerson(gw, personFields, person({ data: { name: { first_name: 'Jane', last_name: 'Doe' }, emails: { primary: 'jane@acme.com' } } }));
    expect(res.provider_record_id).toBe(existing.id);
    expect(gw.people.size).toBe(1);
    const stored = gw.people.get(existing.id)!;
    expect(stored.emails.primaryEmail).toBe('jane@old.com');
    expect(stored.jobTitle).toBe('CEO'); // untouched customer field
  });

  it('never matches by name alone and never accepts a look-alike email', async () => {
    const gw = new MemoryGateway();
    gw.addPerson({ name: { firstName: 'Jane', lastName: 'Doe' }, emails: { primaryEmail: 'jane@other.com' } });
    const res = await syncPerson(gw, personFields, person());
    expect(res.status).toBe('created');
    expect(gw.people.size).toBe(2);
  });

  it('fails as ambiguous when two people share the email', async () => {
    const gw = new MemoryGateway();
    gw.addPerson({ emails: { primaryEmail: 'jane@acme.com' } });
    gw.addPerson({ emails: { primaryEmail: 'x@y.com', additionalEmails: ['jane@acme.com'] } });
    const res = await syncPerson(gw, personFields, person());
    expect(res.error_code).toBe('ambiguous_match');
    expect(gw.writes).toBe(0);
  });

  it('keeps an existing company link and never attaches a person with no resolved company', async () => {
    const gw = new MemoryGateway();
    const existing = gw.addPerson({ emails: { primaryEmail: 'jane@acme.com' }, companyId: 'tw-company-A' });
    await syncPerson(gw, personFields, person({ company_twenty_id: 'tw-company-B' }));
    expect(gw.people.get(existing.id)?.companyId).toBe('tw-company-A');
    const created = await syncPerson(gw, personFields, person({ identity: { oneeye_id: 'con_2', email: 'new@acme.com' }, data: { emails: { primary: 'new@acme.com' }, name: { first_name: 'N', last_name: 'P' } } }));
    expect(gw.people.get(created.provider_record_id!)?.companyId).toBeUndefined();
  });

  it('skips a person with no identity to match on', async () => {
    const res = await syncPerson(new MemoryGateway(), personFields, person({ identity: {} }));
    expect(res.status).toBe('skipped');
  });

  it('is unchanged on a repeat and updates only what changed', async () => {
    const gw = new MemoryGateway();
    const first = await syncPerson(gw, personFields, person());
    expect((await syncPerson(gw, personFields, person({ identity: { twenty_id: first.provider_record_id, oneeye_id: 'con_1', email: 'jane@acme.com' } }))).status).toBe('unchanged');
    const changed = await syncPerson(gw, personFields, person({ data: { name: { first_name: 'Janet', last_name: 'Doe' }, emails: { primary: 'jane@acme.com' } } }));
    expect(changed.status).toBe('updated');
    expect(gw.people.get(first.provider_record_id!)?.name.firstName).toBe('Janet');
  });
});
