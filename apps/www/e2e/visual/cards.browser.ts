import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { expect, type Locator, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Effect } from "effect";
import {
  countCanvasFrames,
  expectCanvasToMove,
  expectFramesToAdvance,
  expectFramesToHold,
  orbitCanvas,
  patchWebGL,
  readCanvasSize,
  waitForStableCanvas,
} from "@/e2e/support/canvas";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  BACTERIA_SCENE,
  expectLabStill,
  expectNoPageShift,
  expectReturned,
  hideFullscreenApi,
  hidePopoverApi,
  LINE_SCENE,
  openVisualLesson,
  readPlacement,
  readPresentation,
  readSceneHeight,
  readSettledPageShift,
  revealAction,
  revealCard,
  revealLab,
  revealScene,
} from "@/e2e/support/visual";

const SCENE_PROBE = "held";
/** Room around two scenes shown at once, so neither sits at a viewport edge. */
const SCENE_PAIR_MARGIN = 160;

/**
 * Counts the scene's labels whose centers sit inside its canvas, so a test can
 * prove a larger frame shows at least everything the page showed.
 */
function countLabelsInView(card: Locator) {
  return card.evaluate((element, scene) => {
    const canvas = element.querySelector(`${scene} canvas`);
    if (!canvas) {
      return 0;
    }
    const frame = canvas.getBoundingClientRect();
    return Array.from(element.querySelectorAll(`${scene} .katex`)).filter(
      (label) => {
        const box = label.getBoundingClientRect();
        const x = box.left + box.width / 2;
        const y = box.top + box.height / 2;
        return (
          box.width > 0 &&
          x >= frame.left &&
          x <= frame.right &&
          y >= frame.top &&
          y <= frame.bottom
        );
      }
    ).length;
  }, LINE_SCENE);
}

/** Proves playback still works: a reset replays the growth from its start. */
const expectPlayback = Effect.fn("NakafaE2E.expectVisualPlayback")(function* (
  card: Locator
) {
  const scene = card.locator(BACTERIA_SCENE);
  yield* Effect.promise(async () => {
    await card
      .getByRole("button", { exact: true, name: en.Common.reset })
      .click();
    const start = await scene.getAttribute("data-bacteria-count");
    await expect
      .poll(async () => Number(await scene.getAttribute("data-bacteria-count")))
      .toBeGreaterThan(Number(start));
  });
});

/** Opens the animated lab, shows it across the screen, and returns it with Escape. */
const presentLab = Effect.fn("NakafaE2E.presentVisualLab")(function* (
  page: Page,
  presentation: "fullscreen" | "immersive"
) {
  yield* openVisualLesson(page, pinnedRoutes.exponent.en, en.Common.fullscreen);
  const card = yield* revealLab(page);
  yield* Effect.promise(() =>
    card.locator(BACTERIA_SCENE).evaluate((element, probe) => {
      element.setAttribute("data-visual-probe", probe);
    }, SCENE_PROBE)
  );
  const action = yield* revealAction(card, en.Common.fullscreen);
  const placement = yield* Effect.promise(() => readPlacement(card));
  const inlineScene = yield* Effect.promise(() => readSceneHeight(card));
  const layoutShift = yield* readSettledPageShift(page);

  yield* Effect.promise(() => action.click());

  yield* Effect.promise(async () => {
    await expect(action).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByRole("status")).toHaveText(
      en.Common["fullscreen-shown"]
    );
    await expect
      .poll(() => readPresentation(card))
      .toEqual({
        covers: true,
        fills: true,
        focusInside: true,
        fullscreen: presentation === "fullscreen",
        pageInert: true,
        position: "fixed",
        scrollLocked: true,
        topmost: true,
      });
    // The scene takes the height the screen frees for it.
    expect(await readSceneHeight(card)).toBeGreaterThan(inlineScene);
    // The page behind keeps its layout and the card's slot while the card
    // fills the screen, also where the root's scrollbar gutters closed.
    expect(await readPlacement(card)).toEqual(placement);
    // A press on the scene focuses the page around the card, which keeps it.
    await card.locator(BACTERIA_SCENE).click();
    await expect(action).toHaveAttribute("aria-pressed", "true");
  });
  yield* expectPlayback(card);

  yield* Effect.promise(() => page.keyboard.press("Escape"));

  yield* expectReturned(card, action, placement);
  yield* Effect.promise(async () => {
    await expect(card.getByRole("status")).toHaveText("");
    expect(await readSceneHeight(card)).toBe(inlineScene);
    // The scene never remounted: the same element still draws it.
    await expect(
      card.locator(`[data-visual-probe="${SCENE_PROBE}"]`)
    ).toHaveCount(1);
  });
  yield* expectNoPageShift(page, layoutShift);
  yield* expectPlayback(card);
});

