import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import {
  expectRevision,
  islandStage,
  openIsland,
  pressWorld,
} from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

for (const viewport of [desktopViewport, touchViewport]) {
  test(`builds and digs on a new learner's island on the ${viewport.name} screen`, async ({
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
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        openIsland(page, viewport.hasTouch).pipe(
          Effect.andThen(pressWorld(page, viewport.hasTouch)),
          Effect.andThen(Effect.promise(() => expectRevision(page, 1))),
          Effect.andThen(
            Effect.promise(() =>
              page.getByRole("button", { name: en.Island.pickaxe }).click()
            )
          ),
          Effect.andThen(pressWorld(page, viewport.hasTouch)),
          Effect.andThen(
            Effect.promise(async () => {
              await expectRevision(page, 2);
              await page.getByRole("button", { name: en.Island.undo }).click();
              await expectRevision(page, 3);
              await page.getByRole("button", { name: en.Island.redo }).click();
              await expectRevision(page, 4);
              await page.getByRole("button", { name: en.Island.book }).click();
              const book = page.getByRole("dialog", { name: en.Island.book });
              await expect(
                book.getByRole("button", { name: en.Island["block-flowers"] })
              ).toBeEnabled();
              await expect(
                book.getByRole("button", { name: "Opens at level 2" }).first()
              ).toBeDisabled();
              await testInfo.attach(`island-book-${viewport.name}.png`, {
                body: await page.screenshot(),
                contentType: "image/png",
              });
              await book
                .getByRole("button", { name: en.Island["block-flowers"] })
                .click();
              await expect(book).toBeHidden();
              // The pickaxe held the first slot, which now holds the flowers too.
              await expect(
                page
                  .getByRole("button", { name: en.Island["block-flowers"] })
                  .first()
              ).toHaveAttribute("aria-pressed", "true");
              // A ready-made tree goes in whole with one press, and a cottage stays locked until level 3.
              await page.getByRole("button", { name: en.Island.book }).click();
              await expect(
                book.getByRole("button", { name: "Opens at level 3" }).first()
              ).toBeDisabled();
              await book
                .getByRole("button", { name: en.Island["item-tree"] })
                .click();
              await expect(book).toBeHidden();
            })
          ),
          Effect.andThen(pressWorld(page, viewport.hasTouch)),
          Effect.andThen(
            Effect.promise(async () => {
              await expectRevision(page, 5);
              // The learner's fox walks where they press with their feet in hand.
              const start = await islandStage(page).getAttribute("data-player");
              await page.getByRole("button", { name: en.Island.walk }).click();
              const box = await islandStage(page).boundingBox();
              expect(box).not.toBeNull();
              if (box !== null) {
                const x = box.x + box.width * 0.5;
                const y = box.y + box.height * 0.72;
                await (viewport.hasTouch
                  ? page.touchscreen.tap(x, y)
                  : page.mouse.click(x, y));
              }
              await expect(islandStage(page)).not.toHaveAttribute(
                "data-player",
                start ?? ""
              );
              await expect(islandStage(page)).toHaveAttribute(
                "data-walking",
                "false",
                { timeout: revealTimeoutMilliseconds }
              );
              await testInfo.attach(`island-${viewport.name}.png`, {
                body: await page.screenshot(),
                contentType: "image/png",
              });
              await page.getByRole("button", { name: en.Island.leave }).click();
              await expect(islandStage(page)).toBeHidden();
            })
          )
        )
      )
    );
    const video = page.video();
    await context.close();
    if (video !== null) {
      await testInfo.attach(`island-play-${viewport.name}.webm`, {
        contentType: "video/webm",
        path: await video.path(),
      });
    }
  });
}
