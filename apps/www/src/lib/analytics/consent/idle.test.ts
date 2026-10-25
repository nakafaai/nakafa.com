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
        yield* TestClock.adjust("499 millis");
        expect(fiber.pollUnsafe()).toBeUndefined();

        yield* TestClock.adjust("1 millis");
        yield* Fiber.join(fiber);
      })
  );

  it.effect(
    "completes at the browser's idle period, bounded by the timeout",
    () =>
      Effect.gen(function* () {
        const requestIdleCallback = vi.fn(
          (_onIdle: () => void, _options: { timeout: number }) => 1
        );
        Object.assign(window, {
          cancelIdleCallback: vi.fn(),
          requestIdleCallback,
        });

        const fiber = yield* Effect.forkChild(untilBrowserIdle);
        yield* TestClock.adjust("1 millis");
        expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
          timeout: 500,
        });
        expect(fiber.pollUnsafe()).toBeUndefined();

        const [request] = requestIdleCallback.mock.calls;
        request?.[0]();
        yield* Fiber.join(fiber);
      })
  );

  it.effect(
    "cancels the pending idle callback when the wait is interrupted",
    () =>
      Effect.gen(function* () {
        const cancelIdleCallback = vi.fn();
        Object.assign(window, {
          cancelIdleCallback,
          requestIdleCallback: vi.fn(() => 7),
        });

        const fiber = yield* Effect.forkChild(untilBrowserIdle);
        yield* TestClock.adjust("1 millis");
        yield* Fiber.interrupt(fiber);

        expect(cancelIdleCallback).toHaveBeenCalledWith(7);
      })
  );
});
