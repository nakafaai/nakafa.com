import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { expect, type Locator, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { loadLocaleMessages } from "@repo/internationalization/src/messages";
import { Duration, Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import {
  countCanvasFrames,
  expectCanvasToMove,
  expectFramesToAdvance,
  expectFramesToHold,
  waitForStableCanvas,
} from "@/e2e/support/canvas";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";

const SCENE_PROBE = "held";
const REVEAL_TIMEOUT_MILLISECONDS = 30_000;
/** The animated lab's scene, which names how many bacteria it draws. */
const BACTERIA_SCENE = "[data-bacteria-count]";
/** A deferred 3D line scene of a lesson card. */
const LINE_SCENE = '[data-slot="line-scene"]';
/** Room around two scenes shown at once, so neither sits at a viewport edge. */
const SCENE_PAIR_MARGIN = 160;
/** One rotation drag, in pixels. */
const ORBIT_DRAG = { x: 96, y: -32 };
/** Readings of the session's layout shift that must agree before a step. */
const SETTLED_READINGS = 2;
const SETTLE_ATTEMPTS = 10;

/** Hides the Fullscreen API the way iPhone Safari does for everything but video. */
function hideFullscreenApi() {
  Object.defineProperty(Document.prototype, "fullscreenEnabled", {
    configurable: true,
    get: () => false,
  });
}

/** Removes popovers the way Safari before version 17 lacks them. */
function hidePopoverApi() {
  Reflect.deleteProperty(HTMLElement.prototype, "showPopover");
}

/** Opens a lesson and proves every visual card on it carries the full screen action. */
const openLesson = Effect.fn("NakafaE2E.openVisualLesson")(function* (
  page: Page,
  href: string,
  fullscreen: string
) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto(href, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* Effect.promise(() => page.waitForLoadState("networkidle"));
  const cards = page.locator('[data-slot="visual-card"]');
  const count = yield* Effect.promise(() => cards.count());
  yield* Effect.promise(async () => {
    expect(count).toBeGreaterThan(0);
    // Cards far from the viewport skip rendering but keep their controls.
    await expect(
      cards.getByRole("button", {
        exact: true,
        includeHidden: true,
        name: fullscreen,
      })
    ).toHaveCount(count);
  });
});

/** Scrolls to the visual card that holds `content`, the first by default. */
const revealCard = Effect.fn("NakafaE2E.revealVisualCard")(function* (
  page: Page,
  content: string,
  index = 0
) {
  const card = page
    .locator('[data-slot="visual-card"] > [data-slot="card"]')
    .filter({ has: page.locator(content) })
    .nth(index);
  // A content-visibility card lays out its content only near the viewport.
  yield* Effect.promise(() =>
    expect(async () => {
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator(content).first()).toBeVisible();
    }).toPass({ timeout: REVEAL_TIMEOUT_MILLISECONDS })
  );
  return card;
});

/** Reveals a card's deferred 3D scene and waits for its canvas to settle. */
const revealScene = Effect.fn("NakafaE2E.revealVisualScene")(function* (
  page: Page,
  index = 0
) {
  const card = yield* revealCard(page, LINE_SCENE, index);
  const canvas = card.locator(`${LINE_SCENE} canvas`);
  yield* Effect.promise(() =>
    expect(async () => {
      await card.locator(LINE_SCENE).scrollIntoViewIfNeeded();
      expect(await canvas.isVisible()).toBe(true);
    }).toPass({ timeout: REVEAL_TIMEOUT_MILLISECONDS })
  );
  yield* waitForStableCanvas(canvas);
  return { canvas, card };
});

/**
 * Centers the card's action in the viewport, clear of the sticky bar at the
 * bottom of a phone screen, so clicking it scrolls nothing, and returns it.
 */
const revealAction = Effect.fn("NakafaE2E.revealVisualAction")(function* (
  card: Locator,
  fullscreen: string
) {
  const action = card.getByRole("button", { exact: true, name: fullscreen });
  yield* Effect.promise(() =>
    action.evaluate((element) =>
      element.scrollIntoView({ behavior: "instant", block: "center" })
    )
  );
  return action;
});

/** Reads where the card's slot and the lesson around it sit in the page. */
function readPlacement(card: Locator) {
  return card.evaluate((element) => ({
    article: element.closest("article")?.getBoundingClientRect().height,
    scrollY: window.scrollY,
    slot: element
      .closest('[data-slot="visual-card"]')
      ?.getBoundingClientRect()
      .toJSON(),
  }));
}

/**
 * Reads how the card is presented. A card that fills the screen covers the
 * viewport, it is the topmost element at every corner and at its footer, and
 * its footer sits at the bottom because the scene took the free height, so
 * the card never scrolls. The page behind is inert when every link
 * and button outside the card sits in an inert subtree.
 */
function readPresentation(card: Locator) {
  return card.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const footer = element.querySelector('[data-slot="card-footer"]');
    const paddingBottom = Number.parseFloat(
      getComputedStyle(element).paddingBottom
    );
    const footerGap =
      bounds.bottom -
      paddingBottom -
      (footer?.getBoundingClientRect().bottom ?? 0);
    const outside = Array.from(
      document.querySelectorAll("a[href], button")
    ).filter((control) => !element.contains(control));
    const footerBounds = footer?.getBoundingClientRect();
    // The corners, and the footer where a phone's sticky bar would sit.
    const probes = [
      [2, 2],
      [window.innerWidth - 3, 2],
      [2, window.innerHeight - 3],
      [window.innerWidth - 3, window.innerHeight - 3],
      ...(footerBounds
        ? [
            [
              footerBounds.left + footerBounds.width / 2,
              footerBounds.top + footerBounds.height / 2,
            ],
          ]
        : []),
    ];
    return {
      covers:
        bounds.left === 0 &&
        bounds.top === 0 &&
        bounds.width === window.innerWidth &&
        bounds.height === window.innerHeight,
      fills:
        Math.abs(footerGap) <= 1 &&
        element.scrollHeight <= element.clientHeight,
      focusInside: element.contains(document.activeElement),
      fullscreen: document.fullscreenElement === element,
      pageInert:
        outside.length > 0 &&
        outside.every((control) => control.closest("[inert]") !== null),
      position: getComputedStyle(element).position,
      scrollLocked: document.documentElement.style.overflow === "hidden",
      topmost:
        footerBounds !== undefined &&
        probes.every(([x, y]) =>
          element.contains(document.elementFromPoint(x, y))
        ),
    };
  });
}

