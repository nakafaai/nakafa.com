import { CONTENT_BUCKET_SIZE } from "@repo/backend/confect/contentRelease/bucket";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/confect/contentRelease/document";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/confect/contentRelease/spec";

/** Maximum lesson sections returned for one localized material group. */
export const MATERIAL_GROUP_LIMIT = 100;

/** Each bucket reads its count and at most one overflow catalog row.
 * Material discovery verifies catalog bytes without reopening content heads.
 * Reserve the remaining transaction budget for publication ownership. */
export const MATERIAL_SITEMAP_BUCKET_LIMIT = Math.floor(
  (TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM) /
    ((CONTENT_BUCKET_SIZE + 2) * READ_MODEL_DOCUMENT_LIMIT)
);
