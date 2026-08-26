import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";

const LINEAR_SYSTEM_ROUTE =
  "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear";
const MANY_SOLUTIONS_SCENE_INDEX = 2;

const waitForRenderedFrames = Effect.fn("NakafaE2E.waitForRenderedFrames")(
  function* (page: Page) {
    yield* Effect.promise(() =>
      page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          })
      )
    );
  }
);

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
  yield* waitForRenderedFrames(page);
});

const expectStableCoordinateSystem = Effect.fn(
  "NakafaE2E.expectStableCoordinateSystem"
)(function* (page: Page) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto(LINEAR_SYSTEM_ROUTE, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));

  const scene = page
    .locator('[data-slot="line-scene"]')
    .nth(MANY_SOLUTIONS_SCENE_INDEX);
  const canvas = scene.locator("canvas");
  const playButton = scene.getByRole("button", { name: "Toggle Play" });

  yield* Effect.promise(() => expect(scene).toBeAttached());
  yield* Effect.promise(() => scene.scrollIntoViewIfNeeded());
  yield* Effect.promise(() => expect(canvas).toBeVisible({ timeout: 30_000 }));
  yield* observeDrawingBufferSize(canvas);

  const beforeDrag = yield* Effect.promise(() => canvas.screenshot());
  yield* orbitScene(page, canvas);
  const afterDrag = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.sync(() => expect(afterDrag.equals(beforeDrag)).toBe(false));

  const beforePlay = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.promise(() => playButton.click());
  yield* waitForRenderedFrames(page);
  const duringPlay = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.promise(() => playButton.click());
  yield* Effect.sync(() => expect(duringPlay.equals(beforePlay)).toBe(false));
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
