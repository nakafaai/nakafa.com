import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
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
  "visual-card-table",
  "visual-card-footer",
  "visual-card-note",
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

/** What a reader operates: a button, a field, a choice, a slider or a link. */
const INTERACTIVE =
  'a[href], button, input, select, textarea, [role="checkbox"], [role="combobox"], [role="menuitem"], [role="radio"], [role="slider"], [role="spinbutton"], [role="switch"], [role="tab"]';

/** What sets out text: a list, a paragraph, a term list, a caption, a table or a heading. */
const TEXT_BLOCKS =
  "blockquote, caption, dl, figcaption, h1, h2, h3, h4, h5, h6, li, ol, p, small, table, ul";

/**
 * What stands in a band without being drawn there: a control's popup, which
 * renders in place beside it (ADR 0049) and shows only over the page, and a
 * status that only assistive technology hears.
 */
const UNDRAWN =
  '[popover], [role="tooltip"], [data-slot$="-content"], [data-popup-place], .sr-only[role="status"]';

/**
 * Reads what the toolbar and actions bands of every visual card on the page
 * hold besides controls: an item that holds no control, a text block, or words
 * written straight into the band. Each finding names its band and its text.
 */
function readBandText(page: Page) {
  return page
    .locator(
      '[data-slot="visual-card-toolbar"], [data-slot="visual-card-actions"]'
    )
    .evaluateAll(
      (bands, selectors) =>
        bands.flatMap((band) => {
          const slot = band.getAttribute("data-slot");
          const loose = Array.from(band.children).filter(
            (child) =>
              !(
                child.matches(selectors.undrawn) ||
                child.matches(selectors.interactive) ||
                child.querySelector(selectors.interactive)
              )
          );
          const blocks = Array.from(band.querySelectorAll(selectors.blocks));
          const words = Array.from(band.childNodes).filter(
            (node) =>
              node.nodeType === Node.TEXT_NODE &&
              (node.textContent ?? "").trim() !== ""
          );
          return [...loose, ...blocks, ...words].map(
            (node) =>
              `${slot} ${node.nodeName}: ${(node.textContent ?? "").trim().slice(0, 60)}`
          );
        }),
      { blocks: TEXT_BLOCKS, interactive: INTERACTIVE, undrawn: UNDRAWN }
    );
}

/**
 * Proves the toolbar and the actions band of every visual card on the page
 * hold only what a reader operates. A legend, a key, a readout or a note
 * belongs in the footer, and a task in the header's description.
 */
const expectControlsOnlyInBands = Effect.fn(
  "NakafaE2E.expectControlsOnlyInBands"
)(function* (page: Page) {
  const found = yield* Effect.promise(() => readBandText(page));
  yield* Effect.sync(() => expect(found).toEqual([]));
});

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
 * Proves the full screen action and the menu of the other actions end a visual
 * card's actions band, the menu at the band's right padding.
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
  yield* Effect.promise(async () => {
    await expect(
      actions.getByRole("button", { name: en.Common.fullscreen })
    ).toBeVisible();
    await expect(actions.locator("button").last()).toHaveAccessibleName(
      en.Common["more-actions"]
    );
  });
  yield* Effect.sync(() =>
    expect(Math.abs(end.lastRight - end.right)).toBeLessThan(1)
  );
});

/**
 * Opens the animated lab and proves its bands are in order, its controls in
 * the toolbar above the visual, its full screen action at the end, and only
 * controls in every card's toolbar and actions on the page.
 */
const expectLabBands = Effect.fn("NakafaE2E.expectLabBands")(function* (
  page: Page
) {
  yield* openVisualLesson(page, pinnedRoutes.exponent.en, en.Common.fullscreen);
  const card = yield* revealLab(page);
  yield* expectBandsInOrder(card);
  yield* expectFullscreenEndsActions(card);
  yield* expectControlsOnlyInBands(page);
  yield* Effect.promise(() =>
    expect(card.locator(VISUAL_CARD_TOOLBAR)).toHaveCount(1)
  );
});

/** Opens a 3D scene and proves its bands are in order, with only controls in every card's toolbar and actions. */
const expectSceneBands = Effect.fn("NakafaE2E.expectSceneBands")(function* (
  page: Page
) {
  yield* openVisualLesson(page, pinnedRoutes.material.en, en.Common.fullscreen);
  const { card } = yield* revealScene(page);
  yield* expectBandsInOrder(card);
  yield* expectFullscreenEndsActions(card);
  yield* expectControlsOnlyInBands(page);
});

/**
 * Opens a coordinate scene at 200 percent text and proves its three buttons,
 * play, full screen, and the menu of its other actions, stay inside the card
 * that holds them. The card clips what lies beyond its edge, so an action
 * outside the card is cut off without any error.
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
      en.Common.play,
      en.Common.fullscreen,
      en.Common["more-actions"],
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
