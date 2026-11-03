import {
  APP_VERSION,
  ERROR_CODE,
  HEADER_DELIVERY_ID,
  HEADER_SIGNATURE,
  HEADER_TIMESTAMP,
  MAX_BODY_BYTES,
} from 'src/constants/config';
import { parseEnvelope } from 'src/lib/envelope';
import type { DataGateway, SchemaProvider } from 'src/lib/gateway';
import { syncRecord } from 'src/lib/matching';
import type { CredentialStore, ReplayStore } from 'src/lib/stores';
import { verify } from 'src/lib/signatures';

export type HttpOutcome = { status: number; body: Record<string, unknown> };

export type HandlerDeps = {
  credentials: Pick<CredentialStore, 'load' | 'clear'>;
  replay: Pick<ReplayStore, 'firstSeen'>;
  gateway: DataGateway;
  schema: SchemaProvider;
  workspaceId: string | undefined;
  nowSeconds: () => number;
};

const error = (status: number, code: string, message: string): HttpOutcome => ({
  status,
  body: { error_code: code, message },
});

// The workspace schema could not be read (for example the app's role cannot see it). The reason is logged
// without any record data; the caller gets a fixed message instead of an empty 500.
const loadSchema = async (deps: HandlerDeps) => {
  try {
    return await deps.schema.load();
  } catch (e) {
    console.warn(`1eye schema read failed: ${e instanceof Error ? e.message.slice(0, 200) : 'unknown error'}`);
    return null;
  }
};

const schemaUnavailable = (): HttpOutcome => error(502, ERROR_CODE.validation, 'The workspace schema could not be read.');

// Every authentication failure is the same response, so a caller learns nothing about which part
// (signature, timestamp, installation) was wrong.
const unauthorized = (): HttpOutcome => error(401, ERROR_CODE.unauthorized, 'The request could not be verified.');

// handleRequest is the whole signed endpoint, independent of the SDK: it authenticates the request,
// then dispatches ping, describe_schema, sync and disconnect (CONTRACT.md).
export const handleRequest = async (
  req: { headers: Record<string, string | undefined>; rawBody: string | undefined },
  deps: HandlerDeps,
): Promise<HttpOutcome> => {
  // The signature covers the exact bytes; a runtime that did not keep them cannot be verified.
  if (typeof req.rawBody !== 'string' || req.rawBody === '') return unauthorized();
  if (Buffer.byteLength(req.rawBody, 'utf8') > MAX_BODY_BYTES) {
    return error(413, ERROR_CODE.executionLimit, 'The request is too large.');
  }

  const credentials = await deps.credentials.load();
  if (!credentials) return unauthorized(); // not connected (or disconnected): fail closed

  const failure = verify({
    secret: credentials.secret,
    timestamp: req.headers[HEADER_TIMESTAMP],
    signature: req.headers[HEADER_SIGNATURE],
    rawBody: req.rawBody,
    nowSeconds: deps.nowSeconds(),
  });
  if (failure) return unauthorized();

  const parsed = parseEnvelope(req.rawBody);
  if (!parsed.ok) return error(400, ERROR_CODE.validation, parsed.error);
  const { envelope } = parsed;
  if (envelope.installation_id !== credentials.installationId) return unauthorized();
  if (req.headers[HEADER_DELIVERY_ID] !== envelope.delivery_id) {
    return error(400, ERROR_CODE.validation, 'delivery id does not match the signed body');
  }
  if (!(await deps.replay.firstSeen(envelope.delivery_id))) {
    return error(409, ERROR_CODE.replay, 'This delivery was already processed.');
  }

  switch (envelope.action) {
    case 'ping':
      return {
        status: 200,
        body: {
          delivery_id: envelope.delivery_id,
          twenty_workspace_id: deps.workspaceId ?? '',
          installation_id: credentials.installationId,
          app_version: APP_VERSION,
        },
      };

    case 'describe_schema': {
      const schema = await loadSchema(deps);
      if (!schema) return schemaUnavailable();
      const publicFields = (fields: typeof schema.person) =>
        fields.map((f) => ({
          name: f.name,
          label: f.label,
          custom: f.custom,
          type: f.type,
          writable: f.writable,
          ...(f.multiselect ? { multiselect: true } : {}),
          ...(f.options ? { options: f.options.map((o) => o.label) } : {}),
        }));
      return {
        status: 200,
        body: { delivery_id: envelope.delivery_id, person: publicFields(schema.person), company: publicFields(schema.company) },
      };
    }

    case 'sync': {
      const schema = await loadSchema(deps);
      if (!schema) return schemaUnavailable();
      const results = [];
      // Sequential on purpose: companies are sent before the people that reference them, and
      // record-by-record keeps a failure isolated to its own result.
      for (const record of envelope.records) results.push(await syncRecord(deps.gateway, schema, record));
      return { status: 200, body: { delivery_id: envelope.delivery_id, status: 'completed', results } };
    }

    case 'disconnect':
      await deps.credentials.clear();
      return { status: 200, body: { delivery_id: envelope.delivery_id, status: 'disconnected' } };
  }
};
