import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import { READ_MODEL_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";

/** Maximum permanent material identities rebuilt by one baseline mutation. */
export const MATERIAL_BASELINE_LIMIT = 8;

/** Worst-case catalog, head, route, and existing-row reads per identity. */
export const MATERIAL_IDENTITY_READ_LIMIT = 6;

/** Maximum lesson sections returned for one localized material group. */
export const MATERIAL_GROUP_LIMIT = 100;

/** Each bucket reads its count and at most one overflow catalog row.
 * Material discovery verifies catalog bytes without reopening content heads.
 * Reserve the remaining transaction budget for publication ownership. */
export const MATERIAL_SITEMAP_BUCKET_LIMIT = Math.floor(
  (TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM) /
    ((CONTENT_BUCKET_SIZE + 2) * READ_MODEL_DOCUMENT_LIMIT)
);
