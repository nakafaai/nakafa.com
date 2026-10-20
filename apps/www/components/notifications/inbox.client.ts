import type { PaginatedQueryItem } from "@confect/react";
import { INBOX_PAGE_SIZE } from "@repo/backend/client/notifications/list";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import type { Option } from "effect";
import { useConvexAuth } from "@/components/providers/convex";
import {
  type PreloadedPage,
  usePaginatedPreloaded,
} from "@/lib/data/paginated";

/** The first page of the inbox, which the page's loader read on the server. */
export type InboxFirstPage = PreloadedPage<
  PaginatedQueryItem<typeof notifications.inbox.list>
>;

/**
 * The inbox of the signed-in account, once its session has settled. Each reader
 * calls it, and Convex serves every reader from one subscription, so the header
 * and the list agree without a shared store. The loader's first page stands in
 * until that subscription answers.
 */
export function useInbox(first: Option.Option<InboxFirstPage>) {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return usePaginatedPreloaded(
    notifications.inbox.list,
    isSettled ? {} : "skip",
    { initialNumItems: INBOX_PAGE_SIZE },
    first
  );
}
