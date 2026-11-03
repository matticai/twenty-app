import { randomUUID } from 'node:crypto';

import type { SchemaField } from 'src/lib/composite';
import type { DataGateway, SchemaProvider, TwentyRecord } from 'src/lib/gateway';
import type { KeyValue } from 'src/lib/stores';

export class MemoryKv implements KeyValue {
  readonly data = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | null> {
    return (this.data.has(key) ? (this.data.get(key) as T) : null);
  }
  async set<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
  }
  async delete(key: string): Promise<boolean> {
    return this.data.delete(key);
  }
}

export const personFields: SchemaField[] = [
  { name: 'name', label: 'Name', custom: false, type: 'NAME', writable: true },
  { name: 'emails', label: 'Emails', custom: false, type: 'EMAILS', writable: true },
  { name: 'phones', label: 'Phones', custom: false, type: 'PHONES', writable: true },
  { name: 'jobTitle', label: 'Job Title', custom: false, type: 'TEXT', writable: true },
  { name: 'createdBy', label: 'Created by', custom: false, type: 'TEXT', writable: false },
  {
    name: 'seniority', label: 'Seniority', custom: true, type: 'SELECT', writable: true,
    options: [{ label: 'Junior', value: 'JUNIOR' }, { label: 'Senior', value: 'SENIOR' }],
  },
  { name: 'oneeyeBuyerId', label: '1eye Buyer ID', custom: true, type: 'TEXT', writable: true },
];

export const companyFields: SchemaField[] = [
  { name: 'name', label: 'Name', custom: false, type: 'TEXT', writable: true },
  { name: 'domainName', label: 'Domain', custom: false, type: 'LINKS', writable: true },
  { name: 'linkedinLink', label: 'LinkedIn', custom: false, type: 'LINKS', writable: true },
  { name: 'employees', label: 'Employees', custom: false, type: 'NUMBER', writable: true },
  { name: 'address', label: 'Address', custom: false, type: 'ADDRESS', writable: true },
  { name: 'oneeyeCompanyId', label: '1eye Company ID', custom: true, type: 'TEXT', writable: true },
];

export const fixedSchema: SchemaProvider = {
  load: async () => ({ person: personFields, company: companyFields }),
};

// An in-memory workspace. Candidate searches are deliberately loose (substring), like a real
// search backend, so the code under test has to verify candidates itself.
export class MemoryGateway implements DataGateway {
  readonly companies = new Map<string, TwentyRecord>();
  readonly people = new Map<string, TwentyRecord>();
  writes = 0;
  failWith: Error | null = null;

  private guard() {
    if (this.failWith) throw this.failWith;
  }
  addCompany(values: Record<string, unknown>): TwentyRecord {
    const r = { id: randomUUID(), ...values };
    this.companies.set(r.id, r);
    return r;
  }
  addPerson(values: Record<string, unknown>): TwentyRecord {
    const r = { id: randomUUID(), ...values };
    this.people.set(r.id, r);
    return r;
  }
  async getCompany(id: string) { return this.companies.get(id) ?? null; }
  async findCompaniesByOneeyeId(id: string) { return [...this.companies.values()].filter((c) => c.oneeyeCompanyId === id); }
  async findCompaniesByDomain(domain: string) {
    return [...this.companies.values()].filter((c) => String(c.domainName?.primaryLinkUrl ?? '').includes(domain.split('.')[0]!));
  }
  async createCompany(values: Record<string, unknown>) { this.guard(); this.writes++; return this.addCompany(values); }
  async updateCompany(id: string, values: Record<string, unknown>) {
    this.guard(); this.writes++;
    const r = { ...this.companies.get(id)!, ...values };
    this.companies.set(id, r);
    return r;
  }
  async getPerson(id: string) { return this.people.get(id) ?? null; }
  async findPeopleByOneeyeId(id: string) { return [...this.people.values()].filter((p) => p.oneeyeBuyerId === id); }
  async findPeopleByEmail(email: string) {
    return [...this.people.values()].filter((p) => JSON.stringify(p.emails ?? {}).toLowerCase().includes(email.split('@')[0]!));
  }
  async createPerson(values: Record<string, unknown>) { this.guard(); this.writes++; return this.addPerson(values); }
  async updatePerson(id: string, values: Record<string, unknown>) {
    this.guard(); this.writes++;
    const r = { ...this.people.get(id)!, ...values };
    this.people.set(id, r);
    return r;
  }
}
