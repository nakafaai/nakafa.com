import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import { press } from "@/e2e/support/input";
import { drawnIsland, expectDrawnIsland } from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

/** The island page of the signed-in learner. */
const ISLAND_PATH = "/en/island";

/**
 * How far below the canvas's middle the island's front corner cell shows, in
 * art pixels. The camera looks at the middle of a new island, 0.9 cells under
 * its top, so the top of cell (5, 5) of a six-cell island draws 11 art pixels
 * lower, and nothing stands between it and the camera (ADR 0042, D15).
 */
const FRONT_CELL_BELOW_MIDDLE = 11;

/** The grass block's button, whose name goes on with its price. */
const GRASS = /^Grass/u;

for (const viewport of [desktopViewport, touchViewport]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`builds on a new learner's island on the ${viewport.name} screen in ${colorScheme}`, async ({
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
            const canvas = drawnIsland(page);
            await expectDrawnIsland(page);
            await press(
              page.getByRole("button", { name: "Build" }),
              viewport.hasTouch
            );
            const items = page.getByRole("toolbar", { name: "Items" });
            await expect(items).toBeVisible();
            await expect(
              page.getByRole("button", { name: "Undo" })
            ).toBeDisabled();
            const grass = items.getByRole("button", { name: GRASS });
            await press(grass, viewport.hasTouch);
            await expect(grass).toHaveAttribute("aria-pressed", "true");
            await testInfo.attach(
              `island-build-${viewport.name}-${colorScheme}.png`,
              {
                body: await page.screenshot({ fullPage: true }),
                contentType: "image/png",
              }
            );
            const bounds = await canvas.boundingBox();
            const columns = Number(await canvas.getAttribute("width"));
            expect(bounds).not.toBeNull();
            expect(columns).toBeGreaterThan(0);
            const width = bounds?.width ?? 0;
            const height = bounds?.height ?? 0;
            await press(canvas, viewport.hasTouch, {
              position: {
                x: width / 2,
                y: height / 2 + (FRONT_CELL_BELOW_MIDDLE * width) / columns,
              },
            });
            await expect(
              page.getByText("You need more Stars for this.")
            ).toBeVisible();
            await testInfo.attach(
              `island-refused-${viewport.name}-${colorScheme}.png`,
              {
                body: await page.screenshot({ fullPage: true }),
                contentType: "image/png",
              }
            );
            await press(
              page.getByRole("button", { name: "Done" }),
              viewport.hasTouch
            );
            await expect(items).toBeHidden();
          })
        )
      );
      await context.close();
    });
  }
}
