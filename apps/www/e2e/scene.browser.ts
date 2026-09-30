import {
  type ConsoleMessage,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";
import { THREE_RENDER_MARGIN } from "@repo/design-system/components/three/data/constants";
import { Duration, Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { expectCanvasToMove, waitForStableCanvas } from "@/e2e/support/canvas";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";

/** three.js prefixes its own output, and Chromium names WebGL in its notices. */
const SCENE_DIAGNOSTIC = /THREE\.|WebGL/;
/** A paused canvas clears no frame for this long. */
const QUIET_WINDOW_MILLISECONDS = 1000;
const QUIET_WINDOW_ATTEMPTS = 5;

/**
 * Scene notices that come from the test browser or a held dependency.
 *
 * Playwright's headless shell renders WebGL with SwiftShader through ANGLE's
 * Vulkan backend, which reports Chromium's copy of each presented frame as a
 * ReadPixels stall, at most four times per GPU process. `reportPixelReadbacks`
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

/**
 * Reports page-script pixel readbacks, which the headless shell's own
 * ReadPixels notice would otherwise hide.
 */
function reportPixelReadbacks() {
  for (const { prototype } of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const readPixels = prototype.readPixels;
    Object.defineProperty(prototype, "readPixels", {
      configurable: true,
      value(this: unknown, ...args: unknown[]) {
        console.warn(new Error("WebGL readPixels from a page script").stack);
        return Reflect.apply(readPixels, this, args);
      },
      writable: true,
    });
  }
}

/** Observes unexplained three.js and WebGL notices for the page program. */
const withObservedSceneDiagnostics = Effect.fn(
  "NakafaE2E.withObservedSceneDiagnostics"
)(function* <A, E, R>(
  page: Page,
  use: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
  return yield* Effect.acquireUseRelease(
    Effect.sync(() => {
      const diagnostics: string[] = [];
      const recordDiagnostic = (message: ConsoleMessage) => {
        const text = message.text();
        if (
          SCENE_DIAGNOSTIC.test(text) &&
          !KNOWN_SCENE_DIAGNOSTICS.some((known) => known.test(text))
        ) {
          diagnostics.push(`${message.type()}: ${text}`);
        }
      };
      page.on("console", recordDiagnostic);
      return { diagnostics, recordDiagnostic };
    }),
    ({ diagnostics }) =>
      use.pipe(
        Effect.tap(() => Effect.sync(() => expect(diagnostics).toEqual([])))
      ),
    ({ recordDiagnostic }) =>
      Effect.sync(() => page.off("console", recordDiagnostic))
  );
});

/** Counts the frames each WebGL canvas clears on the canvas element. */
function countCanvasFrames() {
  for (const { prototype } of [WebGLRenderingContext, WebGL2RenderingContext]) {
    const clear = prototype.clear;
    Object.defineProperty(prototype, "clear", {
      configurable: true,
      value(
        this: WebGLRenderingContext | WebGL2RenderingContext,
        ...args: unknown[]
      ) {
        if (this.canvas instanceof HTMLCanvasElement) {
          const frames = Number(this.canvas.dataset.frames ?? 0);
          this.canvas.dataset.frames = String(frames + 1);
        }
        return Reflect.apply(clear, this, args);
      },
      writable: true,
    });
  }
}

/** Reads a canvas frame count without scrolling the canvas into view. */
function readFrames(canvas: Locator) {
  return canvas.evaluate((element) =>
    Number(element.getAttribute("data-frames") ?? 0)
  );
}

/** Waits until a canvas clears more frames than it has so far. */
const expectFramesToAdvance = Effect.fn("NakafaE2E.expectFramesToAdvance")(
  function* (canvas: Locator) {
    const frames = yield* Effect.promise(() => readFrames(canvas));
    yield* Effect.promise(() =>
      expect.poll(() => readFrames(canvas)).toBeGreaterThan(frames)
    );
  }
);

/** Waits until a canvas clears no frame through one whole quiet window. */
const expectFramesToHold = Effect.fn("NakafaE2E.expectFramesToHold")(function* (
  canvas: Locator
) {
  let cleared = Number.POSITIVE_INFINITY;
  // The pause lands once the observer reports, so allow a few windows.
  for (
    let attempt = 0;
    attempt < QUIET_WINDOW_ATTEMPTS && cleared > 0;
    attempt += 1
  ) {
    const before = yield* Effect.promise(() => readFrames(canvas));
    yield* Effect.sleep(Duration.millis(QUIET_WINDOW_MILLISECONDS));
    cleared = (yield* Effect.promise(() => readFrames(canvas))) - before;
  }
  yield* Effect.sync(() => expect(cleared).toBe(0));
});

/** Opens the pinned lesson and returns its deferred line-scene cards. */
const openLessonScenes = Effect.fn("NakafaE2E.openLessonScenes")(function* (
  page: Page
) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto(pinnedRoutes.material.en, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));

  const cards = page
    .locator('[data-slot="card"]')
    .filter({ has: page.locator('[data-slot="line-scene"]') });
  const count = yield* Effect.promise(() => cards.count());
  yield* Effect.sync(() => expect(count).toBeGreaterThan(0));
  return { cards, count };
});

