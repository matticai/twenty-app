// The app's view of the workspace data it reads and writes. The production implementation sits on
// the generated, typed CoreApiClient (gateway-twenty.ts); tests use an in-memory one.

export type TwentyRecord = { id: string; [field: string]: any };

export interface DataGateway {
  getCompany(id: string): Promise<TwentyRecord | null>;
  findCompaniesByOneeyeId(oneeyeId: string): Promise<TwentyRecord[]>;
  /** Candidates that may carry the domain; the caller verifies each one. */
  findCompaniesByDomain(domain: string): Promise<TwentyRecord[]>;
  createCompany(values: Record<string, unknown>): Promise<TwentyRecord>;
  updateCompany(id: string, values: Record<string, unknown>): Promise<TwentyRecord>;

  getPerson(id: string): Promise<TwentyRecord | null>;
  findPeopleByOneeyeId(oneeyeId: string): Promise<TwentyRecord[]>;
  /** Candidates that may carry the email; the caller verifies each one. */
  findPeopleByEmail(email: string): Promise<TwentyRecord[]>;
  createPerson(values: Record<string, unknown>): Promise<TwentyRecord>;
  updatePerson(id: string, values: Record<string, unknown>): Promise<TwentyRecord>;
}

export interface SchemaProvider {
  load(): Promise<{ person: import('src/lib/composite').SchemaField[]; company: import('src/lib/composite').SchemaField[] }>;
}
