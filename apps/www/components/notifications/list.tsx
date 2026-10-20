"use client";

import { PaginatedQueryResult } from "@confect/react";
import { INBOX_PAGE_SIZE } from "@repo/backend/client/notifications/list";
import { Intersection } from "@repo/design-system/components/ui/intersection";
import { Array as Arr, type Option } from "effect";
import { useTranslations } from "use-intl";
import {
  type InboxFirstPage,
  useInbox,
} from "@/components/notifications/inbox.client";
import { NotificationRow } from "@/components/notifications/row";
import { FeedEmpty } from "@/components/user/feed";

/**
 * The rows of the inbox, newest first. Nothing shows while the first page loads, and
 * the next page loads as the end of the list comes into view. A failed read throws to
 * the route's error boundary, as the chats list does.
 */
export function NotificationsList({
  first,
}: {
  first: Option.Option<InboxFirstPage>;
}) {
  const t = useTranslations("Notifications");
  const inbox = useInbox(first);

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
