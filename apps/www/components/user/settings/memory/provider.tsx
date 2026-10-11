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

const InitialContext = createContext<MemoryList | null>(null);
const NowContext = createContext<number | null>(null);
const StoreContext = createContext<MemoryStoreApi | null>(null);

/**
 * Gives the Memory page what the server read and what the learner is doing.
 * The page and the time the server read never change after hydration, so the
 * streamed content under this provider is never discarded. What the learner is
 * doing, such as the search and the open editor, lives in a store this
 * provider creates once, so the page never reads one learner's state for
 * another. The live memories come from `useMemory`.
 */
export function MemoryProvider({
  children,
  initial,
  now,
}: {
  children: ReactNode;
  initial: MemoryList;
  now: number;
}) {
  const [store] = useState(createMemoryStore);

  return (
    <StoreContext value={store}>
      <InitialContext value={initial}>
        <NowContext value={now}>{children}</NowContext>
      </InitialContext>
    </StoreContext>
  );
}

/**
 * Reads one selected slice of the memories on the page. Each reader derives
 * them from the live query, which Convex serves from one subscription. The
 * page the server read stands in until Convex answers with one, and when
 * Convex has none for the learner, as it has not for a signed-out one.
 */
export function useMemory<T>(selector: (list: MemoryList) => T) {
  const initial = use(InitialContext);
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const query = useQuery(nina.memory.list, isAuthenticated ? {} : "skip");

  if (!initial) {
    throw new Error("useMemory must be used within MemoryProvider");
  }

  if (QueryResult.isFailure(query)) {
    throw query.error;
  }

  const live = QueryResult.isSuccess(query) ? query.value : null;

  return selector(live ?? initial);
}

/**
 * Reads the moment the server read the page. The relative times on the page
 * count from it, so the browser and the server render the same words.
 */
export function useMemoryNow() {
  const now = use(NowContext);

  if (now === null) {
    throw new Error("useMemoryNow must be used within MemoryProvider");
  }

  return now;
}

/** Reads one selected slice of what the learner is doing on the page. */
export function useMemoryPage<T>(selector: (state: MemoryStore) => T) {
  const store = use(StoreContext);

  if (!store) {
    throw new Error("useMemoryPage must be used within MemoryProvider");
  }

  return useStore(store, useShallow(selector));
}
