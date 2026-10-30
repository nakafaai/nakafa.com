import type { OptimisticUpdate } from "@confect/react";
import type * as OptimisticLocalStore from "@confect/react/OptimisticLocalStore";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import { DateTime, Option } from "effect";
import {
  type ListNotification,
  markPageRead,
  markRowRead,
} from "@/components/notifications/state";

/** Changes the page of every loaded inbox list, so each open list shows the change. */
export function changeLists(
  localStore: OptimisticLocalStore.OptimisticLocalStore,
  change: (page: readonly ListNotification[]) => ListNotification[]
) {
  for (const query of localStore.getAllQueries(notifications.inbox.list)) {
    if (Option.isSome(query.value)) {
      localStore.setQuery(
        notifications.inbox.list,
        query.args,
        Option.some({
          ...query.value.value,
          page: change(query.value.value.page),
        })
      );
    }
  }
}

/** The moment an optimistic read takes, the browser's own clock. */
function readTime() {
  return DateTime.toEpochMillis(DateTime.nowUnsafe());
}

/** The change that shows one row as read at once, in every loaded list. */
export const markReadInLists: OptimisticUpdate<
  typeof notifications.inbox.read
> = (localStore, { notificationId }) => {
  const readAt = readTime();
  changeLists(localStore, (page) => markRowRead(page, notificationId, readAt));
};

/** The change that shows every loaded row as read at once, or those of the school it names, in every loaded list. */
export const markAllReadInLists: OptimisticUpdate<
  typeof notifications.inbox.readAll
> = (localStore, { slug }) => {
  const readAt = readTime();
  changeLists(localStore, (page) => markPageRead(page, readAt, slug));
};
