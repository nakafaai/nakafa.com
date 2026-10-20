import { PaginatedQueryResult } from "@confect/react";
import { Option } from "effect";
import type { PreloadedPage } from "@/lib/data/paginated";

/** What the inbox shows: its rows, its failure, its empty sentence, and whether it takes a change. */
interface InboxView<Item> {
  readonly empty: boolean;
  readonly failed: boolean;
  /** Whether the live inbox holds its first page, so that a change made now has a page to show in. */
  readonly ready: boolean;
  readonly rows: readonly Item[];
}

/**
 * Decides what the inbox shows from its live query and the first page the server
 * read. Until the live inbox answers its first page, the server's page stands in
 * and nothing can change. A failed read shows above the rows the inbox holds and
 * keeps them, so a failure never shows the empty sentence.
 */
export function inboxView<Item, E>(
  live: PaginatedQueryResult.Variants<Item, E>,
  first: Option.Option<PreloadedPage<Item>>
): InboxView<Item> {
  if (PaginatedQueryResult.isLoadingFirstPage(live)) {
    return {
      empty:
        Option.isSome(first) &&
        first.value.isDone &&
        first.value.page.length === 0,
      failed: false,
      ready: false,
      rows: pageRows(first),
    };
  }
  if (PaginatedQueryResult.isFailure(live)) {
    // The rows a later page loaded stay under the failure, and the inbox stays ready
    // for a change. A first page that failed holds no rows, so the server's page shows.
    if (live.results.length > 0) {
      return { empty: false, failed: true, ready: true, rows: live.results };
    }
    return { empty: false, failed: true, ready: false, rows: pageRows(first) };
  }
  return {
    empty: live.results.length === 0,
    failed: false,
    ready: true,
    rows: live.results,
  };
}

/** The rows of the server's first page, or none when the server read no page. */
function pageRows<Item>(first: Option.Option<PreloadedPage<Item>>) {
  return Option.match(first, {
    onNone: () => [],
    onSome: (page) => page.page,
  });
}
