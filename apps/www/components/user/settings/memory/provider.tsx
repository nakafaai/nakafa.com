"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { MemoryPage } from "@/components/user/settings/memory/list";
import {
  type MemoryReading,
  useMemoryReading,
} from "@/components/user/settings/memory/reading.client";
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
        <MemoryReader first={first} paused={paused}>
          {children}
        </MemoryReader>
      </NowContext>
    </StoreContext>
  );
}

/**
 * Reads the memories once for the whole page and shares them through a
 * context that changes as Convex answers. One reader serves every component,
 * because the pages a learner has loaded belong to the hook that loaded them,
 * and a second hook would load and subscribe to its own. This context may
 * change after hydration, unlike the provider's, because nothing below it
 * streams: every component under the Memory page is a client component, and
 * the editor's lazy code renders in the browser only, after the learner opens
 * it. React has no streamed HTML to discard when the value changes.
 */
function MemoryReader({
  children,
  first,
  paused,
}: {
  children: ReactNode;
  first: MemoryPage;
  paused: boolean;
}) {
  const query = useMemoryPage((state) => state.query);
  const reading = useMemoryReading(first, paused, query);

  return <ReadingContext value={reading}>{children}</ReadingContext>;
}

/**
 * Reads one selected slice of what the page shows: the memories to list, one
 * memory by id, whether memory is paused, and whether the next page can load.
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
