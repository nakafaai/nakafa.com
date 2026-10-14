import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  CONVEX_SEARCH_TERM_BYTES,
  CONVEX_SEARCH_TERMS,
} from "@repo/contents/agent/search";
import { Array as Arr, Effect, Schema } from "effect";

const searchTermPattern = /[\p{Alphabetic}\p{Number}]+/gu;
const SearchQueryLimitsSchema = Schema.Struct({
  characterLimit: Schema.optionalKey(Schema.Finite),
});
type SearchQueryLimits = typeof SearchQueryLimitsSchema.Type;

/** Validates one query against Convex full-text token and byte limits. */
export const validateSearchQuery = Effect.fn(
  "contentRelease.validateSearchQuery"
)(function* (source: string, limits: SearchQueryLimits = {}) {
  const query = source.trim().replaceAll(/\s+/gu, " ");
  const terms = getSearchTerms(query);
  const exceedsCharacterLimit =
    limits.characterLimit !== undefined && query.length > limits.characterLimit;
  if (terms.length === 0 || exceedsCharacterLimit || losesTerm(terms)) {
    return yield* failSearchLimit(limits);
  }
  return query;
});

/**
 * Fails a query that Convex full-text search would read in part. It keeps the
 * first 16 terms and drops a term of 32 bytes or more, both without an error,
 * so a search for such a query would answer for words it was never given. A
 * query without terms, such as a bare route, is whole. The query is returned
 * as it is.
 */
export const requireWholeSearchQuery = Effect.fn(
  "contentRelease.requireWholeSearchQuery"
)(function* (query: string) {
  if (losesTerm(getSearchTerms(query))) {
    return yield* failSearchLimit();
  }
  return query;
});

/** Extracts the terms Convex counts in one full-text search expression. */
function getSearchTerms(query: string) {
  return query.match(searchTermPattern) ?? [];
}

/** Whether Convex would drop one of these terms: the count passes its limit, or a term is too long. */
function losesTerm(terms: readonly string[]) {
  const encoder = new TextEncoder();
  return (
    terms.length > CONVEX_SEARCH_TERMS ||
    Arr.some(
      terms,
      (term) => encoder.encode(term).byteLength >= CONVEX_SEARCH_TERM_BYTES
    )
  );
}

/** Fails with the stable code of a search limit, and says what the search accepts. */
function failSearchLimit(limits: SearchQueryLimits = {}) {
  const characterConstraint =
    limits.characterLimit === undefined
      ? ""
      : ` within ${limits.characterLimit} characters`;
  return releaseFail(
    "CONTENT_RELEASE_LIMIT",
    `Search accepts 1 to ${CONVEX_SEARCH_TERMS} alphanumeric terms below ${CONVEX_SEARCH_TERM_BYTES} UTF-8 bytes${characterConstraint}.`
  );
}
