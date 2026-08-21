import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  CONTENT_DOCUMENT_LIMIT,
  READ_MODEL_DOCUMENT_LIMIT,
} from "@repo/backend/convex/contentRelease/document";
import {
  TRANSACTION_READ_HEADROOM,
  TRANSACTION_READ_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";

/** Active state and release documents required before catalog reads begin. */
export const PAGE_OWNER_READ_LIMIT = 2;

/** Key, duplicate-safe head pair, and duplicate-safe route pair per page. */
export const PAGE_IDENTITY_READ_LIMIT = 5;

const PAGE_SENTINEL_READ_LIMIT = 1;
const pageReadBudget =
  TRANSACTION_READ_LIMIT -
  TRANSACTION_READ_HEADROOM -
  PAGE_OWNER_READ_LIMIT * CONTENT_DOCUMENT_LIMIT;
const localeReadBudget =
  ACTIVE_APP_LOCALE_CODES.length * READ_MODEL_DOCUMENT_LIMIT;

/** Complete locale-equivalent Page identities safe in one Convex transaction. */
export const PAGE_CATALOG_LIMIT = Math.floor(
  (pageReadBudget - PAGE_SENTINEL_READ_LIMIT * localeReadBudget) /
    (PAGE_IDENTITY_READ_LIMIT * localeReadBudget)
);
