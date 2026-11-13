import { useRequired } from "@repo/design-system/hooks/required";
import { Effect, Fiber } from "effect";
import {
  createContext,
  type ReactNode,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { type ClockStoreApi, makeClock } from "@/components/player/clock";

const ClockContext = createContext<ClockStoreApi | null>(null);

/**
 * Gives every timer below it one clock: the server's time, moved by `offset` from this device's, ticking each
 * second while a timer watches it. The clock is created once and never changes, so the context value never
 * changes after hydration and streamed content below it keeps the HTML the server sent. A prerendered page
 * passes the time it was rendered at, which hydration shows before the clock takes over.
 */
export function ClockProvider({
  children,
  offset = 0,
  renderedAt,
}: {
  readonly children: ReactNode;
  /** What this device's clock is off by, as an admission read it; none until a page reads its own. */
  readonly offset?: number;
  readonly renderedAt?: number;
}) {
  const [store] = useState(() =>
    Effect.runSync(makeClock({ offset, rendered: renderedAt }))
  );

  return <ClockContext value={store}>{children}</ClockContext>;
}

/** The clock of the nearest provider; a part outside one is a mistake in the page. */
function useClockStore() {
  return useRequired(ClockContext, "useClockStore");
}

/** A reader that does not watch takes no ticks, so it renders only for its own reasons. */
function still() {
  return noop;
}

/** The release of a reader that never watched. */
function noop() {
  // A reader that does not watch holds no tick to release.
}

/**
 * The server's time on the provider's clock. An `active` reader watches it and renders again each second; one
 * that is not reads the clock's last time whenever it renders, which stays steady for a query's arguments.
 */
export function useNow(active: boolean) {
  const store = useClockStore();
  const { watch } = store.getState();

  return useSyncExternalStore(
    active ? watch : still,
    () => store.getState().now,
    () => store.getState().rendered
  );
}

/**
 * Moves the provider's clock onto the server's time once `read` gives the correction this device's clock
 * needs, so a device whose clock is wrong locks a section when the server does. The caller brings the read,
 * since a page that only shows a countdown has no use for its HTTP client.
 */
export function useServerTime(read: () => Effect.Effect<number>) {
  const store = useClockStore();

  useEffect(() => {
    const fiber = Effect.runFork(
      read().pipe(Effect.map((offset) => store.getState().correct(offset)))
    );
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, [read, store]);
}
