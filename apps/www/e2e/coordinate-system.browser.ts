import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";

const LINEAR_SYSTEM_ROUTE =
  "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear";
const MANY_SOLUTIONS_TITLE = "Sistem Persamaan Linear dengan Banyak Solusi";
const VISUAL_ASSERTION_TIMEOUT = 5000;
const REQUIRED_STABLE_SAMPLES = 2;

const waitForStableCanvas = Effect.fn("NakafaE2E.waitForStableCanvas")(
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

const expectCanvasToMove = Effect.fn("NakafaE2E.expectCanvasToMove")(function* (
  canvas: Locator,
  baseline: Uint8Array
) {
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
});

const observeDrawingBufferSize = Effect.fn(
  "NakafaE2E.observeDrawingBufferSize"
)(function* (canvas: Locator) {
  const started = yield* Effect.promise(() =>
    canvas.evaluate((element) => {
      if (!(element instanceof HTMLCanvasElement)) {
        return false;
      }

      const initialHeight = element.height;
      const initialWidth = element.width;
      element.dataset.drawingBufferChanged = "false";

      const observer = new MutationObserver(() => {
        if (
          element.height === initialHeight &&
          element.width === initialWidth
        ) {
          return;
        }

        element.dataset.drawingBufferChanged = "true";
        observer.disconnect();
      });
      observer.observe(element, {
        attributeFilter: ["height", "width"],
        attributes: true,
      });
      return true;
    })
  );

  yield* Effect.sync(() => expect(started).toBe(true));
});

const orbitScene = Effect.fn("NakafaE2E.orbitScene")(function* (
  page: Page,
  canvas: Locator
) {
  const bounds = yield* Effect.promise(() => canvas.boundingBox());
  yield* Effect.sync(() => expect(bounds).not.toBeNull());
  if (!bounds) {
    return;
  }

  const startX = bounds.x + bounds.width * 0.4;
  const startY = bounds.y + bounds.height * 0.55;
  const endX = bounds.x + bounds.width * 0.7;
  const endY = bounds.y + bounds.height * 0.4;

  yield* Effect.promise(() => page.mouse.move(startX, startY));
  yield* Effect.promise(() => page.mouse.down());
  yield* Effect.promise(() =>
    page.mouse.move(endX, endY, {
      steps: 6,
    })
  );
  yield* Effect.promise(() => page.mouse.up());
});

const expectStableCoordinateSystem = Effect.fn(
  "NakafaE2E.expectStableCoordinateSystem"
)(function* (page: Page) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto(LINEAR_SYSTEM_ROUTE, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));

  const card = page.locator('[data-slot="card"]').filter({
    hasText: MANY_SOLUTIONS_TITLE,
  });
  const scene = card.locator('[data-slot="line-scene"]');
  const canvas = scene.locator("canvas");
  const playButton = scene.getByRole("button", { name: "Toggle Play" });

  yield* Effect.promise(() =>
    expect(async () => {
      await expect(card).toHaveCount(1);
      await expect(scene).toBeAttached();
      await scene.scrollIntoViewIfNeeded();
      expect(await canvas.isVisible()).toBe(true);
    }).toPass({ timeout: 30_000 })
  );
  yield* observeDrawingBufferSize(canvas);
  yield* waitForStableCanvas(canvas);

  const beforePlay = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.promise(() => playButton.click());
  yield* expectCanvasToMove(canvas, beforePlay);
  yield* Effect.promise(() => playButton.click());
  yield* waitForStableCanvas(canvas);

  const beforeDrag = yield* Effect.promise(() => canvas.screenshot());
  yield* orbitScene(page, canvas);
  yield* expectCanvasToMove(canvas, beforeDrag);
  yield* Effect.promise(() =>
    expect(canvas).toHaveAttribute("data-drawing-buffer-changed", "false")
  );
});

test("coordinate-system interaction keeps its drawing buffer stable", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        serviceWorkers: "block",
        viewport: { height: 800, width: 1200 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            expectStableCoordinateSystem(page)
          );
        })
    )
  );
});
