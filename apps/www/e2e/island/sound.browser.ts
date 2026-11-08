import { expect, test } from "@playwright/test";
import { Effect } from "effect";
import {
  drawnIsland,
  expectDrawnIsland,
  openIsland,
} from "@/e2e/support/island";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";

test("starts the island's sound on the first press and remembers the owner turning it off", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  const context = await browser.newContext({ baseURL: origin });
  await Effect.runPromise(signInLearner(context, origin));
  const page = await context.newPage();
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      openIsland(page, false).pipe(
        Effect.andThen(
          Effect.promise(async () => {
            await drawnIsland(page).click();
            await page.getByRole("button", { name: "More actions" }).click();
            const sound = page.getByRole("menuitemcheckbox", { name: "Sound" });
            await expect(sound).toBeChecked();
            await sound.click();
            await page.reload();
            await expectDrawnIsland(page);
            await page.getByRole("button", { name: "More actions" }).click();
            await expect(
              page.getByRole("menuitemcheckbox", { name: "Sound" })
            ).not.toBeChecked();
            await page.getByRole("menuitemcheckbox", { name: "Sound" }).click();
            await expect(
              page.getByRole("menuitemcheckbox", { name: "Sound" })
            ).toBeChecked();
          })
        )
      )
    )
  );
  await context.close();
});
