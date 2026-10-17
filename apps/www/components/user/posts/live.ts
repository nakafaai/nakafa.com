import { PaginatedQueryResult } from "@confect/react";
import type { Id } from "@repo/backend/confect/_generated/id";
import type { ListPost } from "@/components/user/posts/state";

/**
 * Decides what the posts list shows from its live query and the first page the
 * server read. Until the live list answers its first page, the server's page
 * stands in for it and nothing else shows. A failed read shows above the rows
 * the list holds and keeps them, so a failure never shows the empty sentence.
 * `ready` says whether the live list holds its first page, so that a change
 * made now has a page to show in.
 */
export function postsView<E>(
  live: PaginatedQueryResult.Variants<ListPost, E>,
  first: readonly ListPost[] | null
): PostsView {
  if (PaginatedQueryResult.isLoadingFirstPage(live)) {
    return {
      empty: first !== null && first.length === 0,
      failed: false,
      ready: false,
      rows: first ?? [],
    };
  }
  if (PaginatedQueryResult.isFailure(live)) {
    // The rows a later page loaded stay under the failure, and the list stays
    // ready for a change. A first page that failed holds no rows.
    if (live.results.length > 0) {
      return { empty: false, failed: true, ready: true, rows: live.results };
    }
    return failedView(first);
  }
  return {
    empty: live.results.length === 0,
    failed: false,
    ready: true,
    rows: live.results,
  };
}

/**
 * The view of a first page that failed, and of an error the live list throws:
 * the server's page stands under the failure, and nothing is ready to change.
 */
export function failedView(first: readonly ListPost[] | null) {
  return { empty: false, failed: true, ready: false, rows: first ?? [] };
}

/** What the posts list shows: its rows, its failure, its empty state, and whether it takes a change. */
export type PostsView = ReturnType<typeof failedView>;

/**
 * What the live list subscribes to. Convex answers a read that has no viewer
 * with an empty final page, so the list asks only once Convex confirms the
 * session. Until then the server's page stands in for the list.
 */
export function livePostsArgs(authorId: Id<"users">, isAuthenticated: boolean) {
  return isAuthenticated ? { authorId } : "skip";
}
