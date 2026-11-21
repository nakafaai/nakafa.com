import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { swipeAway } from "@/e2e/support/input";
import { waitForStill } from "@/e2e/support/quiet";
import { createSchool, hostAddress, signInOwner } from "@/e2e/support/school";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A phone, a small touch screen, where a dialog opens as a sheet from the bottom. */
const PHONE = { height: 844, width: 390 };

/** A wide screen, where the same dialog opens in the middle. */
const DESKTOP = { height: 900, width: 1440 };

/** The scale of the page behind the sheet, as its computed style reads it. */
function stageScale(stage: Locator) {
  return stage.evaluate((element) => getComputedStyle(element).scale);
}

/**
 * Whether the page holds UI SDK's scroll lock, which hides the overflow of the element that scrolls the viewport:
 * `<html>` when it sets an overflow of its own, and `<body>` otherwise.
 */
function scrollLocked(page: Page) {
  return page.evaluate(() => {
    const html = document.documentElement;
    const own = getComputedStyle(html);
    const scroller =
      own.overflowX === "visible" && own.overflowY === "visible"
        ? document.body
        : html;
    const overflow = getComputedStyle(scroller).overflowY;
    return overflow === "hidden" || overflow === "clip";
  });
}

/**
 * Waits until the sheet stands still. It slides up as it opens, so a box read earlier names a place the grip
 * has already left, and a press there lands on the sheet's text.
 */
async function settled(sheet: Locator) {
  await waitForStill(sheet);
}

test("a dialog opens as a sheet on a phone, scales the page back, keeps the focus, and closes on Escape and on a swipe down", async ({
  baseURL,
  browser,
}) => {
  const school = await Effect.runPromise(createSchool());
  const host = `${school.slug}.localhost`;
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: PHONE,
  });
  await Effect.runPromise(
    signInOwner(context, school.slug, hostAddress(baseURL, host, "/"))
  );
  const page = await context.newPage();
  await page.goto(hostAddress(baseURL, host, "/exams"));
  const create = page.getByRole("button", { name: "Create exam" });
  await waitUntilTakenOver(create);
  const stage = page.locator('[data-slot="drawer-stage"]');
  const sheet = page.locator(
    '[data-slot="dialog-content"][data-presentation="sheet"]'
  );
  const centered = page.locator(
    '[data-slot="dialog-content"][data-presentation="dialog"]'
  );

  // The dialog opens from the bottom as a sheet, the page behind it scales back, and the page is locked.
  await create.click();
  await expect(sheet).toBeVisible();
  await expect(centered).toHaveCount(0);
  await expect.poll(() => scrollLocked(page)).toBe(true);
  await expect.poll(() => stageScale(stage)).toBe("0.94");

  // The focus stays in the sheet however far the writer tabs, forward and back. Past the last control, or
  // before the first, a press lands on the trap's guard, which hands the focus to the control at the other end
  // on the next frame, so each press waits for it.
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let press = 0; press < 8; press += 1) {
      await page.keyboard.press(key);
      await expect
        .poll(() =>
          sheet.evaluate((element) => element.contains(document.activeElement))
        )
        .toBe(true);
    }
  }

  // Escape closes it, and the page takes its size back and scrolls again.
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => scrollLocked(page)).toBe(false);
  await expect.poll(() => stageScale(stage)).toBe("none");

  // A swipe down closes it, and the page takes its size back and scrolls again. A touch screen moves the sheet by
  // scrolling its host (UI SDK's scroll-snap driver).
  await create.click();
  await expect(sheet).toBeVisible();
  await settled(sheet);
  await swipeAway(sheet);
  await expect(sheet).toHaveCount(0);
  await expect.poll(() => scrollLocked(page)).toBe(false);
  await expect.poll(() => stageScale(stage)).toBe("none");

  // On a wide screen the same dialog opens in the middle, and the page keeps its size.
  await page.setViewportSize(DESKTOP);
  await create.click();
  await expect(centered).toBeVisible();
  await expect(sheet).toHaveCount(0);
  expect(await stageScale(stage)).toBe("none");
  await context.close();
});
