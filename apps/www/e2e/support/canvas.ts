import { expect, type Locator } from "@playwright/test";
import { Effect } from "effect";

const VISUAL_ASSERTION_TIMEOUT = 5000;
const REQUIRED_STABLE_SAMPLES = 2;

/** Waits until consecutive screenshots of one rendered canvas match. */
export const waitForStableCanvas = Effect.fn("NakafaE2E.waitForStableCanvas")(
  function* (canvas: Locator) {
    let previousFrame = yield* Effect.promise(() => canvas.screenshot());
    let stableSamples = 0;

    yield* Effect.promise(() =>
      expect
        .poll(
          async () => {
            const currentFrame = await canvas.screenshot();

            if (currentFrame.equals(previousFrame)) {
              stableSamples += 1;
            } else {
              stableSamples = 0;
            }

            previousFrame = currentFrame;
            return stableSamples;
          },
          {
            intervals: [100, 200, 300],
            timeout: VISUAL_ASSERTION_TIMEOUT,
          }
        )
        .toBeGreaterThanOrEqual(REQUIRED_STABLE_SAMPLES)
    );
  }
);

/** Waits until a canvas renders a frame that differs from the baseline. */
export const expectCanvasToMove = Effect.fn("NakafaE2E.expectCanvasToMove")(
  function* (canvas: Locator, baseline: Uint8Array) {
    yield* Effect.promise(() =>
      expect
        .poll(
          async () => {
            const currentFrame = await canvas.screenshot();
            return currentFrame.equals(baseline);
          },
          {
            intervals: [50, 100, 200],
            timeout: VISUAL_ASSERTION_TIMEOUT,
          }
        )
        .toBe(false)
    );
  }
);
