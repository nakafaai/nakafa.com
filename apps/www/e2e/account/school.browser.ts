import { type BrowserContextOptions, expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";

const ENTRY = app.SchoolStart;

/** The session and the account's reads answer before the page picks a form, slower on a busy machine. */
const SESSION_WAIT = 30_000;

/**
 * The School entry leads an account with no school to the form that finds one, and an
 * address that names no school says so in the field's own line. The synthetic learner
 * has not answered the onboarding, so home would send it there first.
 */
test("The School entry leads a learner with no school to the form", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  const origin = baseURL ?? "";
  const options: BrowserContextOptions = {
    baseURL: origin,
    serviceWorkers: "block",
    viewport: { height: 844, width: 390 },
  };

  await Effect.runPromise(
    withBrowserContext(browser, options, (context) =>
      Effect.gen(function* () {
        yield* signInLearner(context, origin);
        const page = yield* Effect.promise(() => context.newPage());
        yield* withObservedPageErrors(
          page,
          Effect.promise(async () => {
            await page.goto("/en/school", { waitUntil: "load" });
            await expect(
              page.getByRole("heading", { name: ENTRY["entry-title"] })
            ).toBeVisible({ timeout: SESSION_WAIT });

            const field = page.getByLabel(ENTRY["entry-field"]);
            await field.fill("nakafa.com");
            await page
              .getByRole("button", { name: ENTRY["entry-submit"] })
              .click();
            await expect(page.getByText(ENTRY["entry-invalid"])).toBeVisible();
            await expect(page.getByText(ENTRY["entry-hint"])).toBeHidden();

            await field.fill("harapan");
            await expect(page.getByText(ENTRY["entry-hint"])).toBeVisible();
          })
        );
      })
    )
  );
});
