import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { islandStage } from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

/** The game's own page, where the home's world leads. */
const GAME_PATH = /\/en\/island$/u;

for (const viewport of [desktopViewport, touchViewport]) {
  test(`opens a new learner's home with their streak and world pane, and enters the game from the world on the ${viewport.name} screen`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    expect(baseURL).toBeTruthy();
    const origin = baseURL ?? "";
    const context = await browser.newContext({
      baseURL: origin,
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });
    await Effect.runPromise(signInLearner(context, origin));
    const page = await context.newPage();
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.promise(async () => {
          // The signed-in home lives at its own path; /en is the landing every visitor sees.
          await page.goto("/en/home");
          // The body: the streak and the lessons to pick up again; the tile grids are gone.
          await expect(page.getByText("Start a run today")).toBeVisible();
          await expect(
            page.getByRole("heading", { name: en.Home.continue })
          ).toBeVisible();
          await expect(page.getByText("Trending")).toHaveCount(0);
          // The world pane stands open on a wide screen; on a phone Your world opens its sheet.
          const toggle = page.getByRole("button", {
            name: en.Island["world-title"],
          });
          if ((await toggle.getAttribute("aria-pressed")) !== "true") {
            await toggle.click();
          }
          await expect(
            page.getByText(en.Island["badges-title"], { exact: true })
          ).toBeVisible();
          await expect(
            page.getByText(en.Island["leaders-title"], { exact: true })
          ).toBeVisible();
          const world = page.getByRole("link", { name: en.Island.play });
          await expect(world).toBeVisible();
          await world.hover();
          await expect(page.getByTestId("island-view")).toHaveAttribute(
            "data-drawn",
            "true",
            { timeout: revealTimeoutMilliseconds }
          );
          await testInfo.attach(`home-${viewport.name}.png`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: "image/png",
          });
          await world.click();
          await expect(page).toHaveURL(GAME_PATH);
          await expect(islandStage(page)).toHaveAttribute(
            "data-drawn",
            "true",
            {
              timeout: revealTimeoutMilliseconds,
            }
          );
        })
      )
    );
    await context.close();
  });
}
