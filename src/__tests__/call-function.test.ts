import { describe, expect, it } from 'vitest';

import { callFunction, type PostClient } from 'src/lib/call-function';

describe('callFunction', () => {
  it('sends the payload as the request body, not nested under "body"', async () => {
    const calls: Array<{ path: string; body: unknown }> = [];
    const client: PostClient = { post: async (path, body) => (calls.push({ path, body }), {} as never) };
    await callFunction(client, '/1eye/pair', { code: 'abc', workspaceUrl: 'https://x.example.com' });
    expect(calls).toEqual([{ path: '/s/1eye/pair', body: { code: 'abc', workspaceUrl: 'https://x.example.com' } }]);
  });

  it('sends an empty object when there is no payload', async () => {
    let seen: unknown;
    await callFunction({ post: async (_p, body) => ((seen = body), {} as never) }, '/1eye/status');
    expect(seen).toEqual({});
  });
});
