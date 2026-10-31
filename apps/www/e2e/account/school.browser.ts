import { type BrowserContextOptions, expect, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { withBrowserContext } from "@/e2e/support/context";
import { signInLearner } from "@/e2e/support/learner";
import { withObservedPageErrors } from "@/e2e/support/observe";

const ENTRY = app.SchoolStart;
const SCHOOL_PATH = /\/en\/school$/u;

/**
 * The home page's fourth card leads an account with no school to the form that finds
 * one. An address that names no school says so in the field's own line, and the card
 * row keeps its four cards inside a phone's width.
 */
test("School on the home page leads a learner with no school to the form", async ({
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
            await page.goto("/en/home", { waitUntil: "load" });
            const school = page
              .getByRole("main")
              .getByRole("link", { exact: true, name: app.Common.school });
            await expect(school).toBeVisible();
            expect(
              await page.evaluate(
                () =>
                  document.documentElement.scrollWidth <=
                  document.documentElement.clientWidth
              )
            ).toBe(true);

            await school.click();
            await expect(page).toHaveURL(SCHOOL_PATH);
            await expect(
              page.getByRole("heading", { name: ENTRY["entry-title"] })
            ).toBeVisible();

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
