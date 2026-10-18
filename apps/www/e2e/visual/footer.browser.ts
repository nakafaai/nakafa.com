import { expect, type Locator, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readFooterActions, setLargeText } from "@/e2e/support/footer";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { VISUAL_CARD_TOOLBAR } from "@/e2e/support/selector";
import { compactViewport } from "@/e2e/support/viewport";
import { openVisualLesson, revealLab, revealScene } from "@/e2e/support/visual";

/** The bands a visual card may hold, in the only order it holds them. */
const BAND_ORDER = [
  "card-header",
  "visual-card-toolbar",
  "visual-card-body",
  "visual-card-actions",
  "visual-card-footer",
];

/**
 * Reads the slots of a visual card's bands in their order in the page, and
 * whether the body holds anything but the visual: a button, a field, a table
 * or a list of readouts.
 */
function readBands(card: Locator) {
  return card.evaluate((element) => ({
    bodyControls: element.querySelectorAll(
      '[data-slot="visual-card-body"] :is(button, input, select, textarea, table, dl)'
    ).length,
    slots: Array.from(element.children, (child) =>
      child.getAttribute("data-slot")
    ),
  }));
}

/**
 * Proves a visual card is composed of its bands in order, with the visual alone
 * in its body: controls above it, actions and readouts under it.
 */
const expectBandsInOrder = Effect.fn("NakafaE2E.expectVisualBandsInOrder")(
  function* (card: Locator) {
    const bands = yield* Effect.promise(() => readBands(card));
    yield* Effect.sync(() => {
      const known = Arr.filter(
        bands.slots,
        (slot): slot is string =>
          slot !== null && Arr.contains(BAND_ORDER, slot)
      );
      expect(known).toContain("visual-card-body");
      // The bands present, read in the order a card must hold them.
      expect(known).toEqual(
        Arr.filter(BAND_ORDER, (slot) => Arr.contains(known, slot))
      );
      expect(bands.bodyControls).toBe(0);
    });
  }
);

/**
 * Proves the full screen action ends a visual card's actions band, at the
 * band's right padding.
 */
const expectFullscreenEndsActions = Effect.fn(
  "NakafaE2E.expectFullscreenEndsActions"
)(function* (card: Locator) {
  const actions = card.locator('[data-slot="visual-card-actions"]');
  const end = yield* Effect.promise(() =>
    actions.evaluate((element) => {
      const last = Array.from(element.querySelectorAll("button"))
        .at(-1)
        ?.getBoundingClientRect();
      const padding = Number.parseFloat(getComputedStyle(element).paddingRight);
      return {
        lastRight: last?.right ?? 0,
        right: element.getBoundingClientRect().right - padding,
      };
    })
  );
  yield* Effect.promise(() =>
    expect(
      actions.getByRole("button", { name: en.Common.fullscreen }).last()
    ).toBeVisible()
  );
  yield* Effect.sync(() =>
    expect(Math.abs(end.lastRight - end.right)).toBeLessThan(1)
  );
});

/**
 * Opens the animated lab and proves its bands are in order, its controls in
 * the toolbar above the visual, and its full screen action at the end.
 */
const expectLabBands = Effect.fn("NakafaE2E.expectLabBands")(function* (
  page: Page
) {
  yield* openVisualLesson(page, pinnedRoutes.exponent.en, en.Common.fullscreen);
  const card = yield* revealLab(page);
  yield* expectBandsInOrder(card);
  yield* expectFullscreenEndsActions(card);
  yield* Effect.promise(() =>
    expect(card.locator(VISUAL_CARD_TOOLBAR)).toHaveCount(1)
  );
});

/** Opens a 3D scene and proves its bands are in order. */
const expectSceneBands = Effect.fn("NakafaE2E.expectSceneBands")(function* (
  page: Page
) {
  yield* openVisualLesson(page, pinnedRoutes.material.en, en.Common.fullscreen);
  const { card } = yield* revealScene(page);
  yield* expectBandsInOrder(card);
  yield* expectFullscreenEndsActions(card);
});

/**
 * Opens a coordinate scene at 200 percent text and proves its four actions, the
 * grid, play, reset, and full screen, stay inside the card that holds them. The
 * card clips what lies beyond its edge, so an action outside the card is cut off
 * without any error.
 */
const expectSceneActionsInsideCardAtLargeText = Effect.fn(
  "NakafaE2E.expectSceneActionsInsideCardAtLargeText"
)(function* (page: Page) {
  yield* openVisualLesson(page, pinnedRoutes.material.en, en.Common.fullscreen);
  const { card } = yield* revealScene(page);
  const rootSize = yield* setLargeText(page);
  const actions = yield* Effect.promise(() =>
    readFooterActions(card.locator('[data-slot="visual-card-actions"] button'))
  );
  yield* Effect.sync(() => {
    expect(rootSize).toBe("32px");
    expect(Arr.map(actions, (action) => action.label)).toEqual([
      en.Common.grid,
      en.Common.play,
      en.Common.reset,
      en.Common.fullscreen,
    ]);
    for (const action of actions) {
      expect(action.inside).toBe(true);
      expect(action.clipped).toBe(false);
    }
  });
});

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test.describe(`visual cards at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("compose an animated lab from its bands, its controls above the visual", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, expectLabBands(page))
      );
    });

    test("compose a 3D scene from its bands, full screen ending its actions", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, expectSceneBands(page))
      );
    });
  });
}

test.describe("visual card actions on the smallest phone", () => {
  test.use({
    viewport: { height: compactViewport.height, width: compactViewport.width },
  });

  test("keep a 3D scene's actions inside its card at 200% text", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        expectSceneActionsInsideCardAtLargeText(page)
      )
    );
  });
});