/** Reads the height of the card's scene frame. */
function readSceneHeight(card: Locator) {
  return card
    .locator('[data-slot="visual-card-scene"]')
    .first()
    .evaluate((element) => element.getBoundingClientRect().height);
}

/** Reads a canvas's size on screen and the size of its drawing buffer. */
function readCanvasSize(canvas: Locator) {
  return canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return element instanceof HTMLCanvasElement
      ? {
          bufferHeight: element.height,
          bufferWidth: element.width,
          height: bounds.height,
          width: bounds.width,
        }
      : undefined;
  });
}

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

/**
 * Drags across the middle of the scene the way a learner rotates it. The drag
 * has one length at every size, so damping settles it as fast in full screen
 * as in the page.
 */
const orbitScene = Effect.fn("NakafaE2E.orbitVisualScene")(function* (
  page: Page,
  canvas: Locator
) {
  const bounds = yield* Effect.promise(() => canvas.boundingBox());
  yield* Effect.sync(() => expect(bounds).not.toBeNull());
  if (!bounds) {
    return;
  }
  const x = bounds.x + bounds.width / 2;
  const y = bounds.y + bounds.height / 2;
  yield* Effect.promise(async () => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + ORBIT_DRAG.x, y + ORBIT_DRAG.y, { steps: 6 });
    await page.mouse.up();
  });
});

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

/** Expects the card back in its slot, with focus on its action. */
const expectReturned = Effect.fn("NakafaE2E.expectVisualReturned")(function* (
  card: Locator,
  action: Locator,
  placement: Awaited<ReturnType<typeof readPlacement>>
) {
  yield* Effect.promise(async () => {
    await expect(action).toHaveAttribute("aria-pressed", "false");
    await expect(action).toBeFocused();
    await expect
      .poll(() => readPresentation(card))
      .toMatchObject({
        fullscreen: false,
        pageInert: false,
        position: "static",
        scrollLocked: false,
      });
    expect(await readPlacement(card)).toEqual(placement);
  });
});

/**
 * Reads the page's cumulative layout shift once it stops changing. Content
 * below the fold can still settle after load, so a session compares settled
 * readings taken around it.
 */
