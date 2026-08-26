import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/convex/contentRelease/bucket";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/convex/contentRelease/spec";

/** Maximum route-less categories resolved once for one application locale. */
export const ARTICLE_PREDECESSOR_LIMIT = CONTENT_BUCKET_SIZE;

/** Maximum verified article categories returned in one agent transaction. */
export const ARTICLE_AGENT_TAXONOMY_LIMIT = CONTENT_BUCKET_SIZE;

/** One lookahead row distinguishes a complete validation page from a split. */
export const ARTICLE_VALIDATION_SCAN_LIMIT = RELEASE_PAGE_LIMIT + 1;

/** Two category-owner and two explicit-route rows per distinct page member. */
export const ARTICLE_VALIDATION_CLAIM_READ_LIMIT = RELEASE_PAGE_LIMIT * 4;

/** Every locale may resolve one category row and one representative article. */
export const ARTICLE_VALIDATION_PREDECESSOR_READ_LIMIT =
  APP_LOCALE_CODES.length * ARTICLE_PREDECESSOR_LIMIT * 2;
