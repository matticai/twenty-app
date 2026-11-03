// The settings page talks to this app's own logic functions through the Twenty REST client, whose
// signature is post(path, body, options): the payload is the SECOND argument. Passing `{ body }`
// there type checks (the argument is `unknown`) but nests the payload one level too deep, so the
// function sees no fields. This helper is the one place that calls it, and it is tested.

export interface PostClient {
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
}

export const callFunction = <T>(client: PostClient, path: string, payload: Record<string, unknown> = {}): Promise<T> =>
  client.post<T>(`/s${path}`, payload);
