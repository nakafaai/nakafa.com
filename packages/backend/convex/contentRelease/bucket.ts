import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";

const HASH_PREFIX = "sha256:";
const BUCKET_LENGTH = 3;
const BUCKET_PATTERN = /^[a-f\d]{3}$/;
const MAXIMUM_HEAD_READS_PER_ROUTE = 6;

/** Maximum deterministic hash buckets addressable by one content family. */
export const CONTENT_BUCKET_LIMIT = 16 ** BUCKET_LENGTH;

/** Conservative route count fitting one verified Convex read transaction. */
export const CONTENT_BUCKET_SIZE = Math.floor(
  (TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM) /
    (MAXIMUM_HEAD_READS_PER_ROUTE * READ_MODEL_DOCUMENT_LIMIT)
);

/** Derives one stable discovery bucket from an authenticated SHA-256 hash. */
export function getHashBucket(hash: string) {
  if (!hash.startsWith(HASH_PREFIX)) {
    return null;
  }
  const bucket = hash.slice(
    HASH_PREFIX.length,
    HASH_PREFIX.length + BUCKET_LENGTH
  );
  return isProjectionBucket(bucket) ? bucket : null;
}

/** Checks one externally supplied discovery bucket before indexed lookup. */
export function isProjectionBucket(bucket: string) {
  return BUCKET_PATTERN.test(bucket);
}
