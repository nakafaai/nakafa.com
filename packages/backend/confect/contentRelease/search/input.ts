import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { Array as Arr, Effect, Schema } from "effect";

const SEARCH_TERM_LIMIT = 16;
const SEARCH_TERM_BYTE_CEILING = 32;
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
  const encoder = new TextEncoder();
  const hasDiscardedTerm = Arr.some(
    terms,
    (term) => encoder.encode(term).byteLength >= SEARCH_TERM_BYTE_CEILING
  );
  if (
    terms.length === 0 ||
    terms.length > SEARCH_TERM_LIMIT ||
    exceedsCharacterLimit ||
    hasDiscardedTerm
  ) {
    const characterConstraint =
      limits.characterLimit === undefined
        ? ""
        : ` within ${limits.characterLimit} characters`;
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Search accepts 1 to ${SEARCH_TERM_LIMIT} alphanumeric terms below ${SEARCH_TERM_BYTE_CEILING} UTF-8 bytes${characterConstraint}.`
    );
  }
  return query;
});

/** Extracts the terms Convex counts in one full-text search expression. */
function getSearchTerms(query: string) {
  return query.match(searchTermPattern) ?? [];
}
