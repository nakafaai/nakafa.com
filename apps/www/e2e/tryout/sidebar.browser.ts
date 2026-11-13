import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { expectUncovered } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  currentNumberOf,
  expectView,
  numberCells,
  runFirstSection,
  scrollPageTo,
  sidebarOf,
} from "@/e2e/support/player";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport } from "@/e2e/support/viewport";

/**
 * Shrinks the window until the sidebar's column shows the top half of the numbers' grid, so the column
 * must scroll to reach its last number however many numbers a row of the pane's width holds.
 */
const shortenToHalfTheGrid = Effect.fn("NakafaE2E.shortenToHalfTheGrid")(
  function* (page: Page) {
    const height = yield* Effect.promise(() =>
      sidebarOf(page)
        .locator("ol")
        .evaluate((grid) => {
          const box = grid.getBoundingClientRect();
          return Math.round(box.top + box.height / 2);
        })
    );
    yield* Effect.promise(() =>
      page.setViewportSize({ height, width: desktopViewport.width })
    );
  }
);

/**
 * Keeps the current number inside a sidebar that is shorter than its grid, so
 * a learner always sees where they are, however the current question changed.
 */
const verifyShortSidebar = Effect.fn("NakafaE2E.verifyShortSidebar")(function* (
  page: Page,
  baseURL: string
) {
  yield* runFirstSection(page, false, baseURL);
  // The questions stream in after the header, so wait for them to measure.
  yield* expectView(page, "List");
  // The window shrinks once the section runs, so the setup keeps its room.
  yield* shortenToHalfTheGrid(page);
  const current = currentNumberOf(page, false);
  yield* Effect.promise(() => expect(current).toHaveText("1"));

  // The last number starts below the fold of the column.
  const total = yield* Effect.promise(() => numberCells(page).count());
  const belowFold = yield* Effect.promise(() =>
    sidebarOf(page).evaluate((column) => {
      const last = column.querySelector("li:last-child");
      return (
        (last?.getBoundingClientRect().bottom ?? 0) >
        column.getBoundingClientRect().bottom
      );
    })
  );
  yield* Effect.sync(() => expect(belowFold).toBe(true));

  // The end of the list makes the last question current, and the column
  // scrolls to its number although nobody pressed it.
  yield* scrollPageTo(page, "end");
  yield* Effect.promise(() => expect(current).toHaveText(String(total)));
  yield* expectUncovered(current, readinessTimeoutMilliseconds);

  // Back at the start, the column follows the reader up again.
  yield* scrollPageTo(page, "start");
  yield* Effect.promise(() => expect(current).toHaveText("1"));
  yield* expectUncovered(current, readinessTimeoutMilliseconds);
});

test.describe("Try-out player in a short window", () => {
  test.use({
    hasTouch: desktopViewport.hasTouch,
    viewport: { height: desktopViewport.height, width: desktopViewport.width },
  });

  test("keeps the current number in view in a sidebar that scrolls", async ({
    baseURL,
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.fromNullishOr(baseURL).pipe(
          Effect.flatMap((origin) => verifyShortSidebar(page, origin))
        )
      )
    );
  });
});
