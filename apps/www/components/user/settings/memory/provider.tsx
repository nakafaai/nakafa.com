"use client";

import { QueryResult, useQuery } from "@confect/react";
import nina from "@repo/backend/confect/_generated/refs/nina";
import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { useConvexAuth } from "@/components/providers/convex";
import type { MemoryList } from "@/components/user/settings/memory/list";
import {
  createMemoryStore,
  type MemoryStore,
  type MemoryStoreApi,
} from "@/components/user/settings/memory/store";

const ListContext = createContext<MemoryList | null>(null);
const StoreContext = createContext<MemoryStoreApi | null>(null);

/**
 * Gives the Memory page its two homes of state. The memories come from the
 * live query, with the page the server already read until it answers, and
 * reach the readers through a plain context. What the learner is doing on the
 * page, such as the search and the open editor, lives in a store this provider
 * creates once, so the page never reads one learner's state for another.
 */
export function MemoryProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial: MemoryList;
}) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const query = useQuery(nina.memory.list, isAuthenticated ? {} : "skip");
  const [store] = useState(createMemoryStore);

  if (QueryResult.isFailure(query)) {
    throw query.error;
  }

  const list = QueryResult.isSuccess(query) ? query.value : initial;

  // A signed-out learner has no memories to show.
  if (list === null) {
    return null;
  }

  return (
    <StoreContext value={store}>
      <ListContext value={list}>{children}</ListContext>
    </StoreContext>
  );
}

/** Reads one selected slice of the memories on the page. */
export function useMemory<T>(selector: (list: MemoryList) => T) {
  const list = use(ListContext);

  if (!list) {
    throw new Error("useMemory must be used within MemoryProvider");
  }

  return selector(list);
}

/** Reads one selected slice of what the learner is doing on the page. */
export function useMemoryPage<T>(selector: (state: MemoryStore) => T) {
  const store = use(StoreContext);

  if (!store) {
    throw new Error("useMemoryPage must be used within MemoryProvider");
  }

  return useStore(store, useShallow(selector));
}
