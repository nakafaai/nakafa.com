import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { waitForStill } from "@/e2e/support/quiet";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A phone, a small touch screen, where a pane and the search palette rise as sheets that a swipe down closes. */
const PHONE = { height: 844, width: 390 };

/** A track's list of sets, whose row opens its set in a pane, a sheet on a phone. */
const TRACK = "/en/try-out/indonesia/snbt/2027/utbk";

/**
 * Swipes down from a point with a finger, as the browser's own touch input does: the browser scrolls whatever the
 * finger lands in, and hands the swipe on to the scroller around it. A sheet that UI SDK moves by its host's scroll
 * closes only if the swipe reaches that host, so a swipe that scrolls the host directly (`swipeAway`) proves nothing
 * here. Only Chromium synthesizes a touch gesture.
 */
async function swipeDown(page: Page, x: number, y: number) {
  const session = await page.context().newCDPSession(page);
  await session.send("Input.synthesizeScrollGesture", {
    gestureSourceType: "touch",
    speed: 1200,
    x,
    y,
    yDistance: 500,
  });
  await session.detach();
}

/** Opens the first set's pane as a sheet and waits until it rests. */
async function openPane(page: Page) {
  await page.goto(TRACK);
  const row = page.getByRole("row").filter({ hasText: "Set 1" }).first();
  await waitUntilTakenOver(row);
  await row.getByRole("cell").nth(1).click();
  const sheet = page.locator('[data-slot="drawer-content"]');
  await expect(sheet).toHaveAttribute("data-driver", "scroll-snap");
  await waitForStill(sheet);
  return sheet;
}

/** The point a finger lands on, some way down from the sheet's top edge. */
async function pointIn(sheet: Locator, below: number) {
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  return { x: (box?.x ?? 0) + 120, y: (box?.y ?? 0) + below };
}

test.describe("a sheet on a phone", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: PHONE });

  /**
   * The owner's report (21 Nov 2026): a phone's sheet would not close by a drag. The pane's sheet clipped its corners
   * with `overflow: hidden`, which made it a scroll container that UI SDK's `overscroll-behavior: contain` kept every
   * swipe in, its handle refused to pan, and its body kept a swipe past its top to itself.
   */
  for (const [part, below] of [
    ["handle", 10],
    ["header", 60],
    ["body", 220],
  ] as const) {
    test(`closes by a swipe down on its ${part}`, async ({
      browserName,
      page,
    }) => {
      test.skip(browserName !== "chromium", "only Chromium synthesizes touch");
      const sheet = await openPane(page);
      const point = await pointIn(sheet, below);

      await swipeDown(page, point.x, point.y);

      await expect(sheet).toHaveCount(0);
    });
  }

  test("closes the search palette by a swipe down on its grip", async ({
    browserName,
    page,
  }) => {
    test.skip(browserName !== "chromium", "only Chromium synthesizes touch");
    await page.goto(TRACK);
    await page
      .getByRole("button", { name: "Toggle Sidebar" })
      .filter({ visible: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Search content..." }).click();
    const palette = page.locator('[data-surface="palette"]');
    await expect(palette).toHaveAttribute("data-driver", "scroll-snap");
    await waitForStill(palette);
    const point = await pointIn(palette, 8);

    await swipeDown(page, point.x, point.y);

    // The palette stays in the page while closed, hidden, so its results are ready before it opens.
    await expect(palette).toBeHidden();
  });
});
