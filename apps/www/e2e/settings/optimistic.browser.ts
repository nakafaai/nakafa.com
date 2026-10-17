import { expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { openChatPage, runOnPage } from "@/e2e/support/chat";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The name of the synthetic learner, which the account button shows. */
const LEARNER_NAME = "Acceptance Learner";
const RENAMED = "Optimistic Learner";
const REFUSED = "Refused Learner";
const NAME_MUTATION = "users/mutations:updateUserName";

test("a learner renames themselves in settings: the new name shows before the server answers, and a refused save comes back", async ({
  baseURL,
  page,
}) => {
  await runOnPage(page, baseURL, (origin) =>
    Effect.gen(function* () {
      const { changes } = yield* openChatPage(page, origin);
      const form = page.locator("#user-settings-name-form");
      const field = form.getByRole("textbox", { name: app.Auth.name });
      const save = form.getByRole("button", { name: app.Auth.save });
      const account = (name: string) =>
        page.locator('[data-sidebar="footer"]').getByRole("button", { name });

      yield* Effect.promise(async () => {
        await page.goto(appRoutes.settings);
        // The form shows the stored name once the page is signed in.
        await expect(field).toHaveValue(LEARNER_NAME, {
          timeout: readinessTimeoutMilliseconds,
        });
        await expect(save).toBeDisabled();

        // The server's answers wait, and the page shows the new name anyway:
        // Save has nothing left to save, and no step of it waits.
        await field.fill(RENAMED);
        await expect(save).toBeEnabled();
        changes.hold();
        await save.click();
        await expect(account(RENAMED)).toBeVisible();
        await expect(save).toBeDisabled();
        changes.release();
        await expect(account(RENAMED)).toBeVisible();

        // A refused save returns the stored name, says so, and offers the
        // typed name again.
        await field.fill(REFUSED);
        changes.failNext(NAME_MUTATION);
        await save.click();
        await expect(
          page.getByText(app.Toast["action-error"].title, { exact: true })
        ).toBeVisible({ timeout: readinessTimeoutMilliseconds });
        await expect(account(RENAMED)).toBeVisible();
        await expect(field).toHaveValue(REFUSED);
        await expect(save).toBeEnabled();
      });
    })
  );
});
