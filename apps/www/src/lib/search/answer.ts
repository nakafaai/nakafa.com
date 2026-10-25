import type { Ref } from "@confect/core";
import type contents from "@repo/backend/confect/_generated/refs/contents";
import { Option, type Result, Schema } from "effect";

type ContentSearchResponse = Ref.Returns<typeof contents.queries.search.search>;

export type ContentSearchResultItem = ContentSearchResponse["items"][number];

/** A content search could not be read, so the results show the failure. */
export class SearchReadError extends Schema.TaggedError<SearchReadError>()(
  "SearchReadError",
  { cause: Schema.Unknown }
) {}

/** The newest query on screen, and its answer once the read of that query settles. */
export interface SearchAnswers<Item> {
  readonly answer: Option.Option<Result.Result<Item[], SearchReadError>>;
  readonly key: string;
}

/** Starts the answers of a query: none has settled yet. */
export function startSearch<Item>(key: string): SearchAnswers<Item> {
  return { answer: Option.none(), key };
}

/** Moves the answers to a query on screen. The answer of the query before it does not carry over. */
export function requestSearch<Item>(
  state: SearchAnswers<Item>,
  key: string
): SearchAnswers<Item> {
  return state.key === key ? state : startSearch(key);
}

/**
 * Records the answer of a read, unless the read answers a query that is no longer
 * on screen. A late response for an older text changes nothing.
 */
export function settleSearch<Item>(
  state: SearchAnswers<Item>,
  key: string,
  result: Result.Result<Item[], SearchReadError>
): SearchAnswers<Item> {
  if (state.key !== key) {
    return state;
  }
  return { ...state, answer: Option.some(result) };
}
