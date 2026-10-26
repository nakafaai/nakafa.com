import { expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { isTakenOver } from "@/e2e/support/window";

/** The addresses of the account section and the Memory section of settings. */
const SETTINGS_URL = /\/en\/user\/settings$/;
const MEMORY_URL = /\/en\/user\/settings\/memory$/;

/** The first row of the settings sidebar, which leads out of settings. */
const BACK = app.Auth["back-to-nakafa"];

/**
 * Settings has its own sidebar, so its first row leads back to Nakafa: to the
 * page the learner read before settings, past every section they opened in
 * between, and Escape leaves the same way. Settings opened first leads home.
 */
test("the settings sidebar leads back to the page the learner came from, and Escape does too", async ({
  baseURL,
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { learner } = yield* openChatPage(page, origin);
      const profile = `/en/@${learner.username}`;

      yield* Effect.promise(async () => {
        await page.goto(profile);
        const edit = page.getByRole("link", { name: app.Auth["edit-profile"] });
        await expect
          .poll(() => isTakenOver(edit), {
            timeout: readinessTimeoutMilliseconds,
          })
          .toBe(true);
        await edit.click();
        await expect(page).toHaveURL(SETTINGS_URL);

        const back = page.getByRole("link", { exact: true, name: BACK });
        await expect(back).toBeVisible();
        // A section opened in settings does not change where the way back leads.
        await page
          .getByRole("link", { exact: true, name: app.Auth.memory })
          .click();
        await expect(page).toHaveURL(MEMORY_URL);
        await back.click();
        await expect(page).toHaveURL(new RegExp(`${profile}$`));

        await edit.click();
        await expect(back).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page).toHaveURL(new RegExp(`${profile}$`));

        // Settings opened first has no page before it, so its way back leads home.
        await page.goto(appRoutes.settings);
        await expect(back).toHaveAttribute("href", "/en/home");
      });
    })
  );
});
