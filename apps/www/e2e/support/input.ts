import { expect, type Locator, type Page } from "@playwright/test";
import { Effect, Schema } from "effect";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

const ACTIVATION_PROBE_TIMEOUT_MILLISECONDS = 1000;
const PRESS_TIMEOUT_MILLISECONDS = readinessTimeoutMilliseconds;
const TOUCH_MOVE_STEPS = 5;

/** Where a press lands on its control, in CSS pixels from the control's corner. */
interface PressOptions {
  readonly position?: { readonly x: number; readonly y: number };
}

/**
 * Clicks or taps a control without waiting for the navigation it starts. The
 * press gives up after 15 seconds.
 */
export function press(
  control: Locator,
  hasTouch: boolean,
  options: PressOptions = {}
) {
  const pressOptions = {
    noWaitAfter: true,
    timeout: PRESS_TIMEOUT_MILLISECONDS,
    ...options,
  };
  return hasTouch ? control.tap(pressOptions) : control.click(pressOptions);
}

/** The first link to `href` that the page shows, wherever it sits on the page. */
export function visibleLink(page: Page, href: string) {
  return page.locator(`a[href="${href}"]`).filter({ visible: true }).first();
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

/** The interactive surfaces a swipe starts on. */
const SwipeSurfaceSchema = Schema.Literals([
  "consent-drawer",
  "contributor-drawer",
]);

/** One interactive surface did not expose measurable bounds for a gesture. */
export class SurfaceBoundsMissing extends Schema.TaggedError<SurfaceBoundsMissing>()(
  "SurfaceBoundsMissing",
  { surface: SwipeSurfaceSchema }
) {
  get message() {
    return `Surface bounds are missing: surface=${this.surface}.`;
  }
}

/** Reads the bounds a gesture starts from, failing by surface name when absent. */
export const readBounds = Effect.fn("NakafaE2E.readBounds")(function* (
  locator: Locator,
  surface: typeof SwipeSurfaceSchema.Type
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

/** How far a swipe travels once its touch starts, in CSS pixels. */
const SWIPE_DISTANCE = 320;

/** The rectangle of one surface, in CSS pixels. */
interface SurfaceBounds {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

/** Where a downward swipe starts and which edge stops it. */
interface SwipeDown {
  /** Pixels below the surface's top edge where the touch starts. */
  readonly inset: number;
  /**
   * The edge that stops the swipe: the viewport's bottom, or the surface's
   * bottom less four pixels.
   */
  readonly stopAt: "surface" | "viewport";
}

/**
 * Swipes down through the middle of a surface, the way a learner dismisses a
 * drawer. The touch starts `inset` pixels below the top edge and travels
 * `SWIPE_DISTANCE` pixels, or until `stopAt` allows.
 */
export const swipeDown = Effect.fn("NakafaE2E.swipeDown")(function* (
  page: Page,
  bounds: SurfaceBounds,
  swipe: SwipeDown
) {
  const x = bounds.x + bounds.width / 2;
  const startY = bounds.y + swipe.inset;
  const stopY =
    swipe.stopAt === "viewport"
      ? (page.viewportSize()?.height ?? 844)
      : bounds.y + bounds.height - 4;
  yield* dragTouch(
    page,
    { x, y: startY },
    { x, y: Math.min(startY + SWIPE_DISTANCE, stopY) }
  );
});