/**
 * Lets the animated lab grow through every generation without a press. Nothing
 * is pressed while it advances on its own, so any shift it records is one no
 * input explains.
 */
const growLab = Effect.fn("NakafaE2E.growVisualLab")(function* (page: Page) {
  yield* openVisualLesson(page, pinnedRoutes.exponent.en, en.Common.fullscreen);
  const card = yield* revealLab(page);
  yield* expectLabStill(page, card, en.Common.play);
});

/** Shows a lesson chart across the screen and returns it with its action. */
const presentChart = Effect.fn("NakafaE2E.presentVisualChart")(function* (
  page: Page
) {
  yield* openVisualLesson(page, pinnedRoutes.growth.en, en.Common.fullscreen);
  const card = yield* revealCard(page, '[data-slot="chart"]');
  const surface = card.locator("svg.recharts-surface").first();
  yield* Effect.promise(() => expect(surface).toBeVisible());
  const action = yield* revealAction(card, en.Common.fullscreen);
  const inline = yield* Effect.promise(() => surface.boundingBox());
  const placement = yield* Effect.promise(() => readPlacement(card));
  const layoutShift = yield* readSettledPageShift(page);

  yield* Effect.promise(() => action.click());

  yield* Effect.promise(async () => {
    await expect(action).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => readPresentation(card))
      .toMatchObject({ covers: true, fills: true, topmost: true });
    // The chart redraws at the height the screen gives it.
    await expect
      .poll(async () => (await surface.boundingBox())?.height ?? 0)
      .toBeGreaterThan(inline?.height ?? 0);
    expect(await readPlacement(card)).toEqual(placement);
  });

  yield* Effect.promise(() => action.click());

  yield* expectReturned(card, action, placement);
  yield* Effect.promise(async () => {
    await expect
      .poll(async () => (await surface.boundingBox())?.height)
      .toBe(inline?.height);
  });
  yield* expectNoPageShift(page, layoutShift);
});

/**
 * Shows a 3D lesson scene across the screen, rotates it, and uses its grid
 * and rotation controls there. The canvas follows the larger frame, both on
 * screen and in its drawing buffer, and returns to its size with the card.
 */
