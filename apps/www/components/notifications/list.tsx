"use client";

import { PaginatedQueryResult, usePaginatedQuery } from "@confect/react";
import { INBOX_PAGE_SIZE } from "@repo/backend/client/notifications/list";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr } from "effect";
import { useTranslations } from "next-intl";
import { NotificationRow } from "@/components/notifications/row";
import { useConvexAuth } from "@/components/providers/convex";
import { FeedEmpty } from "@/components/user/feed";

/**
 * The rows of the inbox, newest first. Nothing shows while the first page loads, and
 * the next page loads as the end of the list comes into view. A failed read throws to
 * the route's error boundary, as the chats list does.
 */
export function NotificationsList() {
  const t = useTranslations("Notifications");
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  const inbox = usePaginatedQuery(
    notifications.inbox.list,
    isSettled ? {} : "skip",
    { initialNumItems: INBOX_PAGE_SIZE }
  );

  if (PaginatedQueryResult.isFailure(inbox)) {
    throw inbox.error;
  }
  if (PaginatedQueryResult.isLoadingFirstPage(inbox)) {
    return null;
  }
  if (inbox.results.length === 0) {
    return <FeedEmpty>{t("empty")}</FeedEmpty>;
  }
  return (
    <div className="flex flex-col">
      {Arr.map(inbox.results, (notification) => (
        <NotificationRow key={notification.id} notification={notification} />
      ))}
      {PaginatedQueryResult.isCanLoadMore(inbox) ? (
        <Intersection onIntersect={() => inbox.loadMore(INBOX_PAGE_SIZE)} />
      ) : null}
    </div>
  );
}
