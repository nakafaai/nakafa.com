import {
  type PaginatedQueryItem,
  PaginatedQueryResult,
  usePaginatedQuery,
} from "@confect/react";
import { INBOX_PAGE_SIZE } from "@repo/backend/client/notifications/list";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import type { Option } from "effect";
import { useConvexAuth } from "@/components/auth/convex";
import { inboxView } from "@/components/notifications/live";
import type { PreloadedPage } from "@/lib/data/paginated";

/** The first page of the inbox, which the page's loader read on the server. */
export type InboxFirstPage = PreloadedPage<
  PaginatedQueryItem<typeof notifications.inbox.list>
>;

/**
 * The inbox of the signed-in account, once its session has settled. Each reader
 * calls it, and Convex serves every reader from one subscription, so the header
 * and the list agree without a shared store. The loader's first page stands in
 * until that subscription answers, and the view says whether a change can show.
 */
export function useInbox(first: Option.Option<InboxFirstPage>) {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const live = usePaginatedQuery(
    notifications.inbox.list,
    isSettled ? {} : "skip",
    { initialNumItems: INBOX_PAGE_SIZE }
  );
  const loadMore = PaginatedQueryResult.isCanLoadMore(live)
    ? () => live.loadMore(INBOX_PAGE_SIZE)
    : undefined;
  return { ...inboxView(live, first), loadMore };
}
