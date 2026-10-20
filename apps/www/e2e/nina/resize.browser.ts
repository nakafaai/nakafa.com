import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "../support/consent";
import { waitForSlide } from "../support/layout";
import { withObservedPageErrors } from "../support/observe";
import { SHEET_POPUP } from "../support/selector";
import { openSheet } from "../support/sheet";

/** Where the pointer lets go of the edge, in pixels from the left of the window. */
const POINTER = 800;

// The page has a scrollbar that takes room, as the pages of Windows and Linux
// do, and a lesson is long enough that the page needs one.
test.use({
  launchOptions: {
    args: ["--disable-features=OverlayScrollbar"],
    ignoreDefaultArgs: ["--hide-scrollbars"],
  },
  reducedMotion: "reduce",
  viewport: { height: 700, width: 1280 },
});

/**
 * The learner drags the edge of Nina's sheet with the mouse. The sheet is fixed
 * to the right edge of the page, which is where the page ends and the
 * scrollbar begins, so its edge lands where the pointer is, and not the width
 * of the scrollbar away from it. The memory panel's resizer is the same hook.
 */
const verifyDrag = Effect.fn("NakafaE2E.verifyNinaSheetDrag")(function* (
  page: Page
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* openSheet(page);

  const sheet = page.locator(SHEET_POPUP);

  yield* waitForSlide(sheet);
  const scrollbar = yield* Effect.promise(() =>
    page.evaluate(
      () => window.innerWidth - document.documentElement.clientWidth
    )
  );
  const edge = yield* Effect.promise(() =>
    sheet.getByRole("button", { name: "Change width" }).boundingBox()
  );

  // A page with no scrollbar of its own would prove nothing.
  expect(scrollbar).toBeGreaterThan(0);
  expect(edge).not.toBeNull();
  yield* Effect.promise(async () => {
    const y = (edge?.y ?? 0) + 200;

    await page.mouse.move((edge?.x ?? 0) + (edge?.width ?? 0) / 2, y);
    await page.mouse.down();
    await page.mouse.move(POINTER, y, { steps: 10 });
    await page.mouse.up();
  });
  expect((yield* Effect.promise(() => sheet.boundingBox()))?.x).toBe(POINTER);
});

test.describe("Nina's sheet dragged beside a scrollbar that takes room", () => {
  test("lands its edge under the pointer", async ({ page }) => {
    await Effect.runPromise(withObservedPageErrors(page, verifyDrag(page)));
  });
});
