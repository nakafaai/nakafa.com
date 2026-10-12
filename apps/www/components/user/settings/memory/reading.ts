import type { Ref } from "@confect/core";
import { PaginatedQueryResult, QueryResult } from "@confect/react";
import type nina from "@repo/backend/confect/_generated/refs/nina";
import { hasEnded } from "@repo/backend/confect/nina/memory/ended";
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
 * It returns `loaded` (every memory the page has loaded, in list order, but not
 * a situation that had ended when the server read the page, at `now`: search
 * and a turn leave it out too, and the daily job has not deleted it yet),
 * `fetched` (how many memories have arrived, ended situations too: a page of
 * only ended situations adds nothing to `loaded`, and whoever asks for the next
 * page must still see that one arrived), `whole` (every memory is loaded),
 * `more` (loads the next page of a size the caller names, or none when there is
 * nothing to load or a page is on its way), `empty` (the learner has no memory
 * to show) and `paused`. What the learner searches for is not here: the
 * browser's own filter narrows `loaded`.
 *
 * `now` is the moment the server read the page, which never changes in the
 * browser, so a situation never leaves the list while the learner looks at it,
 * and no query takes a clock.
 */
export function readingOf(
  pages: Pages,
  state: State,
  first: MemoryPage,
  paused: boolean,
  now: number
) {
  const starting = PaginatedQueryResult.isLoadingFirstPage(pages);
  const arrived = starting ? first.page : pages.results;
  const loaded = Arr.filter(arrived, (memory) => !hasEnded(memory, now));
  const whole = starting
    ? first.isDone
    : PaginatedQueryResult.isExhausted(pages);

  return {
    empty: Arr.isReadonlyArrayEmpty(loaded) && whole,
    fetched: Arr.length(arrived),
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
