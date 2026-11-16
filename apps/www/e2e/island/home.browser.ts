import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { islandStage } from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { finishOnboarding } from "@/e2e/support/onboarding";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

/** The game's own page, where the home's world leads. */
const GAME_PATH = /\/en\/island$/u;

for (const viewport of [desktopViewport, touchViewport]) {
  test(`opens a new learner's home with its hero, tracker and world pane, and enters the game from the world on the ${viewport.name} screen`, async ({
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
          // A new learner answers the questionnaire once; until then home sends them to it.
          // Its last answer opens their curriculum, which finishes loading before the next page is asked for.
          await finishOnboarding(page);
          await page.waitForLoadState("networkidle");
          // The signed-in home lives at its own path; /en is the landing every visitor sees.
          await page.goto("/en/home");
          // The body of a new learner: the greeting's one sentence, the streak with no run yet, and a way into each section.
          await expect(page.getByText(en.Home["hero-start"])).toBeVisible();
          await expect(page.getByText("No streak yet")).toBeVisible();
          await expect(page.getByText(en.Home["tryouts-first"])).toBeVisible();
          await expect(page.getByText(en.Home["subjects-first"])).toBeVisible();
          await expect(page.getByText("Trending")).toHaveCount(0);
          // The header's one button is the page's primary action: a new learner starts learning.
          await expect(
            page.getByRole("link", { name: en.Home.begin })
          ).toBeVisible();
          // The world pane stands beside the page on a wide screen; on a phone the tracker's Your world opens its sheet.
          const door = page.getByRole("button", {
            name: en.Island["world-title"],
          });
          if (viewport.hasTouch) {
            // A phone shows one header row, and it holds the sidebar's button.
            await expect(
              page.getByRole("button", { name: en.Common["toggle-sidebar"] })
            ).toBeVisible();
            await expect(page.locator('[data-slot="app-header"]')).toBeHidden();
            await door.click();
          } else {
            await expect(door).toHaveCount(0);
          }
          // The pane reads the island's level over the bar toward the next one, then the medals by name.
          await expect(
            page.getByRole("heading", { name: "Level 1", exact: true })
          ).toBeVisible();
          await expect(
            page.getByRole("progressbar", { name: "Level 1" }).first()
          ).toBeVisible();
          await expect(
            page.getByText(en.Island["badges-title"], { exact: true })
          ).toBeVisible();
          await expect(
            page.getByText(en.Island["badge-days"], { exact: true })
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
