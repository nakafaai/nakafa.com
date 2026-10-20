import { expect, type Locator } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { waitForStableCanvas } from "./canvas";
import { LINE_SCENE } from "./selector";
import { revealTimeoutMilliseconds } from "./timeout";

/**
 * Scene notices that come from the test browser or a held dependency.
 *
 * Playwright's headless shell renders WebGL with SwiftShader through ANGLE's
 * Vulkan backend, which reports Chromium's copy of each presented frame as a
 * ReadPixels stall, at most four times per GPU process. `recordPixelReadbacks`
 * proves page scripts read no pixels, and GPU-backed WebGL presents the same
 * frames without the notice.
 *
 * Fiber 9 constructs the THREE.Clock that three.js r183 deprecated in every
 * Canvas root. Fiber 10 removes it:
 * https://github.com/pmndrs/react-three-fiber/issues/3741
 */
const KNOWN_SCENE_DIAGNOSTICS = [
  /^\[\.WebGL-0x[\da-f]+\]GL Driver Message \(OpenGL, Performance, \w+, High\): GPU stall due to ReadPixels( \(this message will no longer repeat\))?$/,
  /^THREE\.Clock: This module has been deprecated\. Please use THREE\.Timer instead\.$/,
];

/** Whether a console notice is one of the known scene diagnostics above. */
export const isKnownSceneDiagnostic = (text: string) =>
  Arr.some(KNOWN_SCENE_DIAGNOSTICS, (known) => known.test(text));

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
