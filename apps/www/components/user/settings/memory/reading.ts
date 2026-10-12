import type { Ref } from "@confect/core";
import { PaginatedQueryResult, QueryResult } from "@confect/react";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import { Array as Arr } from "effect";
import type {
  Memory,
  MemoryPage,
} from "@/components/user/settings/memory/list";

/** The pages of the list that Convex answered with. */
type Pages = PaginatedQueryResult.PaginatedQueryResult<
  Memory,
  Ref.Error<typeof nina.memory.list>
>;

/** What Convex answered about whether memory is paused. */
type State = QueryResult.QueryResult<
  Ref.Returns<typeof nina.memory.state>,
  Ref.Error<typeof nina.memory.state>
>;

/**
 * Reads what the Memory page shows from what Convex answered, so that no
 * component knows about pages or cursors. The page the server read, `first`,
 * stands in until Convex answers with the first page, and `paused` stands in
 * until it answers with the state.
 *
 * It returns `loaded` (every memory the page has loaded, in list order),
 * `whole` (every memory is loaded), `more` (loads the next page of a size the
 * caller names, or none when there is nothing to load or a page is on its way),
 * `empty` (the learner has no memory at all) and `paused`. What the learner
 * searches for is not here: the browser's own filter narrows `loaded`.
 */
export function readingOf(
  pages: Pages,
  state: State,
  first: MemoryPage,
  paused: boolean
) {
  const starting = PaginatedQueryResult.isLoadingFirstPage(pages);
  const loaded = starting ? first.page : pages.results;
  const whole = starting
    ? first.isDone
    : PaginatedQueryResult.isExhausted(pages);

  return {
    empty: Arr.isReadonlyArrayEmpty(loaded) && whole,
    loaded,
    more: PaginatedQueryResult.isCanLoadMore(pages) ? pages.loadMore : null,
    paused:
      QueryResult.isSuccess(state) && state.value !== null
        ? state.value.paused
        : paused,
    whole,
  };
}

/** What the Memory page reads, as `readingOf` returns it. */
export type MemoryReading = ReturnType<typeof readingOf>;
