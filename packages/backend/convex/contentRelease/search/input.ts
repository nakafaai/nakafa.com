import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

const SEARCH_TERM_LIMIT = 16;
const SEARCH_TERM_BYTE_LIMIT = 32;
const searchSeparator = /[\s\p{P}\p{S}]+/u;

interface SearchQueryLimits {
  readonly characterLimit?: number;
}

/** Validates one query against Convex full-text token and byte limits. */
export const validateSearchQuery = Effect.fn(
  "contentRelease.validateSearchQuery"
)(function* (source: string, limits: SearchQueryLimits = {}) {
  const query = source.trim().replaceAll(/\s+/gu, " ");
  const terms = query.split(searchSeparator).filter((term) => term.length > 0);
  const exceedsCharacterLimit =
    limits.characterLimit !== undefined && query.length > limits.characterLimit;
  const encoder = new TextEncoder();
  const hasOversizedTerm = terms.some(
    (term) => encoder.encode(term).byteLength > SEARCH_TERM_BYTE_LIMIT
  );
  if (
    terms.length === 0 ||
    terms.length > SEARCH_TERM_LIMIT ||
    exceedsCharacterLimit ||
    hasOversizedTerm
  ) {
    const characterConstraint =
      limits.characterLimit === undefined
        ? ""
        : ` within ${limits.characterLimit} characters`;
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Search accepts 1 to ${SEARCH_TERM_LIMIT} terms of at most ${SEARCH_TERM_BYTE_LIMIT} UTF-8 bytes${characterConstraint}.`
    );
  }
  return query;
});
