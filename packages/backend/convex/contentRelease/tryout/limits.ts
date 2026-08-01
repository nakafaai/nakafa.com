import { CONTENT_DOCUMENT_LIMIT } from "@repo/backend/convex/contentRelease/document";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";

/** Maximum immutable hierarchy rows accepted by one runtime catalog read. */
export const TRYOUT_CATALOG_LIMIT = 1000;

/** Maximum question placements accepted within one authored section. */
export const TRYOUT_SECTION_LIMIT = 256;

const TRYOUT_READ_BUDGET = TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM;
const TRYOUT_OWNER_READS = 3;
const TRYOUT_ROW_BUDGET =
  TRYOUT_READ_BUDGET - TRYOUT_OWNER_READS * CONTENT_DOCUMENT_LIMIT;

/** Per-row ceiling that keeps a maximum catalog read within its byte budget. */
export const TRYOUT_CATALOG_DOCUMENT_LIMIT = Math.floor(
  TRYOUT_ROW_BUDGET / TRYOUT_CATALOG_LIMIT
);

/** Per-row ceiling that keeps a maximum section read within its byte budget. */
export const TRYOUT_PLACEMENT_DOCUMENT_LIMIT = Math.floor(
  (TRYOUT_ROW_BUDGET - TRYOUT_CATALOG_DOCUMENT_LIMIT) / TRYOUT_SECTION_LIMIT
);

/** Maximum questions read across every section of one immutable set. */
export const TRYOUT_SET_QUESTION_LIMIT = Math.floor(
  (TRYOUT_ROW_BUDGET - TRYOUT_CATALOG_DOCUMENT_LIMIT) /
    (TRYOUT_CATALOG_DOCUMENT_LIMIT + TRYOUT_PLACEMENT_DOCUMENT_LIMIT)
);
