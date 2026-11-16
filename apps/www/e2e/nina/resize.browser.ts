import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { waitForSlide } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { SHEET_POPUP } from "@/e2e/support/selector";
import { openSheet } from "@/e2e/support/sheet";

/** Where the pointer lets go of the edge, in pixels from the left of the window. */
const POINTER = 800;

test.use({
  reducedMotion: "reduce",
  viewport: { height: 700, width: 1280 },
});

/**
 * The learner drags the edge of Nina's sheet with the mouse, and its edge lands
 * where the pointer lets go. No native scrollbar takes room on a fine pointer
 * (`globals.css`), so the sheet's right edge is the window's. Every sheet and
 * the memory panel resize by the same edge and hook.
 */
const verifyDrag = Effect.fn("NakafaE2E.verifyNinaSheetDrag")(function* (
  page: Page
) {
  yield* openSheet(page);

  const sheet = page.locator(SHEET_POPUP);

  yield* waitForSlide(sheet);
  const separator = sheet.getByRole("separator", { name: "Change width" });
  const edge = yield* Effect.promise(() => separator.boundingBox());
  // The edge is the page pane's: its grip in the middle, and no colour of its own on hover.
  const resting = yield* Effect.promise(() =>
    separator.evaluate((line) => getComputedStyle(line).backgroundColor)
  );
  yield* Effect.promise(() => separator.hover());
  yield* Effect.promise(() =>
    expect(separator).toHaveCSS("background-color", resting)
  );

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

test.describe("Nina's sheet dragged by its edge", () => {
  test("lands its edge under the pointer", async ({ page }) => {
    await Effect.runPromise(withObservedPageErrors(page, verifyDrag(page)));
  });
});
