import { expect, type Locator, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readFooterActions, setLargeText } from "@/e2e/support/footer";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { VISUAL_CARD_TOOLBAR } from "@/e2e/support/selector";
import { compactViewport } from "@/e2e/support/viewport";
import { openVisualLesson, revealLab, revealScene } from "@/e2e/support/visual";

/** A visual card's controls in its card body, directly under the scene. */
const BODY_CONTROLS = `[data-slot="card-content"] > ${VISUAL_CARD_TOOLBAR}`;

/**
 * Reads a visual card's footer as one band of the page. The band runs from the
 * lowest top to the highest bottom of the boxes of the footer's visible children
 * and of its buttons, so a button stacked under another leaves no common band.
 * An absolutely positioned child, such as a screen reader status, is not part
 * of the row. The right edge is that of the last visible child.
 */
function readFooterRow(footer: Locator) {
  return footer.evaluate((element) => {
    const children = Array.from(element.children).filter(
      (child) => getComputedStyle(child).position !== "absolute"
    );
    const buttons = Array.from(element.querySelectorAll("button"));
    const boxes = [...children, ...buttons].map((node) =>
      node.getBoundingClientRect()
    );
    const last = children.at(-1)?.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(element).paddingRight);
    return {
      bandBottom: Math.min(...boxes.map((box) => box.bottom)),
      bandTop: Math.max(...boxes.map((box) => box.top)),
      boxCount: boxes.length,
      contentRight: element.getBoundingClientRect().right - padding,
      lastRight: last?.right ?? 0,
    };
  });
}

/**
 * Proves a visual card's footer is one row. Every child and every button must
 * share one band of the page, so a button stacked under another fails even
 * when the actions are a single group. The last child, the actions, ends at the
 * footer's right padding.
 */
const expectFooterRow = Effect.fn("NakafaE2E.expectVisualFooterRow")(function* (
  card: Locator
) {
  const row = yield* Effect.promise(() =>
    readFooterRow(card.locator('[data-slot="card-footer"]'))
  );
  yield* Effect.sync(() => {
    expect(row.boxCount).toBeGreaterThan(0);
    expect(row.bandTop).toBeLessThan(row.bandBottom);
    expect(Math.abs(row.lastRight - row.contentRight)).toBeLessThan(1);
  });
});

/**
 * Opens the animated lab and proves its footer is one row, and that its
 * controls sit in the card body rather than after it.
 */
const expectLabFooterInRow = Effect.fn("NakafaE2E.expectLabFooterInRow")(
  function* (page: Page) {
    yield* openVisualLesson(
      page,
      pinnedRoutes.exponent.en,
      en.Common.fullscreen
    );
    const card = yield* revealLab(page);
    yield* expectFooterRow(card);
    yield* Effect.promise(() =>
      expect(card.locator(BODY_CONTROLS)).toHaveCount(1)
    );
  }
);

/** Opens a 3D scene and proves its footer is one row. */
const expectSceneFooterInRow = Effect.fn("NakafaE2E.expectSceneFooterInRow")(
  function* (page: Page) {
    yield* openVisualLesson(
      page,
      pinnedRoutes.material.en,
      en.Common.fullscreen
    );
    const { card } = yield* revealScene(page);
    yield* expectFooterRow(card);
  }
);

/**
 * Opens a 3D scene at 200 percent text and proves its three footer actions stay
 * inside the card that holds them. The card clips what lies beyond its edge, so
 * an action outside the card is cut off without any error.
 */
const expectSceneActionsInsideCardAtLargeText = Effect.fn(
  "NakafaE2E.expectSceneActionsInsideCardAtLargeText"
)(function* (page: Page) {
  yield* openVisualLesson(page, pinnedRoutes.material.en, en.Common.fullscreen);
  const { card } = yield* revealScene(page);
  const rootSize = yield* setLargeText(page);
  const actions = yield* Effect.promise(() =>
    readFooterActions(card.locator('[data-slot="card-footer"] button'))
  );
  yield* Effect.sync(() => {
    expect(rootSize).toBe("32px");
    expect(actions).toHaveLength(3);
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
  test.describe(`visual footers at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("keep an animated lab's footer in one row", async ({ page }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, expectLabFooterInRow(page))
      );
    });

    test("keep a 3D scene's footer in one row", async ({ page }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, expectSceneFooterInRow(page))
      );
    });
  });
}

test.describe("visual footer actions on the smallest phone", () => {
  test.use({
    viewport: { height: compactViewport.height, width: compactViewport.width },
  });

  test("keep a 3D scene's three actions inside its card at 200% text", async ({
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
