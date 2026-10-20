"use client";

import type { PaginatedQueryItem } from "@confect/react";
import { PaginatedQueryResult } from "@confect/react";
import { INBOX_PAGE_SIZE } from "@repo/backend/client/notifications/list";
import notifications from "@repo/backend/confect/_generated/refs/notifications";
import type { Option } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { createStore, useStore } from "zustand";
import { useConvexAuth } from "@/components/providers/convex";
import {
  type PreloadedPage,
  readFirstPage,
  usePaginatedPreloaded,
} from "@/lib/data/paginated";

/** The first page of the inbox, which the route's loader read on the server. */
type InboxFirstPage = PreloadedPage<
  PaginatedQueryItem<typeof notifications.inbox.list>
>;

/** The live inbox of the signed-in account: the loader's page until its subscription answers. */
function useInboxSubscription(first: Option.Option<InboxFirstPage>) {
  const isSettled = useConvexAuth((auth) => !auth.isLoading);
  return usePaginatedPreloaded(
    notifications.inbox.list,
    isSettled ? {} : "skip",
    { initialNumItems: INBOX_PAGE_SIZE },
    first
  );
}

/** The inbox as the page reads it. */
type Inbox = ReturnType<typeof useInboxSubscription>;

/** The inbox of the page, which the live subscription writes once it answers. */
interface InboxState {
  readonly inbox: Inbox;
  readonly setInbox: (inbox: Inbox) => void;
}

/** A store of the inbox for one page, whose first state is what the loader read. */
function createInboxStore(inbox: Inbox) {
  return createStore<InboxState>()((set) => ({
    inbox,
    setInbox: (next) => set({ inbox: next }),
  }));
}

type InboxStore = ReturnType<typeof createInboxStore>;

const InboxContext = createContext<InboxStore | null>(null);

/**
 * Reads the inbox once for the page, so the header and the list show one copy of
 * it: the list draws its rows, and the header offers its action only while there
 * are rows to act on. The context holds the store, which stays the same after
 * hydration. The live subscription writes its answers into the store, so a
 * streamed page is never discarded by a change of the context value.
 */
export function NotificationsProvider({
  children,
  first,
}: {
  children: ReactNode;
  first: Option.Option<InboxFirstPage>;
}) {
  const [store] = useState(() =>
    createInboxStore(
      readFirstPage(
        PaginatedQueryResult.loadingFirstPage({ skipped: false }),
        first
      )
    )
  );
  return (
    <InboxContext value={store}>
      <InboxSubscription first={first} store={store} />
      {children}
    </InboxContext>
  );
}

/** Keeps the store on the live inbox, which Convex answers once the session has settled. */
function InboxSubscription({
  first,
  store,
}: {
  first: Option.Option<InboxFirstPage>;
  store: InboxStore;
}) {
  const inbox = useInboxSubscription(first);
  const setInbox = store.getState().setInbox;
  useEffect(() => {
    setInbox(inbox);
  }, [inbox, setInbox]);
  return null;
}

/** Reads the inbox of the page. */
export function useInbox() {
  const store = use(InboxContext);
  if (store === null) {
    throw new Error("useInbox must be used within NotificationsProvider");
  }
  return useStore(store, (state) => state.inbox);
}
