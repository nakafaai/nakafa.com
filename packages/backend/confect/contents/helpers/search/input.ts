import type { contentSearchInputValidator } from "@repo/backend/confect/contents/helpers/search/schema";
import {
  NAKAFA_AGENT_MAX_LIMIT,
  NAKAFA_AGENT_MAX_OFFSET,
  NAKAFA_AGENT_MAX_QUERIES,
} from "@repo/contents/agent/search";
import { Array as Arr, Effect, HashSet, Schema } from "effect";
export class ContentSearchInputError extends Schema.TaggedError<ContentSearchInputError>()(
  "ContentSearchInputError",
  {
    code: Schema.Literals([
      "CONTENT_SEARCH_LIMIT_INVALID",
      "CONTENT_SEARCH_OFFSET_INVALID",
      "CONTENT_SEARCH_QUERY_COUNT_INVALID",
    ]),
    message: Schema.String,
  }
) {}
type ContentSearchInput = typeof contentSearchInputValidator.Type;

/** Validates bounded public search input and returns unique query texts. */
export const validateContentSearchInput = Effect.fn(
  "contents.search.validateInput"
)(function* (args: ContentSearchInput) {
  if (args.limit < 1 || args.limit > NAKAFA_AGENT_MAX_LIMIT) {
    return yield* ContentSearchInputError.make({
      code: "CONTENT_SEARCH_LIMIT_INVALID",
      message: `Content search limit must be between 1 and ${NAKAFA_AGENT_MAX_LIMIT}.`,
    });
  }
  if (args.offset < 0 || args.offset > NAKAFA_AGENT_MAX_OFFSET) {
    return yield* ContentSearchInputError.make({
      code: "CONTENT_SEARCH_OFFSET_INVALID",
      message: `Content search offset must be between 0 and ${NAKAFA_AGENT_MAX_OFFSET}.`,
    });
  }
  const queryTexts = getQueryTexts(args);
  if (queryTexts.length > NAKAFA_AGENT_MAX_QUERIES) {
    return yield* ContentSearchInputError.make({
      code: "CONTENT_SEARCH_QUERY_COUNT_INVALID",
      message: `Content search accepts at most ${NAKAFA_AGENT_MAX_QUERIES} unique queries.`,
    });
  }
  return queryTexts;
});

/**
 * Normalizes unique query texts without changing wording. The scan stops one
 * text past the limit, which is all the caller needs to reject the request,
 * so an oversized list costs one pass and at most that many comparisons.
 */
function getQueryTexts({ queries }: ContentSearchInput) {
  let seen = HashSet.empty<string>();
  let texts: readonly string[] = [];
  for (const queryText of queries ?? []) {
    const text = queryText?.trim();
    const key = text?.toLocaleLowerCase();
    if (!(text && key) || HashSet.has(seen, key)) {
      continue;
    }
    seen = HashSet.add(seen, key);
    texts = Arr.append(texts, text);
    if (texts.length > NAKAFA_AGENT_MAX_QUERIES) {
      break;
    }
  }
  return texts;
}
