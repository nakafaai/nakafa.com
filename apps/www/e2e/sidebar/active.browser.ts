import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { appRoutes } from "@/e2e/support/route";
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
