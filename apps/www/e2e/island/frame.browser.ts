import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { drawnIsland, expectDrawnIsland } from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

/** The island page of the signed-in learner. */
const ISLAND_PATH = "/en/island";

for (const viewport of [desktopViewport, touchViewport]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`draws a new learner's island on the ${viewport.name} screen in ${colorScheme}`, async ({
      baseURL,
      browser,
    }, testInfo) => {
      expect(baseURL).toBeTruthy();
      const origin = baseURL ?? "";
      const context = await browser.newContext({
        baseURL: origin,
        colorScheme,
        hasTouch: viewport.hasTouch,
        viewport: { height: viewport.height, width: viewport.width },
      });
      await Effect.runPromise(signInLearner(context, origin));
      const page = await context.newPage();
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.promise(async () => {
            await page.goto(ISLAND_PATH);
            await expect(page.getByText("Level 1")).toBeVisible();
            await expectDrawnIsland(page);
            await page.getByRole("button", { name: "More actions" }).click();
            await page.getByRole("menuitem", { name: "Turn right" }).click();
            await expect(
              page.getByRole("menuitem", { name: "Turn left" })
            ).toBeVisible();
            await page.keyboard.press("Escape");
            await expect(drawnIsland(page)).toBeVisible();
            await page.getByRole("button", { name: "More actions" }).click();
            await page
              .getByRole("menuitem", { name: "Water the garden" })
              .click();
            await expect(
              page.getByText("Learn something today, then water your garden.")
            ).toBeVisible();
          })
        )
      );
      await testInfo.attach(`island-${viewport.name}-${colorScheme}.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await context.close();
    });
  }
}
