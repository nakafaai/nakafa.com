import type { Ref } from "@confect/core";
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

/** What an inbox shows: the arguments of its query, without the page. */
export type InboxScope = Omit<
  Ref.Args<typeof notifications.inbox.list>,
  "paginationOpts"
>;

/** The Nakafa inbox: every school's rows, with the rows of the account itself. */
export const ACCOUNT_INBOX = { personal: true } satisfies InboxScope;

/**
 * The inbox that `scope` names, once the session has settled: the Nakafa inbox,
 * or a school's page of it. Each reader calls it, and Convex serves every
 * reader from one subscription, so the header and the list agree without a
 * shared store. The loader's first page stands in until that subscription
 * answers, and the view says whether a change can show.
 */
export function useInbox(
  first: Option.Option<InboxFirstPage>,
  scope: InboxScope
) {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const live = usePaginatedQuery(
    notifications.inbox.list,
    isSettled ? scope : "skip",
    { initialNumItems: INBOX_PAGE_SIZE }
  );
  const loadMore = PaginatedQueryResult.isCanLoadMore(live)
    ? () => live.loadMore(INBOX_PAGE_SIZE)
    : undefined;
  return { ...inboxView(live, first), loadMore };
}
