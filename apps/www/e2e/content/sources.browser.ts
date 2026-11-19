import { expect, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/observe";

/** The catalog routes that used to end with the source-code and community links. */
const CATALOGS = [
  "/en/articles",
  "/en/articles/politics",
  "/en/curriculum",
  "/en/curriculum/merdeka",
  "/en/try-out/indonesia",
] as const;

for (const width of [320, 1440]) {
  test.describe(`catalog pages at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    for (const href of CATALOGS) {
      test(`${href} ends without the references footer`, async ({ page }) => {
        await Effect.runPromise(
          withObservedPageErrors(
            page,
            Effect.promise(async () => {
              const response = await page.goto(href);
              expect(response?.ok()).toBe(true);
              await expect(
                page.locator('[data-slot="page-header"]')
              ).toBeVisible();
              await expect(
                page.locator('[data-slot="page-footer"]')
              ).toHaveCount(0);
              await expect(
                page.getByRole("region", {
                  exact: true,
                  name: en.Common.references,
                })
              ).toHaveCount(0);
            })
          )
        );
      });
    }
  });
}
