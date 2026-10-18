"use client";

import { usePaginatedQuery } from "@confect/react";
import { INBOX_PAGE_SIZE } from "@repo/backend/client/notifications/list";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { createContext, type ReactNode, use } from "react";
import { useConvexAuth } from "@/components/providers/convex";

/** The inbox as Convex answers it: its pages so far, or the state of the first page. */
type Inbox = ReturnType<typeof useInboxQuery>;

const InboxContext = createContext<Inbox | null>(null);

/** Reads the inbox of the signed-in account once its session has settled. */
function useInboxQuery() {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return usePaginatedQuery(notifications.inbox.list, isSettled ? {} : "skip", {
    initialNumItems: INBOX_PAGE_SIZE,
  });
}

/**
 * Reads the inbox once for the page, so the header and the list show one copy of
 * it: the list draws its rows, and the header offers its action only while there
 * are rows to act on.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const inbox = useInboxQuery();
  return <InboxContext value={inbox}>{children}</InboxContext>;
}

/** Reads the inbox of the page. */
export function useInbox() {
  const inbox = use(InboxContext);
  if (inbox === null) {
    throw new Error("useInbox must be used within NotificationsProvider");
  }
  return inbox;
}
