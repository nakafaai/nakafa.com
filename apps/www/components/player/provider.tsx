"use client";

import { createContext, type ReactNode, use, useState } from "react";
import { useStore } from "zustand";
import type { PlayerMode } from "@/components/player/mode";
import {
  createPlayerStore,
  type PlayerStore,
  type PlayerStoreApi,
} from "@/components/player/store";

const StoreContext = createContext<PlayerStoreApi | null>(null);

/**
 * Gives the parts of one player the store of what the learner is doing: the
 * current question, the view, and the open overlay. The store is created once
 * and never changes, so the context value never changes after hydration and
 * streamed questions below it keep the HTML the server sent. What the
 * questions hold, such as answers, travels in props, because a context that
 * changed would make React discard that HTML.
 */
export function PlayerProvider({
  children,
  keys,
  mode,
}: {
  children: ReactNode;
  /** The frozen order of the questions of the attempt. */
  keys: readonly string[];
  /** The view the server resolved, so hydration never switches it. */
  mode: PlayerMode;
}) {
  const [store] = useState(() => createPlayerStore({ keys, mode }));

  return <StoreContext value={store}>{children}</StoreContext>;
}

/** Reads one selected slice of the player store; a part re-renders only when its slice changes. */
export function usePlayer<T>(selector: (state: PlayerStore) => T) {
  const store = use(StoreContext);

  if (!store) {
    throw new Error("usePlayer must be used within PlayerProvider.");
  }

  return useStore(store, selector);
}
