// Production DataGateway on the typed CoreApiClient (runs as the application's own role).
//
// The query and mutation shapes below were checked against the schema generated from a real
// Twenty server (people/companies take `first` and `filter`; createX takes `data`; updateX takes
// `id` and `data`; additionalEmails accepts a JSON `ilike` filter). The client is held loosely
// because its generated types change with each workspace; they are exercised live, not by unit tests.

import { CoreApiClient } from 'twenty-client-sdk/core';

import { FIELD_COMPANY_ID, FIELD_PERSON_BUYER_ID } from 'src/constants/config';
import type { DataGateway, TwentyRecord } from 'src/lib/gateway';

const LINKS = { primaryLinkUrl: true, primaryLinkLabel: true, secondaryLinks: true };
const ADDRESS = {
  addressStreet1: true, addressStreet2: true, addressCity: true,
  addressState: true, addressPostcode: true, addressCountry: true,
};

const COMPANY_NODE = {
  id: true, name: true, domainName: LINKS, linkedinLink: LINKS, employees: true, address: ADDRESS, [FIELD_COMPANY_ID]: true,
};
const PERSON_NODE = {
  id: true,
  name: { firstName: true, lastName: true },
  emails: { primaryEmail: true, additionalEmails: true },
  phones: { primaryPhoneNumber: true, primaryPhoneCountryCode: true, primaryPhoneCallingCode: true, additionalPhones: true },
  jobTitle: true, companyId: true, [FIELD_PERSON_BUYER_ID]: true,
};

// Searches return a small page; the matching code verifies every candidate, so a loose search is safe.
const PAGE = 10;

export class CoreApiGateway implements DataGateway {
  private readonly client: any;

  constructor(client: unknown = new CoreApiClient({ runAs: 'application' })) {
    this.client = client;
  }

  private async list(collection: 'companies' | 'people', node: object, filter: object): Promise<TwentyRecord[]> {
    const res = await this.client.query({ [collection]: { __args: { filter, first: PAGE }, edges: { node } } });
    return ((res[collection]?.edges ?? []) as Array<{ node: TwentyRecord }>).map((e) => e.node);
  }

  private async one(collection: 'companies' | 'people', node: object, id: string): Promise<TwentyRecord | null> {
    return (await this.list(collection, node, { id: { eq: id } }))[0] ?? null;
  }

  getCompany(id: string) { return this.one('companies', COMPANY_NODE, id); }
  getPerson(id: string) { return this.one('people', PERSON_NODE, id); }

  findCompaniesByOneeyeId(oneeyeId: string) {
    return this.list('companies', COMPANY_NODE, { [FIELD_COMPANY_ID]: { eq: oneeyeId } });
  }
  findCompaniesByDomain(domain: string) {
    return this.list('companies', COMPANY_NODE, { domainName: { primaryLinkUrl: { ilike: `%${escapeLike(domain)}%` } } });
  }
  findPeopleByOneeyeId(oneeyeId: string) {
    return this.list('people', PERSON_NODE, { [FIELD_PERSON_BUYER_ID]: { eq: oneeyeId } });
  }
  findPeopleByEmail(email: string) {
    // The primary address and the additional addresses (a JSON array, filtered as text) are both
    // searched; the matching code then verifies each candidate's real addresses.
    const pattern = `%${escapeLike(email)}%`;
    return this.list('people', PERSON_NODE, {
      or: [{ emails: { primaryEmail: { ilike: pattern } } }, { emails: { additionalEmails: { ilike: pattern } } }],
    });
  }

  async createCompany(values: Record<string, unknown>) {
    const res = await this.client.mutation({ createCompany: { __args: { data: values }, id: true } });
    return { id: res.createCompany.id as string, ...values };
  }
  async updateCompany(id: string, values: Record<string, unknown>) {
    await this.client.mutation({ updateCompany: { __args: { id, data: values }, id: true } });
    return { id, ...values };
  }
  async createPerson(values: Record<string, unknown>) {
    const res = await this.client.mutation({ createPerson: { __args: { data: values }, id: true } });
    return { id: res.createPerson.id as string, ...values };
  }
  async updatePerson(id: string, values: Record<string, unknown>) {
    await this.client.mutation({ updatePerson: { __args: { id, data: values }, id: true } });
    return { id, ...values };
  }
}

// escapeLike keeps % and _ in a customer-supplied value from acting as wildcards.
export const escapeLike = (value: string): string => value.replace(/[\\%_]/g, (c) => `\\${c}`);
