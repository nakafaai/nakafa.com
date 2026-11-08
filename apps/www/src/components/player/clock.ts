import { Clock, Duration, Effect, Fiber, Schema } from "effect";
import { createStore, type StoreApi } from "zustand";

/** How often a watched clock reads the time again. */
const TICK = Duration.seconds(1);

/** What one clock knows, written only by its own ticks and corrections. */
const ClockStateSchema = Schema.Struct({
  /** The server's time at the clock's last reading, in epoch milliseconds. */
  now: Schema.Finite,
  /** What this device's clock is off by, added to every reading. */
  offset: Schema.Finite,
  /** The time the page's HTML shows, which hydration keeps, so the first render matches the server's. */
  rendered: Schema.Finite,
});

type ClockState = typeof ClockStateSchema.Type;

interface ClockActions {
  /** Takes a new correction and reads the time again with it, so every watcher moves at once. */
  correct: (offset: number) => void;
  /**
   * Calls `listener` after each reading while it watches, and returns the way to stop. The clock reads the
   * time at once when its first watcher comes, then each second until its last watcher leaves.
   */
  watch: (listener: () => void) => () => void;
}

type ClockStore = ClockState & ClockActions;

export type ClockStoreApi = StoreApi<ClockStore>;

/**
 * The correction that turns this device's clock into the server's, read from one round trip. The server
 * stamped its answer with its own time, which fell between the moment the request left this device and
 * the moment its answer arrived, so the middle of that round trip is the best guess of the server's time
 * at the send. A device whose clock is wrong gets the right time left once it applies this correction.
 */
export function serverClockOffset(round: {
  readonly receivedAt: number;
  readonly sentAt: number;
  readonly serverNow: number;
}): number {
  return round.serverNow - (round.sentAt + round.receivedAt) / 2;
}

/**
 * Makes one clock: the server's time, read from Effect's `Clock` and moved by `offset`. It reads the time
 * once when it is made, so a reader that never watches sees the time the clock started at rather than the
 * time a prerendered page was built at, and while anyone watches it reads again each second on one shared
 * tick. The tick runs on the services the clock was
 * made with, so the browser's clock drives it on a page and a test clock drives it in a test.
 */
export const makeClock = Effect.fn("player.clock.make")(function* ({
  offset,
  rendered,
}: {
  readonly offset: number;
  /** The time the server rendered the page at; a page the server does not render shows the clock's first reading. */
  readonly rendered: number | undefined;
}) {
  const services = yield* Effect.context<never>();
  const run = Effect.runSyncWith(services);
  const fork = Effect.runForkWith(services);
  const read = (correction: number) =>
    run(Effect.map(Clock.currentTimeMillis, (millis) => millis + correction));
  let watchers = 0;
  let ticker: Fiber.Fiber<never> | null = null;

  return createStore<ClockStore>()((set, get, api) => {
    const tick = Effect.sync(() => set({ now: read(get().offset) }));
    const ticks = Effect.forever(Effect.andThen(Effect.sleep(TICK), tick));
    const now = read(offset);

    return {
      correct: (correction) =>
        set({ now: read(correction), offset: correction }),
      now,
      offset,
      rendered: rendered ?? now,
      watch: (listener) => {
        const unsubscribe = api.subscribe(listener);
        watchers += 1;
        if (ticker === null) {
          set({ now: read(get().offset) });
          ticker = fork(ticks);
        }
        return () => {
          unsubscribe();
          watchers -= 1;
          if (watchers === 0 && ticker !== null) {
            fork(Fiber.interrupt(ticker));
            ticker = null;
          }
        };
      },
    };
  });
});
