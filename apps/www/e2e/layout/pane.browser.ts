import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { readFrameProblems } from "@/e2e/support/frame";
import { signInLearner } from "@/e2e/support/learner";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

/**
 * The owner's rule (8 Nov): a pane opens at the right edge of the screen, from the window's top to its bottom, and the
 * whole page narrows beside it, so the body is never wider than the header and nothing stands inside the body. On a
 * phone the same pane is a sheet from the bottom of the screen, and the page keeps its whole width. Reads it from what
 * is drawn, on a reading page's outline and on a detail opened by a press.
 */

/** A bottom sheet that runs the window's width and rests at its bottom, one even inset off its edges. */
function readSheetProblems(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-slot="drawer-popup"]');
    if (sheet === null) {
      return ["no sheet opened"];
    }
    // The sheet floats one even inset off the window's sides and bottom.
    const box = sheet.getBoundingClientRect();
    const inset = box.left;
    return [
      (inset < 0 || inset > 16) && "the sheet does not run the window's width",
      Math.abs(innerWidth - box.right - inset) > 1 &&
        "the sheet stands off centre",
      Math.abs(innerHeight - box.bottom - inset) > 1 &&
        "the sheet does not rest at the window's bottom",
      Array.from(document.querySelectorAll("[data-pane-side]")).some(
        (pane) => pane.getBoundingClientRect().width > 1
      ) && "a pane stands beside the page on a phone",
    ].filter((problem) => typeof problem === "string");
  });
}

/** Whether a reading page's outline stands beside the page. */
function readOutlineWidth(page: Page) {
  return page.evaluate(
    () =>
      document
        .querySelector(
          '[data-slot="sidebar"][data-side="right"] [data-slot="sidebar-container"]'
        )
        ?.getBoundingClientRect().width ?? 0
  );
}

test("a lesson's outline stands at the screen's right edge on a desktop, and a phone keeps the page whole", async ({
  baseURL,
  browser,
}) => {
  for (const viewport of [desktopViewport, touchViewport]) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    // The usage-data prompt floats over the page until the visitor answers it, so the visit answers it first.
    await Effect.runPromise(seedAnalyticsConsent(page, "denied"));
    await page.goto(`${baseURL}${LESSON_PATH}`);
    await expect(page.locator('[data-slot="page-header"]')).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    const outline = await readOutlineWidth(page);
    if (viewport.width === desktopViewport.width) {
      expect(outline).toBeGreaterThan(0);
    } else {
      expect(outline).toBe(0);
    }
    expect(await readFrameProblems(page)).toEqual([]);
    await context.close();
  }
});

test("a connector's detail opens at the screen's right edge on a desktop and as a sheet on a phone", async ({
  baseURL,
  browser,
}) => {
  for (const viewport of [desktopViewport, touchViewport]) {
    const context = await browser.newContext({ viewport });
    await Effect.runPromise(signInLearner(context, String(baseURL)));
    const page = await context.newPage();
    await Effect.runPromise(seedAnalyticsConsent(page, "denied"));
    await page.goto(`${baseURL}/en/user/settings/connectors`);
    const open = page.getByRole("button", {
      exact: true,
      name: "Google Calendar",
    });
    await expect(open).toBeVisible({ timeout: readinessTimeoutMilliseconds });
    await open.click();
    if (viewport.width === desktopViewport.width) {
      await expect(page.locator("[data-pane-side]")).toBeVisible();
      expect(await readFrameProblems(page)).toEqual([]);
    } else {
      await expect(page.locator('[data-slot="drawer-popup"]')).toBeVisible();
      // The sheet slides up from the bottom, so it is read where it comes to rest.
      await expect.poll(() => readSheetProblems(page)).toEqual([]);
    }
    await context.close();
  }
});
