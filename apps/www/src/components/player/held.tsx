import { ClientOnly } from "@tanstack/react-router";
import { Array as Arr, Effect, Fiber } from "effect";
import {
  createContext,
  type ReactNode,
  Suspense,
  use,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { useStore } from "zustand";
import { createPaperHold } from "@/components/player/hold";

/** How long a paper waits, so a lost connection never leaves it out of sight. */
const HOLD_LIMIT = "10 seconds";

/** Outside a held paper, as on a proctor's view of a student's screen, a text draws as soon as it can. */
const PaperHoldContext = createContext(createPaperHold([], true));

/**
 * Keeps a paper out of sight until its first screen can draw. A text arrives apart from the paper around it, and a
 * line of it moves everything below, so the paper shows whole and nothing moves: the sitting, the try and the editor
 * all wait this way. The paper keeps its place in the layout while it waits.
 *
 * A `primer` is the lazy code the paper's texts need, drawn once out of sight. Lazy code suspends on its first use,
 * and React holds a boundary's reveal for a moment after its fallback, so a text that used it first would stand empty
 * on a paper already shown. Texts wait for the primer instead (`usePaperDrawable`), and then draw in one frame.
 */
export function HeldPaper({
  children,
  keys,
  primer,
}: {
  readonly children: ReactNode;
  /** The texts of the paper, in reading order. */
  readonly keys: readonly string[];
  /** The lazy code the texts need; a paper with none draws them at once. */
  readonly primer?: ReactNode;
}) {
  const [store] = useState(() => createPaperHold(keys, primer === undefined));
  const shown = useStore(
    store,
    (state) => state.drawable && Arr.isReadonlyArrayEmpty(state.waiting)
  );

  useEffect(() => {
    const limit = Effect.runFork(
      Effect.sleep(HOLD_LIMIT).pipe(
        Effect.andThen(Effect.sync(store.getState().release))
      )
    );
    return () => {
      Effect.runFork(Fiber.interrupt(limit));
    };
  }, [store]);

  return (
    <PaperHoldContext value={store}>
      {primer === undefined ? null : (
        <div hidden>
          <ClientOnly fallback={null}>
            <Suspense fallback={null}>
              {primer}
              <PrimerDone />
            </Suspense>
          </ClientOnly>
        </div>
      )}
      <div className={shown ? undefined : "invisible"}>{children}</div>
    </PaperHoldContext>
  );
}

/** Stands after the primer in its boundary, so it mounts in the commit that shows the primer's code has loaded. */
function PrimerDone() {
  const store = use(PaperHoldContext);

  useLayoutEffect(() => {
    store.getState().prime();
  }, [store]);

  return null;
}

/** Whether a text may draw now: its code stands ready, so it draws in the frame it arrives. */
export const usePaperDrawable = () =>
  useStore(use(PaperHoldContext), (state) => state.drawable);

/**
 * Whether a text of the paper may read now: a long paper reads its texts a few at a time. A text the reader stands on
 * reads next, and the texts after it follow, so a jump down the paper never waits for the pages it passed. Outside a
 * held paper every text reads at once.
 */
export function usePaperTurn(key: string, wanted: boolean) {
  const store = use(PaperHoldContext);
  const turn = useStore(store, (state) => !Arr.contains(state.queued, key));

  useLayoutEffect(() => {
    if (wanted && !turn) {
      store.getState().hurry(key);
    }
  }, [key, store, turn, wanted]);

  return turn;
}

/**
 * Tells the paper that one of its texts can draw, before the browser paints, so a text that is known at once never
 * shows an empty frame.
 */
export function usePaperText(key: string, settled: boolean) {
  const store = use(PaperHoldContext);

  useLayoutEffect(() => {
    if (settled) {
      store.getState().settle(key);
    }
  }, [key, settled, store]);
}
