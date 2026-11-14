import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { untilNearScreen } from "@repo/design-system/lib/screen";
import { Array as Arr, Effect, Fiber } from "effect";

let observers: ObserverStub[] = [];

/** An observer that tells nothing by itself: the tests say where the element stands. */
class ObserverStub {
  readonly callback: (
    reports: readonly {
      boundingClientRect: { top: number };
      isIntersecting: boolean;
    }[]
  ) => void;
  disconnected = false;
  readonly options: IntersectionObserverInit | undefined;
  target: Element | undefined;

  constructor(
    callback: ObserverStub["callback"],
    options?: IntersectionObserverInit
  ) {
    this.callback = callback;
    this.options = options;
    observers = Arr.append(observers, this);
  }

  observe(element: Element) {
    this.target = element;
  }

  disconnect() {
    this.disconnected = true;
  }
}

/** Says where the watched element stands: whether it meets the screen, and its top edge. */
function report(isIntersecting: boolean, top: number) {
  Arr.forEach(observers, (observer) =>
    observer.callback([{ boundingClientRect: { top }, isIntersecting }])
  );
}

beforeEach(() => {
  observers = [];
  vi.stubGlobal("IntersectionObserver", ObserverStub);
  vi.stubGlobal("innerHeight", 800);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("waiting on an element's place on the screen", () => {
  it.effect(
    "completes once the element comes within the margin, and stops watching",
    () =>
      Effect.gen(function* () {
        const element = document.createElement("div");

        const waiting = yield* Effect.forkChild(
          untilNearScreen(element, "100%")
        );
        yield* Effect.yieldNow;
        expect(observers[0]?.target).toBe(element);
        expect(observers[0]?.options).toEqual({ rootMargin: "100% 0px" });

        report(false, 2000);
        yield* Effect.yieldNow;
        expect(waiting.pollUnsafe()).toBeUndefined();

        report(true, 900);
        yield* Fiber.join(waiting);
        expect(observers[0]?.disconnected).toBe(true);
      })
  );

  it.effect("stops the watcher when its wait is interrupted", () =>
    Effect.gen(function* () {
      const near = yield* Effect.forkChild(
        untilNearScreen(document.createElement("div"), "50%")
      );
      yield* Effect.yieldNow;

      yield* Fiber.interrupt(near);

      expect(observers[0]?.disconnected).toBe(true);
    })
  );
});
