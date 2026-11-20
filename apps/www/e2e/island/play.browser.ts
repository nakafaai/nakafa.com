import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import {
  expectChanged,
  islandStage,
  openIsland,
  pressOpenGround,
  revisionOf,
} from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

for (const viewport of [desktopViewport, touchViewport]) {
  test(`builds, shapes and walks a new learner's world on the ${viewport.name} screen`, async ({
    baseURL,
    browser,
  }, testInfo) => {
    expect(baseURL).toBeTruthy();
    const origin = baseURL ?? "";
    const context = await browser.newContext({
      baseURL: origin,
      hasTouch: viewport.hasTouch,
      recordVideo: {
        dir: testInfo.outputPath("video"),
        size: { height: viewport.height, width: viewport.width },
      },
      viewport: { height: viewport.height, width: viewport.width },
    });
    await Effect.runPromise(signInLearner(context, origin));
    const page = await context.newPage();
    const button = (name: string) =>
      page.getByRole("button", { exact: true, name });
    /** Presses open ground until the world changed, as a learner does who is told there is no room. */
    const change = async () => {
      const before = await revisionOf(page);
      await Effect.runPromise(
        pressOpenGround(
          page,
          viewport.hasTouch,
          async () => (await revisionOf(page)) > before
        )
      );
    };
    /** Presses a control that changes the world by itself, and waits for the change. */
    const changeWith = async (name: string) => {
      const before = await revisionOf(page);
      await button(name).click();
      await expectChanged(page, before);
    };
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        openIsland(page).pipe(
          Effect.andThen(
            Effect.promise(async () => {
              // A free thing goes down with one press, and a step back and forth takes it away and brings it back.
              await button(en.Island["mode-build"]).click();
              await button(en.Island["shelf-decor"]).click();
              await page
                .getByRole("button", { name: en.Island["thing-bench"] })
                .click();
              await change();
              await changeWith(en.Common.undo);
              await changeWith(en.Common.redo);
              // A priced thing asks for its blueprint, which a new learner cannot open yet.
              await button(en.Island["shelf-building"]).click();
              await page
                .getByRole("button", { name: en.Island["thing-cottage"] })
                .click();
              const blueprint = page.getByRole("dialog", {
                name: en.Island["thing-cottage"],
              });
              await expect(blueprint).toBeVisible();
              await testInfo.attach(`world-blueprint-${viewport.name}.png`, {
                body: await page.screenshot(),
                contentType: "image/png",
              });
              await page.keyboard.press("Escape");
              await expect(blueprint).toBeHidden();
              // A brush paints the land where it is pressed.
              await button(en.Island["mode-brush"]).click();
              await button(en.Island["brush-path"]).click();
              await change();
              await testInfo.attach(`world-shelf-${viewport.name}.png`, {
                body: await page.screenshot(),
                contentType: "image/png",
              });
              // The fox walks where the learner presses while they explore.
              await button(en.Island["mode-explore"]).click();
              const start = await islandStage(page).getAttribute("data-player");
              await Effect.runPromise(
                pressOpenGround(
                  page,
                  viewport.hasTouch,
                  async () =>
                    (await islandStage(page).getAttribute("data-player")) !==
                    start
                )
              );
              await expect(islandStage(page)).toHaveAttribute(
                "data-walking",
                "false",
                { timeout: revealTimeoutMilliseconds }
              );
              // The map opens over the world and closes again.
              await button(en.Island.map).click();
              const map = page.getByRole("dialog", { name: en.Island.map });
              await expect(map).toBeVisible();
              await page.keyboard.press("Escape");
              await expect(map).toBeHidden();
              await testInfo.attach(`world-${viewport.name}.png`, {
                body: await page.screenshot(),
                contentType: "image/png",
              });
              await button(en.Island.leave).click();
              await expect(islandStage(page)).toBeHidden();
            })
          )
        )
      )
    );
    const video = page.video();
    await context.close();
    if (video !== null) {
      await testInfo.attach(`world-play-${viewport.name}.webm`, {
        contentType: "video/webm",
        path: await video.path(),
      });
    }
  });
}
