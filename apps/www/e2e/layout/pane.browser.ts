import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { LESSON_PATH } from "@/e2e/support/chat";
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

/** A bottom sheet that runs the window's width and ends at its bottom. */
function readSheetProblems(page: Page) {
  return page.evaluate(() => {
    const sheet = document.querySelector('[data-slot="drawer-popup"]');
    if (sheet === null) {
      return ["no sheet opened"];
    }
    const box = sheet.getBoundingClientRect();
    return [
      Math.abs(box.bottom - innerHeight) > 1 &&
        "the sheet does not end at the window's bottom",
      (box.left > 1 || Math.abs(box.right - innerWidth) > 1) &&
        "the sheet does not run the window's width",
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
      expect(await readSheetProblems(page)).toEqual([]);
    }
    await context.close();
  }
});
