import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { appRoutes } from "@/e2e/support/route";
import { VISIBLE_SIDEBAR_TRIGGER } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport } from "@/e2e/support/viewport";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The address of a try-out page. */
const TRYOUT_ADDRESS = /\/try-out/u;

/** The sidebar beside the page on a wide screen. */
const SIDEBAR = '[data-side="left"] [data-sidebar="sidebar"]';

/** The marked rows of the sidebar beside the page. */
const marked = (page: Page) => page.locator(`${SIDEBAR} a[data-active="true"]`);

/**
 * A press from one section to another moves the sidebar's mark with it: once the next page is on screen only its
 * section is marked, never the section the reader left as well.
 */
test("moves the sidebar's mark from the Quran to Try out when Try out is pressed", async ({
  page,
}) => {
  await Effect.runPromise(seedAnalyticsConsent(page, "denied"));
  await page.setViewportSize(desktopViewport);
  await page.goto(appRoutes.quran, { waitUntil: "domcontentloaded" });
  await expect(marked(page)).toHaveText([en.Holy.quran], {
    timeout: readinessTimeoutMilliseconds,
  });
  const tryout = page
    .locator(SIDEBAR)
    .getByRole("link", { exact: true, name: "Try out" });
  await waitUntilTakenOver(tryout);
  await tryout.click();
  await page.waitForURL(TRYOUT_ADDRESS);
  await page.waitForLoadState("networkidle");
  await expect(marked(page)).toHaveText(["Try out"]);
  // It stays so: nothing marks the Quran again once the page has settled.
  await page.waitForTimeout(1000);
  await expect(marked(page)).toHaveText(["Try out"]);
});

/**
 * A phone's sidebar is a sheet drawn once, as the page settles, and kept in the page while it is closed, so opening
 * it adds no link and no picture: it slides in whole, the first time and every time after.
 */
test("opens the phone's sidebar on what it already drew, the second time too", async ({
  page,
}) => {
  await Effect.runPromise(seedAnalyticsConsent(page, "denied"));
  await page.setViewportSize({ height: 844, width: 390 });
  await page.goto(appRoutes.quran, { waitUntil: "domcontentloaded" });
  const sheet = page.locator('[data-mobile="true"]');
  const trigger = page.locator(VISIBLE_SIDEBAR_TRIGGER).first();
  await waitUntilTakenOver(trigger);
  // The sheet's links are in the page, unseen, before the first press.
  await expect(sheet.locator("a[href]").first()).toBeAttached({
    timeout: readinessTimeoutMilliseconds,
  });

  for (let open = 0; open < 2; open += 1) {
    await sheet.evaluate((element) => {
      const added = { count: 0 };
      Reflect.set(window, "__sidebarAdded", added);
      new MutationObserver((records) => {
        for (const record of records) {
          for (const node of Array.from(record.addedNodes)) {
            if (
              node instanceof Element &&
              (node.matches("a, img") || node.querySelector("a, img") !== null)
            ) {
              added.count += 1;
            }
          }
        }
      }).observe(element, { childList: true, subtree: true });
    });
    await trigger.click();
    await expect(sheet.locator("a[href]").first()).toBeVisible();
    await page.waitForTimeout(600);
    expect(
      await page.evaluate(() =>
        Number(Reflect.get(window, "__sidebarAdded").count)
      )
    ).toBe(0);
    await page.keyboard.press("Escape");
    await expect(sheet.locator("a[href]").first()).toBeHidden();
  }
});
