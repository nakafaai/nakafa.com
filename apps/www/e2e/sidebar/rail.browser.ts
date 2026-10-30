import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The Quran page, which a rail entry opens. */
const QURAN_URL = /\/en\/quran$/;

/** The width of the sidebar folded into its rail, in pixels: `w-12`. */
const RAIL = 48;

/**
 * On a desktop the sidebar's toggle sits at its foot, above the account, and the
 * page header holds none. Folding the sidebar leaves a rail of its icons: each entry
 * still opens its page, its name shows as a tooltip, and the page follows the rail's
 * edge. The toggle opens the sidebar again.
 */
test("at 1440px the sidebar folds into a rail of named icons from its own toggle", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.andThen(
        seedAnalyticsConsent(page, "denied"),
        Effect.promise(async () => {
          await page.goto("/en/try-out");
          const sidebar = page.locator('[data-slot="sidebar-container"]');
          const toggle = sidebar.getByRole("button", {
            name: "Toggle Sidebar",
          });
          await expect(
            page
              .locator('[data-slot="page-header"]')
              .getByRole("button", { name: "Toggle Sidebar" })
          ).toBeHidden();
          await waitUntilTakenOver(toggle);
          await toggle.click();

          await expect
            .poll(async () => (await sidebar.boundingBox())?.width, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBe(RAIL);
          const quran = sidebar.getByRole("link", { name: "Quran" });
          await quran.hover();
          await expect(
            page.locator('[data-slot="tooltip-content"]')
          ).toHaveText("Quran");
          // The page starts at the rail's edge.
          const main = await page
            .locator("main")
            .first()
            .evaluate((node) =>
              Number.parseFloat(getComputedStyle(node).paddingLeft)
            );
          expect(main).toBe(RAIL);

          await quran.click();
          await expect(page).toHaveURL(QURAN_URL);
          await toggle.click();
          await expect
            .poll(async () => (await sidebar.boundingBox())?.width)
            .toBeGreaterThan(RAIL);
        })
      )
    )
  );
});
