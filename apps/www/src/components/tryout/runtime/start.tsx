import { useRequired } from "@repo/design-system/hooks/required";
import { useLocation, useRouter } from "@tanstack/react-router";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import {
  createContext,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useState,
} from "react";
import type { StoreApi } from "zustand";
import { createStore, useStore } from "zustand";
import type { LinkTarget } from "@/lib/routing/link";

/**
 * Where a try-out start stands: idle; starting an attempt that opens no section, while its button waits
 * for the page it leads to; or opening a section, while the pages it moves between draw the player that
 * the section runs in.
 */
const TryoutStartPhaseSchema = Schema.Literals(["idle", "starting", "opening"]);

type TryoutStartPhase = typeof TryoutStartPhaseSchema.Type;

/** A start and the pages it belongs to: the page it was pressed on, then the page it leads to. */
interface TryoutStart {
  readonly pages: readonly string[];
  readonly phase: TryoutStartPhase;
}

const IDLE: TryoutStart = { pages: [], phase: "idle" };

const TryoutStartContext = createContext<StoreApi<TryoutStart> | null>(null);

/**
 * Holds the learner's try-out start, which start actions write as the learner presses and the pages read
 * to draw the player at once. It stands above every try-out page, so a start pressed in a set's pane keeps
 * drawing the player while the router moves to the section it opens and that page reads the attempt. A
 * start belongs to the pages it moves between, and any other page reads it as idle, so a learner who
 * leaves mid-start finds no player waiting elsewhere. The phase is plain state rather than a transition:
 * the router loads a navigation inside `startTransition`, so a transition that held the start would hold
 * the confirmation and the page with it until the server answered (ADR 0017).
 */
export function TryoutStartProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createStore<TryoutStart>()(() => IDLE));
  return <TryoutStartContext value={store}>{children}</TryoutStartContext>;
}

/** Reads the learner's start store. */
function useTryoutStartStore() {
  return useRequired(TryoutStartContext, "useTryoutStartStore");
}

/** Where the start stands on this page: idle on a page the start does not belong to. */
export function useTryoutStartPhase() {
  const pathname = useLocation({ select: (location) => location.pathname });
  return useStore(useTryoutStartStore(), (start) =>
    Arr.contains(start.pages, pathname) ? start.phase : "idle"
  );
}

/**
 * Moves the learner's start: a start action begins it on the page it is pressed on, leads it to the page
 * it navigates to once the server answers, and ends it when the start fails.
 */
export function useTryoutStart() {
  const store = useTryoutStartStore();
  const router = useRouter();
  return {
    begin: (phase: Exclude<TryoutStartPhase, "idle">) =>
      store.setState({ pages: [router.state.location.pathname], phase }, true),
    end: () => store.setState(IDLE, true),
    lead: (target: LinkTarget) =>
      store.setState(
        (start) =>
          start.phase === "idle"
            ? start
            : {
                pages: [...start.pages, router.buildLocation(target).pathname],
                phase: start.phase,
              },
        true
      ),
  };
}

/**
 * Ends the start once the page shows the attempt it opened, before the browser paints, so the page that
 * reads the attempt draws it from then on and its later states, such as the review, are never held as the
 * player opening.
 */
export function useEndTryoutStart() {
  const store = useTryoutStartStore();
  useLayoutEffect(() => {
    store.setState(IDLE, true);
  }, [store]);
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
  return useRequired(TryoutPressContext, "useTryoutPressStore");
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
