import { Schema } from "effect";
import { createContext, type ReactNode, use, useState } from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/**
 * Where the start of one try-out page stands: idle; starting an attempt that opens no section, while
 * its button waits for the page it leads to; or opening a section, while the page draws the player
 * that the section runs in.
 */
const TryoutStartPhaseSchema = Schema.Literals(["idle", "starting", "opening"]);

type TryoutStartPhase = typeof TryoutStartPhaseSchema.Type;

const TryoutStartContext = createContext<StoreApi<TryoutStartPhase> | null>(
  null
);

/**
 * Holds the start of one try-out page, which its start actions write as the learner presses and the
 * page reads to draw the player at once. The phase is plain state rather than a transition: the router
 * loads a navigation inside `startTransition`, so a transition that held the start would hold the
 * confirmation and the page with it until the server answered (ADR 0017). The page's client is keyed
 * by its attempt, so the phase starts idle again once the page shows the attempt that the start opened.
 */
export function TryoutStartProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createStore<TryoutStartPhase>()(() => "idle"));
  return <TryoutStartContext value={store}>{children}</TryoutStartContext>;
}

/** Reads the start store of the surrounding page. */
function useTryoutStartStore() {
  const store = use(TryoutStartContext);
  if (store === null) {
    throw new Error("useTryoutStart must be used within TryoutStartProvider");
  }
  return store;
}

/** Where the page's start stands. */
export function useTryoutStartPhase() {
  return useStore(useTryoutStartStore());
}

/** Moves the page's start: a start action sets its phase as it presses and sets it idle when the start fails. */
export function useSetTryoutStartPhase() {
  const store = useTryoutStartStore();
  return (phase: TryoutStartPhase) => store.setState(phase, true);
}
