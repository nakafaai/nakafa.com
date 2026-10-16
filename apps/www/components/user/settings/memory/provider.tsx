"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { MemoryPage } from "@/components/user/settings/memory/list";
import type { MemoryReading } from "@/components/user/settings/memory/reading";
import { useMemoryReading } from "@/components/user/settings/memory/reading.client";
import {
  createMemoryStore,
  type MemoryStore,
  type MemoryStoreApi,
} from "@/components/user/settings/memory/store";

const NowContext = createContext<number | null>(null);
const ReadingContext = createContext<MemoryReading | null>(null);
const StoreContext = createContext<MemoryStoreApi | null>(null);

/**
 * Gives the Memory page what the server read and what the learner is doing.
 * The time the server read never changes after hydration, and neither does
 * the store this provider creates once for what the learner is doing, such as
 * the search and the open editor, so the page never reads one learner's state
 * for another. The memories themselves come from `MemoryReader`.
 */
export function MemoryProvider({
  children,
  first,
  now,
  paused,
}: {
  children: ReactNode;
  first: MemoryPage;
  now: number;
  paused: boolean;
}) {
  const [store] = useState(createMemoryStore);

  return (
    <StoreContext value={store}>
      <NowContext value={now}>
        <MemoryReader first={first} now={now} paused={paused}>
          {children}
        </MemoryReader>
      </NowContext>
    </StoreContext>
  );
}

/**
 * Reads the memories once for the page and shares them in a context that
 * changes as Convex answers, which is where ADR 0017 puts the result of a
 * Confect hook. A second hook would load and subscribe to its own pages, so one
 * reader serves every component. The change is safe after hydration because no
 * Suspense boundary below this reader can still be streaming: the editor's
 * mounts in the browser when the learner opens it.
 */
function MemoryReader({
  children,
  first,
  now,
  paused,
}: {
  children: ReactNode;
  first: MemoryPage;
  now: number;
  paused: boolean;
}) {
  // The learner's own choice stands in for what the page read, until the state
  // is read: the reading uses the state once Convex answers with it.
  const choice = useMemoryPage((state) => state.paused);
  const reading = useMemoryReading(first, choice ?? paused, now);

  return <ReadingContext value={reading}>{children}</ReadingContext>;
}

/**
 * Reads one selected slice of what the page loaded: the memories, whether all
 * of them are loaded, how to load more, whether the learner has none, and
 * whether memory is paused.
 */
export function useMemory<T>(selector: (reading: MemoryReading) => T) {
  const reading = use(ReadingContext);

  if (!reading) {
    throw new Error("useMemory must be used within MemoryProvider");
  }

  return selector(reading);
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

/**
 * Reads what the learner is doing at the moment an action runs, without
 * subscribing to it, so a component that only acts renders again for none of
 * it.
 */
export function useMemoryLatest() {
  const store = use(StoreContext);

  if (!store) {
    throw new Error("useMemoryLatest must be used within MemoryProvider");
  }

  return store.getState;
}
