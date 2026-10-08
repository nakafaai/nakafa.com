import { expect, type Locator, type Page } from "@playwright/test";
import { Effect, Schema } from "effect";

interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

const ACTIVATION_PROBE_TIMEOUT_MILLISECONDS = 1000;
const PRESS_TIMEOUT_MILLISECONDS = 15_000;
const TOUCH_MOVE_STEPS = 5;

/**
 * Clicks or taps a control without waiting for the navigation it starts. The
 * press gives up after 15 seconds.
 */
export function press(control: Locator, hasTouch: boolean) {
  return hasTouch
    ? control.tap({ noWaitAfter: true, timeout: PRESS_TIMEOUT_MILLISECONDS })
    : control.click({ noWaitAfter: true, timeout: PRESS_TIMEOUT_MILLISECONDS });
}

/** Repeats a real activation until its client-owned surface becomes visible. */
export const activateUntilVisible = Effect.fn("NakafaE2E.activateUntilVisible")(
  function* (trigger: Locator, surface: Locator, timeoutMilliseconds: number) {
    yield* Effect.promise(() =>
      expect(async () => {
        if (await surface.isVisible()) {
          return;
        }

        await trigger.click({ timeout: timeoutMilliseconds });
        await expect(surface).toBeVisible({
          timeout: ACTIVATION_PROBE_TIMEOUT_MILLISECONDS,
        });
      }).toPass({ intervals: [100], timeout: timeoutMilliseconds })
    );
    return surface;
  }
);

/** One interactive surface did not expose measurable bounds for a gesture. */
export class SurfaceBoundsMissing extends Schema.TaggedError<SurfaceBoundsMissing>()(
  "SurfaceBoundsMissing",
  { surface: Schema.String }
) {
  get message() {
    return `Surface bounds are missing: surface=${this.surface}.`;
  }
}

/** Reads the bounds a gesture starts from, failing by surface name when absent. */
export const readBounds = Effect.fn("NakafaE2E.readBounds")(function* (
  locator: Locator,
  surface: string
) {
  const bounds = yield* Effect.promise(() => locator.boundingBox());
  if (!bounds) {
    return yield* new SurfaceBoundsMissing({ surface });
  }
  return bounds;
});

/** Dispatches one real touch drag while always releasing its CDP session. */
export const dragTouch = Effect.fn("NakafaE2E.dragTouch")(function* (
  page: Page,
  start: TouchPoint,
  end: TouchPoint
) {
  yield* Effect.acquireUseRelease(
    Effect.promise(() => page.context().newCDPSession(page)),
    (session) =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          session.send("Input.dispatchTouchEvent", {
            touchPoints: [start],
            type: "touchStart",
          })
        );
        for (let step = 1; step <= TOUCH_MOVE_STEPS; step += 1) {
          yield* Effect.promise(() =>
            session.send("Input.dispatchTouchEvent", {
              touchPoints: [
                {
                  x: start.x + ((end.x - start.x) * step) / TOUCH_MOVE_STEPS,
                  y: start.y + ((end.y - start.y) * step) / TOUCH_MOVE_STEPS,
                },
              ],
              type: "touchMove",
            })
          );
        }
        yield* Effect.promise(() =>
          session.send("Input.dispatchTouchEvent", {
            touchPoints: [],
            type: "touchEnd",
          })
        );
      }),
    (session) => Effect.promise(() => session.detach())
  );
});
