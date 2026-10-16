import { expect, type Locator, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openVisualLesson, revealLab, revealScene } from "@/e2e/support/visual";

/**
 * Reads a visual card's footer as a row: the top of every child, the first
 * child's vertical bounds, and the right edge of the last child against the
 * footer's right padding.
 */
function readFooterRow(footer: Locator) {
  return footer.evaluate((element) => {
    const first = element.firstElementChild?.getBoundingClientRect();
    const last = element.lastElementChild?.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(element).paddingRight);
    return {
      contentRight: element.getBoundingClientRect().right - padding,
      lastRight: last?.right ?? 0,
      rowBottom: first?.bottom ?? 0,
      rowTop: first?.top ?? 0,
      tops: Array.from(
        element.children,
        (child) => child.getBoundingClientRect().top
      ),
    };
  });
}

/**
 * Proves a visual card's footer is one row: every child starts within the row
 * of the first child, and the last child, the actions, ends at the footer's
 * right padding.
 */
const expectFooterRow = Effect.fn("NakafaE2E.expectVisualFooterRow")(function* (
  card: Locator
) {
  const row = yield* Effect.promise(() =>
    readFooterRow(card.locator('[data-slot="card-footer"]'))
  );
  yield* Effect.sync(() => {
    expect(row.tops.length).toBeGreaterThan(0);
    for (const top of row.tops) {
      expect(top).toBeGreaterThanOrEqual(row.rowTop);
      expect(top).toBeLessThan(row.rowBottom);
    }
    expect(Math.abs(row.lastRight - row.contentRight)).toBeLessThan(1);
  });
});

/** Opens the animated lab and proves its footer is one row. */
const expectLabFooterInRow = Effect.fn("NakafaE2E.expectLabFooterInRow")(
  function* (page: Page) {
    yield* openVisualLesson(
      page,
      pinnedRoutes.exponent.en,
      en.Common.fullscreen
    );
    const card = yield* revealLab(page);
    yield* expectFooterRow(card);
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
