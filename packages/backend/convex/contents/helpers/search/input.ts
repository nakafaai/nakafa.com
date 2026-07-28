import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import {
  NAKAFA_AGENT_MAX_LIMIT,
  NAKAFA_AGENT_MAX_OFFSET,
  NAKAFA_AGENT_MAX_QUERIES,
  NAKAFA_AGENT_SEARCH_WINDOW,
} from "@repo/contents/_types/agent/search";
import { ConvexError, type Infer } from "convex/values";

type ContentSearchInput = Infer<typeof contentSearchInputValidator>;

/** Validates bounded public search input and returns unique query texts. */
export function validateContentSearchInput(args: ContentSearchInput) {
  if (args.limit < 1 || args.limit > NAKAFA_AGENT_MAX_LIMIT) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_LIMIT_INVALID",
      message: `Content search limit must be between 1 and ${NAKAFA_AGENT_MAX_LIMIT}.`,
    });
  }

  if (args.offset < 0 || args.offset > NAKAFA_AGENT_MAX_OFFSET) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_OFFSET_INVALID",
      message: `Content search offset must be between 0 and ${NAKAFA_AGENT_MAX_OFFSET}.`,
    });
  }

  if (args.offset + args.limit > NAKAFA_AGENT_SEARCH_WINDOW) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_WINDOW_INVALID",
      message: `Content search offset and limit must stay within the first ${NAKAFA_AGENT_SEARCH_WINDOW} results.`,
    });
  }

  const queryTexts = getQueryTexts(args);

  if (queryTexts.length > NAKAFA_AGENT_MAX_QUERIES) {
    throw new ConvexError({
      code: "CONTENT_SEARCH_QUERY_COUNT_INVALID",
      message: `Content search accepts at most ${NAKAFA_AGENT_MAX_QUERIES} unique queries.`,
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
