import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  untilPageRead,
  untilPageSettled,
} from "@repo/design-system/lib/settle";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";

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
    Reflect.deleteProperty(navigator, "userActivation");
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

  it.effect(
    "waits for a gesture on a settled page, and later pages start at once",
    () =>
      Effect.gen(function* () {
        stubReadyState("complete");
        const removed = vi.spyOn(window, "removeEventListener");

        const waiting = yield* Effect.forkChild(untilPageRead);
        yield* Effect.yieldNow;
        yield* Effect.yieldNow;
        expect(waiting.pollUnsafe()).toBeUndefined();

        window.dispatchEvent(new Event("pointermove"));
        yield* Fiber.join(waiting);
        expect(removed).toHaveBeenCalledWith(
          "pointermove",
          expect.any(Function),
          {
            capture: true,
          }
        );
        removed.mockRestore();

        yield* untilPageRead;
      })
  );

  it.effect(
    "starts by itself ten seconds after a page that nobody touches",
    () =>
      Effect.gen(function* () {
        stubReadyState("complete");
        // A fresh module, as a new document: the test above saw this page's reader.
        vi.resetModules();
        const { untilPageRead: untilFreshPageRead } = yield* Effect.promise(
          () => import("@repo/design-system/lib/settle")
        );

        const waiting = yield* Effect.forkChild(untilFreshPageRead);
        yield* Effect.yieldNow;
        yield* Effect.yieldNow;
        yield* TestClock.adjust("9 seconds");
        expect(waiting.pollUnsafe()).toBeUndefined();

        yield* TestClock.adjust("1 second");
        yield* Fiber.join(waiting);
      })
  );

  it.effect(
    "starts at once for a picture that the reader's own press mounted",
    () =>
      Effect.gen(function* () {
        stubReadyState("complete");
        // A fresh module, as a new document that has not seen its reader yet.
        vi.resetModules();
        const { untilPageRead: untilFreshPageRead } = yield* Effect.promise(
          () => import("@repo/design-system/lib/settle")
        );

        const waiting = yield* Effect.forkChild(untilFreshPageRead);
        yield* Effect.yieldNow;
        yield* Effect.yieldNow;
        expect(waiting.pollUnsafe()).toBeUndefined();
        yield* Fiber.interrupt(waiting);

        // The press that opens a sheet happened before the sheet's picture listened.
        window.dispatchEvent(new Event("pointerdown"));
        yield* untilFreshPageRead;
      })
  );

  it.effect(
    "waits on a page the browser itself opened as active, since that is no reader",
    () =>
      Effect.gen(function* () {
        stubReadyState("complete");
        // A fresh module, as a new document that the browser's address bar opened.
        vi.resetModules();
        const { untilPageRead: untilFreshPageRead } = yield* Effect.promise(
          () => import("@repo/design-system/lib/settle")
        );
        Object.defineProperty(navigator, "userActivation", {
          configurable: true,
          value: { hasBeenActive: true },
        });

        const waiting = yield* Effect.forkChild(untilFreshPageRead);
        yield* Effect.yieldNow;
        yield* Effect.yieldNow;
        expect(waiting.pollUnsafe()).toBeUndefined();
        yield* Fiber.interrupt(waiting);
      })
  );

  it.effect(
    "loads what needs the reader's intent only at their first gesture, never by a wait",
    () =>
      Effect.gen(function* () {
        // A fresh module, as a new document that has not seen its reader yet.
        vi.resetModules();
        const { untilReaderGesture } = yield* Effect.promise(
          () => import("@repo/design-system/lib/settle")
        );

        const waiting = yield* Effect.forkChild(untilReaderGesture);
        yield* Effect.yieldNow;
        yield* TestClock.adjust("1 minute");
        expect(waiting.pollUnsafe()).toBeUndefined();

        window.dispatchEvent(new Event("scroll"));
        yield* Fiber.join(waiting);
        // The gesture is kept, so the next part that asks starts at once.
        yield* untilReaderGesture;
      })
  );
});
