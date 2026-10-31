import { Effect, Fiber } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import { type StoreApi, useStore } from "zustand";
import { createPaperHold, type PaperHold } from "@/components/player/hold";

/** How long a paper waits for its texts, so a lost connection never leaves it out of sight. */
const HOLD_LIMIT = "10 seconds";

const PaperHoldContext = createContext<StoreApi<PaperHold> | null>(null);

/**
 * Keeps a paper out of sight until the texts of its first screen can draw. A text arrives apart from the paper
 * around it, and a line of it moves everything below, so the paper shows whole and nothing moves: the sitting, the
 * try and the editor all wait this way. The paper keeps its place in the layout while it waits.
 */
export function HeldPaper({
  children,
  keys,
  ready,
}: {
  readonly children: ReactNode;
  /** The texts of the paper, in reading order. */
  readonly keys: readonly string[];
  /** Whether the code that draws the texts has loaded. */
  readonly ready: boolean;
}) {
  const [store] = useState(() => createPaperHold(keys));
  const waiting = useStore(store, (state) => state.waiting.length > 0);

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
      <div className={ready && !waiting ? undefined : "invisible"}>
        {children}
      </div>
    </PaperHoldContext>
  );
}

/**
 * Tells the paper that one of its texts can draw, before the browser paints, so a text that is known at once never
 * shows an empty frame.
 */
export function usePaperText(key: string, settled: boolean) {
  const store = use(PaperHoldContext);

  useLayoutEffect(() => {
    if (settled) {
      store?.getState().settle(key);
    }
  }, [key, settled, store]);
}
