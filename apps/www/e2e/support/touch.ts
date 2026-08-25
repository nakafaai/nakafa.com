import type { Page } from "@playwright/test";
import { Effect } from "effect";

interface TouchPoint {
  readonly x: number;
  readonly y: number;
}

const TOUCH_MOVE_STEPS = 5;

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