/** Reveals one line-scene card and waits for its canvas to settle. */
const revealLineScene = Effect.fn("NakafaE2E.revealLineScene")(function* (
  card: Locator
) {
  const scene = card.locator('[data-slot="line-scene"]');
  const canvas = scene.locator("canvas");
  // Reveal the content-visibility card before scrolling its deferred scene.
  yield* Effect.promise(() =>
    expect(async () => {
      await card.scrollIntoViewIfNeeded();
      await expect(scene).toBeVisible();
      await scene.scrollIntoViewIfNeeded();
      expect(await canvas.isVisible()).toBe(true);
    }).toPass({ timeout: 30_000 })
  );
  yield* waitForStableCanvas(canvas);
  return canvas;
});

/** Mounts and settles every deferred line scene of the pinned lesson. */
const renderLessonScenes = Effect.fn("NakafaE2E.renderLessonScenes")(function* (
  page: Page
) {
  yield* Effect.promise(() => page.addInitScript(reportPixelReadbacks));
  const { cards, count } = yield* openLessonScenes(page);
  for (let index = 0; index < count; index += 1) {
    yield* revealLineScene(cards.nth(index));
  }
});

/** Proves a rotating scene stops far from the viewport and resumes in view. */
const pauseSceneAway = Effect.fn("NakafaE2E.pauseSceneAway")(function* (
  page: Page
) {
  yield* Effect.promise(() => page.addInitScript(countCanvasFrames));
  const { cards } = yield* openLessonScenes(page);
  const card = cards.first();
  const canvas = yield* revealLineScene(card);
  const rotation = card
    .locator("[data-coordinate-controls]")
    .getByRole("button", { name: "Automatic rotation" });

  // Automatic rotation draws every frame, like an animated lab.
  yield* Effect.promise(() => rotation.click());
  yield* Effect.promise(() =>
    expect(rotation).toHaveAttribute("aria-pressed", "true")
  );
  yield* expectFramesToAdvance(canvas);

  yield* Effect.promise(() =>
    page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    )
  );
  const distance = yield* Effect.promise(() =>
    canvas.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return Math.max(-bounds.bottom, bounds.top - window.innerHeight);
    })
  );
  yield* Effect.sync(() =>
    expect(distance).toBeGreaterThan(THREE_RENDER_MARGIN)
  );
  yield* expectFramesToHold(canvas);

  yield* Effect.promise(() => canvas.scrollIntoViewIfNeeded());
  yield* expectFramesToAdvance(canvas);
  const resumed = yield* Effect.promise(() => canvas.screenshot());
  yield* expectCanvasToMove(canvas, resumed);
});

for (const width of [390, 1440]) {
  test.describe(`lesson scenes at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("render without unexplained three.js or WebGL notices", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          withObservedSceneDiagnostics(page, renderLessonScenes(page))
        )
      );
    });

    test("pause far from the viewport and resume in view", async ({ page }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, pauseSceneAway(page))
      );
    });
  });
}
