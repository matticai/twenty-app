// Values that must stay in step with the 1eye backend (core-lib pkg/twenty, CONTRACT.md).

export const SCHEMA_VERSION = '1.0';
export const APP_VERSION = '0.1.0';

export const HEADER_TIMESTAMP = 'x-1eye-timestamp';
export const HEADER_DELIVERY_ID = 'x-1eye-delivery-id';
export const HEADER_SIGNATURE = 'x-1eye-signature';

// The path of the signed sync function; the function registers it and pairing reports it to 1eye.
export const SYNC_ROUTE_PATH = '/1eye/sync';

export const MAX_CLOCK_SKEW_SECONDS = 300;
export const MAX_RECORDS_PER_REQUEST = 50;
export const MAX_BODY_BYTES = 256 * 1024;

export const ACTIONS = ['ping', 'describe_schema', 'sync', 'disconnect'] as const;
export type Action = (typeof ACTIONS)[number];

export const RECORD_TYPES = ['company', 'person'] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const RESULT_STATUS = {
  created: 'created',
  updated: 'updated',
  unchanged: 'unchanged',
  skipped: 'skipped',
  failed: 'failed',
} as const;
export type ResultStatus = (typeof RESULT_STATUS)[keyof typeof RESULT_STATUS];

export const ERROR_CODE = {
  ambiguousMatch: 'ambiguous_match',
  fieldUnsupported: 'field_unsupported',
  permissionDenied: 'permission_denied',
  creditsExhausted: 'credits_exhausted',
  executionLimit: 'execution_limit',
  notFound: 'not_found',
  validation: 'validation',
  unauthorized: 'unauthorized',
  replay: 'replay',
} as const;

// Persisted state (key-value store, workspace scope).
export const KV_CREDENTIALS = 'oneeye:credentials';
export const KV_CONNECTION = 'oneeye:connection';
export const KV_REPLAY_PREFIX = 'oneeye:replay:';

// The replay window is two clock-skew windows; ids are bucketed so old ones can be dropped.
export const REPLAY_BUCKET_SECONDS = 300;
export const REPLAY_BUCKETS_KEPT = 4;

// The names of the 1eye-owned custom fields the app installs.
export const FIELD_PERSON_BUYER_ID = 'oneeyeBuyerId';
export const FIELD_COMPANY_ID = 'oneeyeCompanyId';
