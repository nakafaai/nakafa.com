import { expect, type Locator } from "@playwright/test";
import { Effect } from "effect";
import { waitForStableCanvas } from "@/e2e/support/canvas";
import { LINE_SCENE } from "@/e2e/support/selector";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Reveals one line-scene card and waits for its canvas to settle. */
export const revealLineScene = Effect.fn("NakafaE2E.revealLineScene")(
  function* (card: Locator) {
    const scene = card.locator(LINE_SCENE);
    const canvas = scene.locator("canvas");
    // Reveal the content-visibility card before scrolling its deferred scene.
    yield* Effect.promise(() =>
      expect(async () => {
        await card.scrollIntoViewIfNeeded();
        await expect(scene).toBeVisible();
        await scene.scrollIntoViewIfNeeded();
        expect(await canvas.isVisible()).toBe(true);
      }).toPass({ timeout: revealTimeoutMilliseconds })
    );
    yield* waitForStableCanvas(canvas);
    return canvas;
  }
);
