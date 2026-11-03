import { ERROR_CODE, RESULT_STATUS, type ResultStatus } from 'src/constants/config';

export type RecordResult = {
  source_id: string;
  status: ResultStatus;
  provider_record_id?: string;
  url?: string;
  error_code?: string;
  message?: string;
};

export const ok = (sourceId: string, status: ResultStatus, providerRecordId: string): RecordResult => ({
  source_id: sourceId,
  status,
  provider_record_id: providerRecordId,
});

// Messages are short and fixed: never customer data, never raw errors.
export const failed = (sourceId: string, errorCode: string, message: string): RecordResult => ({
  source_id: sourceId,
  status: RESULT_STATUS.failed,
  error_code: errorCode,
  message,
});

export const ambiguous = (sourceId: string): RecordResult =>
  failed(sourceId, ERROR_CODE.ambiguousMatch, 'More than one existing record matches.');

export const fieldUnsupported = (sourceId: string, fieldName: string): RecordResult =>
  failed(sourceId, ERROR_CODE.fieldUnsupported, `Field '${fieldName}' is not available in this workspace.`);

export const skipped = (sourceId: string, message: string): RecordResult => ({
  source_id: sourceId,
  status: RESULT_STATUS.skipped,
  error_code: ERROR_CODE.validation,
  message,
});
