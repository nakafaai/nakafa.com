import { expect, type Locator, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { VISUAL_CARD_CONTROLS } from "@/e2e/support/selector";
import { openVisualLesson, revealLab, revealScene } from "@/e2e/support/visual";

/** A visual card's controls in its card body, directly under the scene. */
const BODY_CONTROLS = `[data-slot="card-content"] > ${VISUAL_CARD_CONTROLS}`;

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
