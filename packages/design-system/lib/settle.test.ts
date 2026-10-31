import { afterEach, describe, expect, it } from "@effect/vitest";
import { untilPageRead, untilPageSettled } from "@repo/design-system/lib/settle";
import { Effect, Fiber, TestClock } from "effect";

/** Gives the window an idle callback that the test controls, and returns the stubs. */
function stubIdleCallback() {
  const requestIdleCallback = vi.fn(
    (_callback: () => void, _options?: { readonly timeout: number }) => 7
  );
  const cancelIdleCallback = vi.fn((_handle: number) => undefined);
  Object.defineProperty(window, "requestIdleCallback", {
    configurable: true,
    value: requestIdleCallback,
  });
  Object.defineProperty(window, "cancelIdleCallback", {
    configurable: true,
    value: cancelIdleCallback,
  });
  return { cancelIdleCallback, requestIdleCallback };
}

/** Sets what the document says about its loading. */
function stubReadyState(state: DocumentReadyState) {
  Object.defineProperty(document, "readyState", {
    configurable: true,
    value: state,
  });
}

describe("waiting for the page to settle", () => {
  afterEach(() => {
    Reflect.deleteProperty(window, "requestIdleCallback");
    Reflect.deleteProperty(window, "cancelIdleCallback");
    Reflect.deleteProperty(document, "readyState");
  });

  it.effect(
    "waits for the load event, then for the browser's idle moment within a second",
    () =>
      Effect.gen(function* () {
        const { requestIdleCallback } = stubIdleCallback();
        stubReadyState("interactive");

        const waiting = yield* Effect.forkChild(untilPageSettled);
        yield* Effect.yieldNow;
        expect(requestIdleCallback).not.toHaveBeenCalled();

        window.dispatchEvent(new Event("load"));
        yield* Effect.yieldNow;
        expect(requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
          timeout: 1000,
        });

        requestIdleCallback.mock.calls[0]?.[0]();
        yield* Fiber.join(waiting);
      })
  );

  it.effect(
    "stops listening and cancels the idle wait when the caller stops waiting",
    () =>
      Effect.gen(function* () {
        const { cancelIdleCallback } = stubIdleCallback();
        stubReadyState("loading");
        const removed = vi.spyOn(window, "removeEventListener");

        const beforeLoad = yield* Effect.forkChild(untilPageSettled);
        yield* Effect.yieldNow;
        yield* Fiber.interrupt(beforeLoad);
        expect(removed).toHaveBeenCalledWith("load", expect.any(Function));
        removed.mockRestore();

        stubReadyState("complete");
        const beforeIdle = yield* Effect.forkChild(untilPageSettled);
        yield* Effect.yieldNow;
        yield* Fiber.interrupt(beforeIdle);
        expect(cancelIdleCallback).toHaveBeenCalledWith(7);
      })
  );

  it.effect("settles at the load where the browser has no idle callback", () =>
    Effect.gen(function* () {
      stubReadyState("complete");

      yield* untilPageSettled;
    })
  );

  it.effect("waits for a gesture on a settled page, and later pages start at once", () =>
    Effect.gen(function* () {
      stubReadyState("complete");
      const removed = vi.spyOn(window, "removeEventListener");

      const waiting = yield* Effect.forkChild(untilPageRead);
      yield* Effect.yieldNow;
      yield* Effect.yieldNow;
      expect(waiting.pollUnsafe()).toBeUndefined();

      window.dispatchEvent(new Event("pointermove"));
      yield* Fiber.join(waiting);
      expect(removed).toHaveBeenCalledWith("pointermove", expect.any(Function), {
        capture: true,
      });
      removed.mockRestore();

      yield* untilPageRead;
    })
  );
});
