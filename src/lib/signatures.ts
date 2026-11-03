import { createHmac, timingSafeEqual } from 'node:crypto';

import { MAX_CLOCK_SKEW_SECONDS } from 'src/constants/config';

// signature = hex HMAC-SHA256(secret, timestamp + "." + rawBody). Identical to the 1eye backend's
// pkgtwenty.Sign; the body is the exact bytes received and is never re-serialized.
export const sign = (secret: string, timestamp: string, rawBody: string): string =>
  createHmac('sha256', secret)
    .update(timestamp)
    .update('.')
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('hex');

export type VerifyFailure = 'missing_signature' | 'bad_timestamp' | 'bad_signature';

export const verify = (input: {
  secret: string;
  timestamp: string | undefined;
  signature: string | undefined;
  rawBody: string;
  nowSeconds: number;
}): VerifyFailure | null => {
  if (!input.signature) return 'missing_signature';
  if (!input.timestamp || !/^\d{1,15}$/.test(input.timestamp)) return 'bad_timestamp';
  if (Math.abs(input.nowSeconds - Number(input.timestamp)) > MAX_CLOCK_SKEW_SECONDS) {
    return 'bad_timestamp';
  }
  if (!/^[0-9a-f]+$/i.test(input.signature)) return 'bad_signature';
  const got = Buffer.from(input.signature, 'hex');
  const want = Buffer.from(sign(input.secret, input.timestamp, input.rawBody), 'hex');
  if (got.length !== want.length || !timingSafeEqual(got, want)) return 'bad_signature';
  return null;
};
