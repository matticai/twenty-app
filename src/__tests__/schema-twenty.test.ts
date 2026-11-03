import { describe, expect, it } from 'vitest';

import { toSchemaField } from 'src/lib/schema-twenty';

const raw = (over: Record<string, unknown> = {}) => ({
  name: 'jobTitle', label: 'Job Title', type: 'TEXT',
  universalIdentifier: '20202020-aaaa-4aaa-8aaa-aaaaaaaaaaaa', isActive: true, isSystem: false, options: null,
  ...over,
}) as Parameters<typeof toSchemaField>[0];

describe('toSchemaField (shape of Twenty Cloud metadata)', () => {
  it('marks Twenty standard fields standard and app or user fields custom', () => {
    expect(toSchemaField(raw()).custom).toBe(false);
    expect(toSchemaField(raw({ universalIdentifier: '934a82d4-7bc5-46ee-87ce-280d41a080cb' })).custom).toBe(true);
  });

  it('is writable only when active, not system and of a supported type', () => {
    expect(toSchemaField(raw()).writable).toBe(true);
    expect(toSchemaField(raw({ isSystem: true })).writable).toBe(false);
    expect(toSchemaField(raw({ isActive: false })).writable).toBe(false);
    expect(toSchemaField(raw({ type: 'RELATION' })).writable).toBe(false);
    expect(toSchemaField(raw({ type: 'ACTOR' })).writable).toBe(false);
  });

  it('reports FULL_NAME as NAME and keeps select options with their values', () => {
    expect(toSchemaField(raw({ type: 'FULL_NAME', name: 'name' })).type).toBe('NAME');
    const s = toSchemaField(raw({ type: 'SELECT', options: [{ label: 'Senior', value: 'SENIOR' }] }));
    expect(s.options).toEqual([{ label: 'Senior', value: 'SENIOR' }]);
  });
});

describe('the schema query', () => {
  it('only asks for attributes the application token can read (never writability or isCustom)', async () => {
    const queries: unknown[] = [];
    const { MetadataSchemaProvider } = await import('src/lib/schema-twenty');
    const provider = new MetadataSchemaProvider({
      query: async (q: unknown) => (queries.push(q), { objects: { edges: [] } }),
    });
    await provider.load();
    const text = JSON.stringify(queries[0]);
    expect(text).not.toContain('writability');
    expect(text).not.toContain('isCustom');
    expect(text).toContain('universalIdentifier');
  });
});