const presentScene = Effect.fn("NakafaE2E.presentVisualScene")(function* (
  page: Page
) {
  yield* openVisualLesson(page, pinnedRoutes.material.en, en.Common.fullscreen);
  const { canvas, card } = yield* revealScene(page);
  const controls = card.locator("[data-coordinate-controls]");
  const grid = controls.getByRole("button", {
    exact: true,
    name: en.Common.grid,
  });
  const rotation = controls.getByRole("button", {
    exact: true,
    name: en.Common["automatic-rotation"],
  });
  const action = yield* revealAction(card, en.Common.fullscreen);
  const inline = yield* Effect.promise(() => readCanvasSize(canvas));
  const labels = yield* Effect.promise(() => countLabelsInView(card));
  const placement = yield* Effect.promise(() => readPlacement(card));
  const layoutShift = yield* readSettledPageShift(page);

  yield* Effect.promise(() => action.click());

  yield* Effect.promise(async () => {
    await expect(action).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() => readPresentation(card))
      .toMatchObject({ covers: true, fills: true, topmost: true });
    await expect
      .poll(async () => {
        const size = await readCanvasSize(canvas);
        return (
          size !== undefined &&
          inline !== undefined &&
          size.height > inline.height &&
          size.bufferHeight > inline.bufferHeight &&
          size.bufferWidth >= inline.bufferWidth
        );
      })
      .toBe(true);
    expect(await readPlacement(card)).toEqual(placement);
    // A portrait phone keeps the scene's sides: every label stays in view.
    expect(labels).toBeGreaterThan(0);
    await expect
      .poll(() => countLabelsInView(card))
      .toBeGreaterThanOrEqual(labels);
  });
  yield* waitForStableCanvas(canvas);

  const beforeGrid = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.promise(async () => {
    await grid.click();
    await expect(grid).toHaveAttribute("aria-pressed", "false");
  });
  yield* expectCanvasToMove(canvas, beforeGrid);
  yield* Effect.promise(async () => {
    await grid.click();
    await expect(grid).toHaveAttribute("aria-pressed", "true");
  });
  yield* waitForStableCanvas(canvas);

  const beforeRotation = yield* Effect.promise(() => canvas.screenshot());
  yield* Effect.promise(async () => {
    await rotation.click();
    await expect(rotation).toHaveAttribute("aria-pressed", "true");
  });
  yield* expectCanvasToMove(canvas, beforeRotation);
  yield* Effect.promise(async () => {
    await rotation.click();
    await expect(rotation).toHaveAttribute("aria-pressed", "false");
  });
  yield* waitForStableCanvas(canvas);

  // A drag rotates the scene last: its damping can outlast a stability
  // window on a large software-rendered canvas, and nothing after it waits.
  const beforeOrbit = yield* Effect.promise(() => canvas.screenshot());
  yield* orbitCanvas(page, canvas);
  yield* expectCanvasToMove(canvas, beforeOrbit);
  // The card is still across the screen after every control.
  yield* Effect.promise(() =>
    expect(action).toHaveAttribute("aria-pressed", "true")
  );

  yield* Effect.promise(() => action.click());

  yield* expectReturned(card, action, placement);
  yield* Effect.promise(async () => {
    await expect.poll(() => readCanvasSize(canvas)).toEqual(inline);
  });
  yield* expectNoPageShift(page, layoutShift);
});

/**
 * Proves the scenes behind a card shown across the screen stop drawing: a
 * second rotating scene in full view pauses while the first card fills the
 * screen and resumes when it returns.
 */
const pauseScenesBehind = Effect.fn("NakafaE2E.pauseVisualScenesBehind")(
  function* (page: Page, presentation: "fullscreen" | "immersive") {
    yield* Effect.promise(() =>
      page.addInitScript(patchWebGL, countCanvasFrames)
    );
    yield* openVisualLesson(
      page,
      pinnedRoutes.material.en,
      en.Common.fullscreen
    );
    const first = yield* revealScene(page, 0);
    const second = yield* revealScene(page, 1);
    // Show both cards at once, so only the presented card can pause the
    // second scene, never the distance from the viewport.
    const top = yield* Effect.promise(() =>
      first.card.evaluate((element) => element.getBoundingClientRect().top)
    );
    const bottom = yield* Effect.promise(() =>
      second.card.evaluate((element) => element.getBoundingClientRect().bottom)
    );
    const span = bottom - top;
    const viewport = page.viewportSize();
    yield* Effect.promise(async () => {
      await page.setViewportSize({
        height: Math.ceil(span) + SCENE_PAIR_MARGIN * 2,
        width: viewport?.width ?? 0,
      });
      await first.card.evaluate((element, margin) => {
        window.scrollBy({
          behavior: "instant",
          top: element.getBoundingClientRect().top - margin,
        });
      }, SCENE_PAIR_MARGIN);
      await expect(second.card).toBeInViewport({ ratio: 1 });
    });
    const rotation = second.card
      .locator("[data-coordinate-controls]")
      .getByRole("button", {
        exact: true,
        name: en.Common["automatic-rotation"],
      });
    yield* Effect.promise(async () => {
      await rotation.click();
      await expect(rotation).toHaveAttribute("aria-pressed", "true");
    });
    yield* expectFramesToAdvance(second.canvas);

    const action = first.card.getByRole("button", {
      exact: true,
      name: en.Common.fullscreen,
    });
    yield* Effect.promise(async () => {
      await action.click();
      await expect
        .poll(() => readPresentation(first.card))
        .toMatchObject({
          covers: true,
          fullscreen: presentation === "fullscreen",
          pageInert: true,
        });
    });
    yield* expectFramesToHold(second.canvas);

    yield* Effect.promise(async () => {
      await page.keyboard.press("Escape");
      await expect(action).toHaveAttribute("aria-pressed", "false");
    });
    yield* expectFramesToAdvance(second.canvas);
  }
);

