import { Schema } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { createStore, type StoreApi, useStore } from "zustand";

/**
 * Where the start of one try-out page stands: idle; starting an attempt that opens no section, while
 * its button waits for the page it leads to; or opening a section, while the page draws the player that
 * the section runs in.
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

const TryoutPressContext = createContext<StoreApi<boolean> | null>(null);

/**
 * Holds a press that a try-out page cannot answer yet, while the button shows its loader until the page's
 * client and reads arrive. It stands above the page's trees: the learner's tree takes the visitor's place
 * when the client arrives, and the attempt the read brings keys a new tree, so a press kept inside them
 * would go with them and leave a button that did nothing.
 */
export function TryoutPressProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createStore<boolean>()(() => false));
  return <TryoutPressContext value={store}>{children}</TryoutPressContext>;
}

/** Reads the press store of the surrounding page. */
function useTryoutPressStore() {
  const store = use(TryoutPressContext);
  if (store === null) {
    throw new Error("useTryoutPress must be used within TryoutPressProvider");
  }
  return store;
}

/** Whether a press waits for the page to answer it. */
export function useTryoutPressed() {
  return useStore(useTryoutPressStore());
}

/** Keeps a press for the page to answer, or lets it go once it is answered. */
export function useSetTryoutPressed() {
  const store = useTryoutPressStore();
  return (pressed: boolean) => store.setState(pressed, true);
}

/**
 * Answers a waiting press from an action that takes the press's place once the read has answered, such as
 * the link that continues a running attempt, so the press does what the action does.
 */
export function useAnswerPress(answer: () => void) {
  const store = useTryoutPressStore();
  const answerPress = useEffectEvent(answer);
  useEffect(() => {
    const takePress = () => {
      if (store.getState()) {
        store.setState(false, true);
        answerPress();
      }
    };
    takePress();
    return store.subscribe(takePress);
  }, [store]);
}
