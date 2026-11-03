// Describes the writable People/Companies fields of this workspace for describe_schema and for
// converting values. Read from the workspace metadata (MetadataApiClient), never hardcoded.
//
// The metadata API does not serve every field to every caller: a user's token sees `writability` on a Field,
// the application's token does not ("Cannot query field writability on type Field"). This query runs as the
// app, so it asks only for fields the app can read, and writability is decided from isActive, isSystem and the
// supported types. `yarn`-side checks run as a user, so use the oneeye-diagnose function to test what the app sees.

import { MetadataApiClient } from 'twenty-client-sdk/metadata';

import { contractType, type SchemaField } from 'src/lib/composite';
import type { SchemaProvider } from 'src/lib/gateway';

// Types the conversion can write. Anything else (relations, rating, ...) is reported read-only so a
// mapping to it is refused with a clear message instead of failing at write time.
const WRITABLE_TYPES = new Set([
  'TEXT', 'RICH_TEXT', 'NUMBER', 'BOOLEAN', 'DATE_TIME', 'DATE', 'SELECT', 'MULTI_SELECT',
  'NAME', 'EMAILS', 'PHONES', 'LINKS', 'ADDRESS',
]);

const FIELD_QUERY = {
  objects: {
    __args: { paging: { first: 100 } },
    edges: {
      node: {
        nameSingular: true,
        fields: {
          __args: { paging: { first: 200 } },
          edges: { node: { name: true, label: true, type: true, universalIdentifier: true, isActive: true, isSystem: true, options: true } },
        },
      },
    },
  },
};

type RawField = {
  name: string;
  label: string;
  type: string;
  universalIdentifier: string;
  isActive: boolean;
  isSystem: boolean;
  options?: Array<{ label: string; value: string }> | null;
};

// Twenty's own fields carry universal identifiers with this prefix; everything else is custom (including
// the fields apps add).
const STANDARD_FIELD_PREFIX = '20202020-';

export const toSchemaField = (raw: RawField): SchemaField => {
  const type = contractType(raw.type);
  return {
    name: raw.name,
    label: raw.label,
    custom: !raw.universalIdentifier.startsWith(STANDARD_FIELD_PREFIX),
    type,
    writable: raw.isActive && !raw.isSystem && WRITABLE_TYPES.has(type),
    ...(type === 'MULTI_SELECT' ? { multiselect: true } : {}),
    ...(raw.options ? { options: raw.options.map((o) => ({ label: o.label, value: o.value })) } : {}),
  };
};

export class MetadataSchemaProvider implements SchemaProvider {
  private readonly client: any;

  constructor(client: unknown = new MetadataApiClient({ runAs: 'application' } as never)) {
    this.client = client;
  }

  /** The names of the fields the app's own token can query on a Field, for diagnosing schema errors. */
  async introspectFieldNames(): Promise<string[]> {
    const res = await this.client.query({ __type: { __args: { name: 'Field' }, fields: { name: true } } });
    return ((res.__type?.fields ?? []) as Array<{ name: string }>).map((f) => f.name);
  }

  async load() {
    const res = await this.client.query(FIELD_QUERY);
    const objects = (res.objects?.edges ?? []).map((e: any) => e.node) as Array<{ nameSingular: string; fields: { edges: Array<{ node: RawField }> } }>;
    const fieldsOf = (name: string): SchemaField[] =>
      (objects.find((o) => o.nameSingular === name)?.fields.edges ?? []).map((e) => toSchemaField(e.node));
    return { person: fieldsOf('person'), company: fieldsOf('company') };
  }
}
