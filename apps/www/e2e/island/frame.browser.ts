import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { drawnIsland, openIsland } from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

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
          openIsland(page, viewport.hasTouch).pipe(
            Effect.andThen(
              Effect.promise(async () => {
                await expect(page.getByText("Level 1")).toBeVisible();
                await page
                  .getByRole("button", { name: "More actions" })
                  .click();
                await page
                  .getByRole("menuitem", { name: "Turn right" })
                  .click();
                await expect(
                  page.getByRole("menuitem", { name: "Turn left" })
                ).toBeVisible();
                await page.keyboard.press("Escape");
                await expect(drawnIsland(page)).toBeVisible();
                await page
                  .getByRole("button", { name: "More actions" })
                  .click();
                await page
                  .getByRole("menuitem", { name: "Water the garden" })
                  .click();
                await expect(
                  page.getByText("Learn something first, then water.")
                ).toBeVisible();
              })
            )
          )
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
