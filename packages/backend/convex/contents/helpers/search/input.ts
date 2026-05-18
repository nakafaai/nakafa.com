import {
  CONTENT_SEARCH_MAX_LIMIT,
  CONTENT_SEARCH_MAX_OFFSET,
  CONTENT_SEARCH_MAX_QUERIES,
} from "@repo/backend/convex/contents/helpers/search/constants";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { ConvexError, type Infer } from "convex/values";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;

/** Validates bounded public search input and returns unique query texts. */
export function validateContentSearchInput(args: ContentSearchInput) {
  if (args.limit < 1 || args.limit > CONTENT_SEARCH_MAX_LIMIT) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_LIMIT_INVALID",
      message: `Content search limit must be between 1 and ${CONTENT_SEARCH_MAX_LIMIT}.`,
    });
  }

  if (args.offset < 0 || args.offset > CONTENT_SEARCH_MAX_OFFSET) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_OFFSET_INVALID",
      message: `Content search offset must be between 0 and ${CONTENT_SEARCH_MAX_OFFSET}.`,
    });
  }

  const queryTexts = getQueryTexts(args);

  if (queryTexts.length > CONTENT_SEARCH_MAX_QUERIES) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_QUERY_COUNT_INVALID",
      message: `Content search accepts at most ${CONTENT_SEARCH_MAX_QUERIES} unique queries.`,
    });
  }

  return queryTexts;
}

/** Normalizes unique query texts without changing wording. */
function getQueryTexts({ queries }: ContentSearchInput) {
  const texts: string[] = [];
  const seen = new Set<string>();

  for (const queryText of queries ?? []) {
    appendQueryText(texts, seen, queryText);
  }

  return texts;
}

/** Appends one unique, non-empty query text. */
function appendQueryText(
  texts: string[],
  seen: Set<string>,
  queryText: string | undefined
) {
  const text = queryText?.trim();

  if (!text) {
    return;
  }

  const key = text.toLocaleLowerCase();

  if (seen.has(key)) {
    return;
  }

  texts.push(text);
  seen.add(key);
}
