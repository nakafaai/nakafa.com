import { useDebouncedCallback } from "@mantine/hooks";
import { Option } from "effect";
import { createContext, type ReactNode, use, useEffect, useState } from "react";
import { useStore } from "zustand";
import {
  addressOf,
  PLAYER_QUESTION_PARAM,
  readAddressedKey,
  replaceSearchParam,
} from "@/components/player/address";
import type { PlayerMode } from "@/components/player/mode";
import {
  createPlayerStore,
  type PlayerStore,
  type PlayerStoreApi,
} from "@/components/player/store";
import { PageFrame } from "@/components/shared/content/frame";

const StoreContext = createContext<PlayerStoreApi | null>(null);

/** How long the current question stays put before the address names it, so a quick scroll writes it once. */
const ADDRESS_WAIT = 250;

/**
 * Gives the parts of one player the store of what the learner is doing: the
 * current question, the view, and the open overlay. The store is created once
 * and never changes, so the context value never changes after hydration and
 * streamed questions below it keep the HTML the server sent. What the
 * questions hold, such as answers, travels in props, because a context that
 * changed would make React discard that HTML.
 *
 * A player that renders only in the browser may keep its current question in its `address`: it opens on
 * the question the address names, and names each question the learner settles on, so a reload or a shared
 * link opens the same question in either view.
 */
export function PlayerProvider({
  address = false,
  children,
  keys,
  mode,
  review = false,
}: {
  /** Whether the address names the current question. */
  address?: boolean;
  children: ReactNode;
  /** The frozen order of the questions of the attempt. */
  keys: readonly string[];
  /** The view the server resolved, so hydration never switches it. */
  mode: PlayerMode;
  /** Whether the paper is finished, to read with nothing to answer, flag or finish. */
  review?: boolean;
}) {
  const [store] = useState(() =>
    createPlayerStore({
      keys,
      mode,
      review,
      start: address
        ? readAddressedKey(window.location.search, keys)
        : Option.none(),
    })
  );
  const write = useDebouncedCallback(
    (current: string | null) =>
      replaceSearchParam(PLAYER_QUESTION_PARAM, addressOf(keys, current)),
    ADDRESS_WAIT
  );

  useEffect(() => {
    if (!address) {
      return;
    }
    return store.subscribe((state, previous) => {
      if (state.current !== previous.current) {
        write(state.current);
      }
    });
  }, [address, store, write]);

  return (
    <StoreContext value={store}>
      <PageFrame width="column">{children}</PageFrame>
    </StoreContext>
  );
}

/** Reads one selected slice of the player store; a part re-renders only when its slice changes. */
export function usePlayer<T>(selector: (state: PlayerStore) => T) {
  const store = use(StoreContext);

  if (!store) {
    throw new Error("usePlayer must be used within PlayerProvider.");
  }

  return useStore(store, selector);
}
