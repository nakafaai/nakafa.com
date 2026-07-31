import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";

/** Maximum immutable hierarchy rows accepted by one runtime catalog read. */
export const TRYOUT_CATALOG_LIMIT = 1000;

/** Maximum question placements accepted within one authored section. */
export const TRYOUT_SECTION_LIMIT = 256;

const TRYOUT_READ_BUDGET = TRANSACTION_READ_LIMIT - TRANSACTION_READ_HEADROOM;

/** Per-row ceiling that keeps a maximum catalog read within its byte budget. */
export const TRYOUT_CATALOG_DOCUMENT_LIMIT = Math.floor(
  TRYOUT_READ_BUDGET / TRYOUT_CATALOG_LIMIT
);

/** Per-row ceiling that keeps a maximum section read within its byte budget. */
export const TRYOUT_PLACEMENT_DOCUMENT_LIMIT = Math.floor(
  TRYOUT_READ_BUDGET / TRYOUT_SECTION_LIMIT
);
