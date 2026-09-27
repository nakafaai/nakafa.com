import { CONTENT_BUCKET_SIZE } from "@repo/backend/confect/contentRelease/bucket";
import { RELEASE_PAGE_LIMIT } from "@repo/backend/confect/contentRelease/spec";

/** Maximum verified article categories returned in one agent transaction. */
export const ARTICLE_AGENT_TAXONOMY_LIMIT = CONTENT_BUCKET_SIZE;

/** One lookahead row distinguishes a complete validation page from a split. */
export const ARTICLE_VALIDATION_SCAN_LIMIT = RELEASE_PAGE_LIMIT + 1;

/** Two category-owner and two explicit-route rows per distinct page member. */
export const ARTICLE_VALIDATION_CLAIM_READ_LIMIT = RELEASE_PAGE_LIMIT * 4;
