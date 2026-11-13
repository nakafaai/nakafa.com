import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  dragMouse,
  expectCanvasToMove,
  observeDrawingBufferSize,
  waitForStableCanvas,
} from "@/e2e/support/canvas";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withBrowserContext } from "@/e2e/support/context";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  CARD,
  MATH_SCENE,
  SCENE_ACTIONS,
  VISUAL_CARD_FOOTER,
} from "@/e2e/support/selector";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";
import { isHydrated } from "@/e2e/support/window";

const LINEAR_SYSTEM_ROUTE =
  "/id/materi/matematika/sistem-persamaan-dan-pertidaksamaan-linear/sistem-persamaan-linear";
const MANY_SOLUTIONS_TITLE = "Sistem Persamaan Linear dengan Banyak Solusi";
/** A lesson the acceptance runtime serves whose right triangles and unit circle are MathVisual scenes with an angle slider. */
const SLIDER_ROUTE =
  "/en/subjects/mathematics/trigonometry/trigonometric-comparison-three-primary";
/** How many degrees the angle slider moves under the test's arrow presses. */
const ANGLE_STEPS = 15;

const orbitScene = Effect.fn("NakafaE2E.orbitScene")(function* (
  page: Page,
  canvas: Locator
) {
  const bounds = yield* Effect.promise(() => canvas.boundingBox());
  yield* Effect.sync(() => expect(bounds).not.toBeNull());
  if (!bounds) {
    return;
  }

  yield* dragMouse(
    page,
    {
      x: bounds.x + bounds.width * 0.4,
      y: bounds.y + bounds.height * 0.55,
    },
    {
      x: bounds.x + bounds.width * 0.7,
      y: bounds.y + bounds.height * 0.4,
    }
  );
});

const expectStableCoordinateSystem = Effect.fn(
  "NakafaE2E.expectStableCoordinateSystem"
)(function* (page: Page) {
  yield* seedAnalyticsConsent(page, "denied");
  const response = yield* Effect.promise(() =>
    page.goto(LINEAR_SYSTEM_ROUTE, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));

  const card = page.locator(CARD).filter({
    hasText: MANY_SOLUTIONS_TITLE,
  });
  const scene = card.locator(MATH_SCENE);
  const canvas = scene.locator("canvas");
  const footer = card.locator(SCENE_ACTIONS);
  // The grid is a checked item of the menu at the end of the actions band,
  // which opens above the page and closes once the item is chosen.
  const moreButton = footer.getByRole("button", { name: "Aksi lainnya" });
  const gridItem = page.getByRole("menuitemcheckbox", { name: "Kisi" });
  const playButton = footer.getByRole("button", { name: "Putar" });

  yield* Effect.promise(() =>
    expect(async () => {
      await expect(card).toHaveCount(1);
      await expect(scene).toBeAttached();
      await card.scrollIntoViewIfNeeded();
      await scene.scrollIntoViewIfNeeded();
      expect(await canvas.isVisible()).toBe(true);
    }).toPass({ timeout: revealTimeoutMilliseconds })
  );
  yield* Effect.promise(() =>
    expect(playButton).toHaveAttribute("aria-pressed", "false")
  );
  yield* Effect.promise(async () => {
    await moreButton.click();
    await expect(gridItem).toHaveAttribute("aria-checked", "true");
    await gridItem.click();
    await expect(gridItem).toHaveCount(0);
    await moreButton.click();
    await expect(gridItem).toHaveAttribute("aria-checked", "false");
    await gridItem.click();
    await expect(gridItem).toHaveCount(0);
    await moreButton.click();
    await expect(gridItem).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
    await expect(gridItem).toHaveCount(0);
  });
  yield* waitForStableCanvas(canvas);
  yield* observeDrawingBufferSize(canvas);

  const beforePlay = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.promise(() => playButton.click());
  yield* Effect.promise(() =>
    expect(playButton).toHaveAttribute("aria-pressed", "true")
  );
  yield* expectCanvasToMove(canvas, beforePlay);
  yield* Effect.promise(() => playButton.click());
  yield* Effect.promise(() =>
    expect(playButton).toHaveAttribute("aria-pressed", "false")
  );
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

/**
 * Moves a scene's angle slider with the keyboard and reads its value and
 * its cos, sin and tan readouts follow: the formulas redraw at every step.
 */
const expectSliderReadouts = Effect.fn("NakafaE2E.expectSliderReadouts")(
  function* (page: Page) {
    yield* seedAnalyticsConsent(page, "denied");
    yield* Effect.promise(() =>
      page.goto(SLIDER_ROUTE, { waitUntil: "domcontentloaded" })
    );
    const slider = page.getByRole("slider", { exact: true, name: "a" }).first();
    const card = page.locator(CARD).filter({ has: slider }).first();
    const facts = card.locator(VISUAL_CARD_FOOTER);
    yield* Effect.promise(() =>
      expect(async () => {
        await slider.scrollIntoViewIfNeeded();
        await expect(slider).toBeVisible();
        expect(await isHydrated(slider)).toBe(true);
      }).toPass({ timeout: revealTimeoutMilliseconds })
    );
    const start = Number(
      yield* Effect.promise(() => slider.getAttribute("aria-valuenow"))
    );
    const before = yield* Effect.promise(() => facts.textContent());
    yield* Effect.promise(() => slider.focus());
    yield* Effect.promise(() =>
      page.keyboard.press("ArrowRight", { delay: 10 })
    );
    for (let step = 1; step < ANGLE_STEPS; step += 1) {
      yield* Effect.promise(() => page.keyboard.press("ArrowRight"));
    }
    yield* Effect.promise(() =>
      expect(slider).toHaveAttribute(
        "aria-valuenow",
        String(start + ANGLE_STEPS)
      )
    );
    yield* Effect.promise(() => expect(facts).not.toHaveText(before ?? ""));
  }
);

test("an angle slider redraws its scene and its sin, cos and tan readouts", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(page, expectSliderReadouts(page))
  );
});