const readSettledLayoutShift = Effect.fn(
  "NakafaE2E.readSettledVisualLayoutShift"
)(function* (page: Page) {
  const readings = [yield* readCumulativeLayoutShift(page)];
  for (
    let attempt = 0;
    attempt < SETTLE_ATTEMPTS &&
    (readings.length < SETTLED_READINGS ||
      readings.at(-1) !== readings.at(-SETTLED_READINGS));
    attempt += 1
  ) {
    yield* Effect.sleep(Duration.millis(500));
    readings.push(yield* readCumulativeLayoutShift(page));
  }
  return readings.at(-1) ?? 0;
});

/**
 * Expects the session since `before` to add no layout shift the learner did
 * not cause: the card's slot holds the page while the card is away.
 */
const expectNoLayoutShift = Effect.fn("NakafaE2E.expectNoVisualLayoutShift")(
  function* (page: Page, before: number) {
    const after = yield* readSettledLayoutShift(page);
    yield* Effect.sync(() => expect(after).toBe(before));
  }
);

/** Opens the animated lab, shows it across the screen, and returns it with Escape. */
const presentLab = Effect.fn("NakafaE2E.presentVisualLab")(function* (
  page: Page,
  presentation: "fullscreen" | "immersive"
) {
  yield* openLesson(page, pinnedRoutes.exponent.en, en.Common.fullscreen);
  const card = yield* revealCard(page, BACTERIA_SCENE);
  yield* Effect.promise(() =>
    card.locator(BACTERIA_SCENE).evaluate((element, probe) => {
      element.setAttribute("data-visual-probe", probe);
    }, SCENE_PROBE)
  );
  const action = yield* revealAction(card, en.Common.fullscreen);
  const placement = yield* Effect.promise(() => readPlacement(card));
  const inlineScene = yield* Effect.promise(() => readSceneHeight(card));
  const layoutShift = yield* readSettledLayoutShift(page);

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
    // The page behind keeps the card's slot while the card fills the screen.
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
  yield* expectNoLayoutShift(page, layoutShift);
  yield* expectPlayback(card);
});

/** Shows a lesson chart across the screen and returns it with its action. */
const presentChart = Effect.fn("NakafaE2E.presentVisualChart")(function* (
  page: Page
) {
  yield* openLesson(page, pinnedRoutes.growth.en, en.Common.fullscreen);
  const card = yield* revealCard(page, '[data-slot="chart"]');
  const surface = card.locator("svg.recharts-surface").first();
  yield* Effect.promise(() => expect(surface).toBeVisible());
  const action = yield* revealAction(card, en.Common.fullscreen);
  const inline = yield* Effect.promise(() => surface.boundingBox());
  const placement = yield* Effect.promise(() => readPlacement(card));
  const layoutShift = yield* readSettledLayoutShift(page);

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
  yield* expectNoLayoutShift(page, layoutShift);
});

/**
 * Shows a 3D lesson scene across the screen, rotates it, and uses its grid
 * and rotation controls there. The canvas follows the larger frame, both on
 * screen and in its drawing buffer, and returns to its size with the card.
 */
const presentScene = Effect.fn("NakafaE2E.presentVisualScene")(function* (
  page: Page
) {
  yield* openLesson(page, pinnedRoutes.material.en, en.Common.fullscreen);
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
  const layoutShift = yield* readSettledLayoutShift(page);

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

  const beforeOrbit = yield* Effect.promise(() => canvas.screenshot());
  yield* orbitScene(page, canvas);
  yield* expectCanvasToMove(canvas, beforeOrbit);
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
    // The card is still across the screen after every control.
    await expect(action).toHaveAttribute("aria-pressed", "true");
  });

  yield* Effect.promise(() => action.click());

  yield* expectReturned(card, action, placement);
  yield* Effect.promise(async () => {
    await expect.poll(() => readCanvasSize(canvas)).toEqual(inline);
  });
  yield* expectNoLayoutShift(page, layoutShift);
});

/**
 * Proves the scenes behind a card shown across the screen stop drawing: a
 * second rotating scene in full view pauses while the first card fills the
 * screen and resumes when it returns.
 */
const pauseScenesBehind = Effect.fn("NakafaE2E.pauseVisualScenesBehind")(
  function* (page: Page, presentation: "fullscreen" | "immersive") {
    yield* Effect.promise(() => page.addInitScript(countCanvasFrames));
    yield* openLesson(page, pinnedRoutes.material.en, en.Common.fullscreen);
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
  yield* openLesson(
    page,
    pinnedRoutes.exponent[locale],
    messages.Common.fullscreen
  );
  const card = yield* revealCard(page, BACTERIA_SCENE);
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