/** Enters and leaves full screen through the action named in `locale`. */
const toggleInLocale = Effect.fn("NakafaE2E.toggleVisualInLocale")(function* (
  page: Page,
  locale: AppLocaleCode
) {
  const messages = yield* Effect.promise(() => loadLocaleMessages(locale));
  yield* openVisualLesson(
    page,
    pinnedRoutes.exponent[locale],
    messages.Common.fullscreen
  );
  const card = yield* revealLab(page);
  const action = yield* revealAction(card, messages.Common.fullscreen);

  yield* Effect.promise(async () => {
    await action.click();
    await expect(action).toHaveAttribute("aria-pressed", "true");
    await expect(card.getByRole("status")).toHaveText(
      messages.Common["fullscreen-shown"]
    );
    await expect
      .poll(() => readPresentation(card))
      .toMatchObject({ covers: true, fills: true, topmost: true });
    await expect(
      card.getByRole("button", { exact: true, name: messages.Common.reset })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(action).toHaveAttribute("aria-pressed", "false");
    await expect(action).toBeFocused();
  });
});

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test.describe(`visual cards at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("show an animated lab full screen and keep it playing", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, presentLab(page, "fullscreen"))
      );
    });

    test("cover the viewport with an animated lab without the Fullscreen API", async ({
      page,
    }) => {
      await page.addInitScript(hideFullscreenApi);
      await Effect.runPromise(
        withObservedPageErrors(page, presentLab(page, "immersive"))
      );
    });

    test("cover the viewport above the page's bars without popovers", async ({
      page,
    }) => {
      await page.addInitScript(hideFullscreenApi);
      await page.addInitScript(hidePopoverApi);
      await Effect.runPromise(
        withObservedPageErrors(page, presentLab(page, "immersive"))
      );
    });

    test("let an animated lab grow without shifting the page", async ({
      page,
    }) => {
      await Effect.runPromise(withObservedPageErrors(page, growLab(page)));
    });

    test("show a chart full screen and return it to its slot", async ({
      page,
    }) => {
      await Effect.runPromise(withObservedPageErrors(page, presentChart(page)));
    });

    test("show a 3D scene full screen and use every control there", async ({
      page,
    }) => {
      await Effect.runPromise(withObservedPageErrors(page, presentScene(page)));
    });
  });
}

test.describe("scenes behind a visual card", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("pause while the card is full screen", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, pauseScenesBehind(page, "fullscreen"))
    );
  });

  test("pause while the card covers the viewport", async ({ page }) => {
    await page.addInitScript(hideFullscreenApi);
    await Effect.runPromise(
      withObservedPageErrors(page, pauseScenesBehind(page, "immersive"))
    );
  });
});

test("visual cards name their full screen action in every locale", async ({
  page,
}) => {
  const { APP_LOCALE_CODES } = await import("@nakafa/aksara-contracts/locale");
  for (const locale of APP_LOCALE_CODES) {
    await test.step(locale, () =>
      Effect.runPromise(
        withObservedPageErrors(page, toggleInLocale(page, locale))
      )
    );
  }
});
