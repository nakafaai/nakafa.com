import { afterEach, describe, expect, it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { untilBrowserIdle } from "@/lib/analytics/consent/idle";

/** Removes the idle callback API that a test stubs on the shared window. */
function restoreIdleCallbacks() {
  Reflect.deleteProperty(window, "requestIdleCallback");
  Reflect.deleteProperty(window, "cancelIdleCallback");
}

describe("untilBrowserIdle", () => {
  afterEach(restoreIdleCallbacks);

  it.effect(
    "waits for the fallback delay where the browser has no idle callback",
    () =>
      Effect.gen(function* () {
        restoreIdleCallbacks();

        const fiber = yield* Effect.forkChild(untilBrowserIdle);
        yield* TestClock.adjust("1 second");
        expect(fiber.pollUnsafe()).toBeUndefined();

        yield* TestClock.adjust("1 second");
        yield* Fiber.join(fiber);
      })
  );

  it.effect(
    "completes at the browser's idle period, bounded by the timeout",
    () =>
      Effect.gen(function* () {
        const requests: Array<{ callback: () => void; timeout: number }> = [];
        Object.assign(window, {
          cancelIdleCallback: () => undefined,
          requestIdleCallback: (
            callback: () => void,
            options: { timeout: number }
          ) => {
            requests.push({ callback, timeout: options.timeout });
            return requests.length;
          },
        });

        const fiber = yield* Effect.forkChild(untilBrowserIdle);
        yield* TestClock.adjust("1 millis");
        expect(requests).toHaveLength(1);
        expect(requests[0]?.timeout).toBe(2000);
        expect(fiber.pollUnsafe()).toBeUndefined();

        requests[0]?.callback();
        yield* Fiber.join(fiber);
      })
  );

  it.effect(
    "cancels the pending idle callback when the wait is interrupted",
    () =>
      Effect.gen(function* () {
        const cancelled: number[] = [];
        Object.assign(window, {
          cancelIdleCallback: (handle: number) => {
            cancelled.push(handle);
          },
          requestIdleCallback: () => 7,
        });

        const fiber = yield* Effect.forkChild(untilBrowserIdle);
        yield* TestClock.adjust("1 millis");
        yield* Fiber.interrupt(fiber);

        expect(cancelled).toEqual([7]);
      })
  );
});
