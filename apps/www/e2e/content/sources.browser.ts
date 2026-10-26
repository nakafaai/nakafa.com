import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { COMPANY_SOCIAL_PROFILES } from "@repo/seo/company-profiles";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** A learn catalog that ends with its references. */
const CATALOG_PATH = "/en/curricula";
/** Where the source code of Nakafa lives. */
const SOURCE_ORIGIN = /^https:\/\/github\.com\//u;

/**
 * The references of a learn catalog hold two buttons at most: the source code
 * as the one button with its name, joined with the menu of the places the
 * community meets, whose links open the videos and the community server.
 */
const verifyReferences = Effect.fn("NakafaE2E.verifyCatalogReferences")(
  function* (page: Page) {
    yield* seedAnalyticsConsent(page, "denied");
    const response = yield* Effect.promise(() =>
      page.goto(CATALOG_PATH, { waitUntil: "domcontentloaded" })
    );
    yield* Effect.sync(() => expect(response?.ok()).toBe(true));

    const references = page.getByRole("region", {
      exact: true,
      name: en.Common.references,
    });
    const more = references.getByRole("button", {
      exact: true,
      name: en.Common.more,
    });

    yield* Effect.promise(async () => {
      await expect(references).toBeVisible({
        timeout: readinessTimeoutMilliseconds,
      });
      await expect(references.getByRole("link")).toHaveCount(1);
      await expect(
        references.getByRole("link", {
          exact: true,
          name: en.Common["source-code"],
        })
      ).toHaveAttribute("href", SOURCE_ORIGIN);
      await expect(references.getByRole("button")).toHaveCount(1);

      await waitUntilTakenOver(more);
      await more.click();
      await expect(
        page.getByRole("menuitem", { exact: true, name: en.Common.videos })
      ).toHaveAttribute("href", COMPANY_SOCIAL_PROFILES.youtube);
      await expect(
        page.getByRole("menuitem", { exact: true, name: en.Common.community })
      ).toHaveAttribute("href", COMPANY_SOCIAL_PROFILES.discord);
      await page.keyboard.press("Escape");
      await expect(more).toBeFocused();
    });
  }
);

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test.describe(`catalog references at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("offer the source code and one menu of the community's places", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyReferences(page))
      );
    });
  });
}
