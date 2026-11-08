import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { TestClock } from "effect/testing";
import { makeClock, serverClockOffset } from "@/components/player/clock";

describe("makeClock", () => {
  it.effect(
    "reads the time once with its offset, and shows the rendered time to hydration",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(10_000);
        const page = yield* makeClock({ offset: 500, rendered: 2000 });
        const sitting = yield* makeClock({ offset: -500, rendered: undefined });

        expect(page.getState()).toMatchObject({
          now: 10_500,
          offset: 500,
          rendered: 2000,
        });
        expect(sitting.getState()).toMatchObject({
          now: 9500,
          rendered: 9500,
        });
      })
  );

  it.effect("stays still while nobody watches it", () =>
    Effect.gen(function* () {
      const clock = yield* makeClock({ offset: 0, rendered: undefined });

      yield* TestClock.adjust("5 seconds");

      expect(clock.getState().now).toBe(0);
    })
  );

  it.effect(
    "reads the time when its first watcher comes, then each second on one tick for every watcher",
    () =>
      Effect.gen(function* () {
        const clock = yield* makeClock({ offset: 0, rendered: undefined });
        yield* TestClock.adjust("3 seconds");
        const timer = vi.fn();
        const countdown = vi.fn();

        const stopTimer = clock.getState().watch(timer);
        expect(clock.getState().now).toBe(3000);
        const stopCountdown = clock.getState().watch(countdown);
        yield* TestClock.adjust("2 seconds");

        expect(clock.getState().now).toBe(5000);
        // The first watcher hears its own first reading too; after that both hear the two ticks once each.
        expect(timer).toHaveBeenCalledTimes(3);
        expect(countdown).toHaveBeenCalledTimes(2);

        stopTimer();
        yield* TestClock.adjust("1 second");
        expect(clock.getState().now).toBe(6000);
        expect(timer).toHaveBeenCalledTimes(3);

        stopCountdown();
        yield* TestClock.adjust("3 seconds");
        expect(clock.getState().now).toBe(6000);
        expect(countdown).toHaveBeenCalledTimes(3);
      })
  );

  it.effect(
    "moves every watcher onto a correction at once and ticks with it",
    () =>
      Effect.gen(function* () {
        const clock = yield* makeClock({ offset: 0, rendered: undefined });
        const timer = vi.fn();
        const stop = clock.getState().watch(timer);

        clock.getState().correct(4000);
        expect(clock.getState()).toMatchObject({ now: 4000, offset: 4000 });
        yield* TestClock.adjust("1 second");
        expect(clock.getState().now).toBe(5000);
        stop();
      })
  );
});

describe("serverClockOffset", () => {
  it("reads the server's time against the middle of the round trip", () => {
    expect(
      serverClockOffset({ receivedAt: 1200, sentAt: 1000, serverNow: 1100 })
    ).toBe(0);
    expect(
      serverClockOffset({ receivedAt: 1200, sentAt: 1000, serverNow: 5100 })
    ).toBe(4000);
  });

  it("is negative when the device's clock runs ahead of the server", () => {
    expect(
      serverClockOffset({ receivedAt: 1200, sentAt: 1000, serverNow: 100 })
    ).toBe(-1000);
  });
});
