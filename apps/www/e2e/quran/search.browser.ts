import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The rows of the surah list, each a link to its surah. */
const rows = (page: Page) => page.locator("main ul > li > a");

/** The address of Al-Baqarah, the surah that each search below finds. */
const BAQARAH = /\/en\/quran\/2$/u;

/** Opens the Quran index at one width, with its router hydrated. */
const openIndex = Effect.fn("NakafaE2E.openQuranIndex")(function* (page: Page) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(appRoutes.quran));
  yield* waitForCommittedAppRouter(
    page,
    appRoutes.quran,
    appRoutes.quran,
    readinessTimeoutMilliseconds
  );
  yield* Effect.promise(() => expect(rows(page)).toHaveCount(114));
});

/**
 * The index's header searches its 114 surahs in the browser: by the start of a
 * number, a transliterated name however it is spelled, an Arabic name and the
 * meaning of a name. Nothing found says so, clearing the search brings every
 * surah back, and Tab from the box reaches the first surah it kept, which Enter
 * opens.
 */
test("the Quran index header searches every surah by number, name and meaning", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* openIndex(page);
        const search = page.getByRole("textbox", {
          name: app.Holy["search-surah"],
        });

        yield* Effect.promise(async () => {
          for (const words of ["al baqarah", "ALBAQARAH", "البقرة", "Cow"]) {
            await search.fill(words);
            await expect(rows(page)).toHaveCount(1);
            await expect(rows(page)).toHaveAttribute("href", BAQARAH);
          }
          // 11 and 110 to 114.
          await search.fill("11");
          await expect(rows(page)).toHaveCount(6);

          await search.fill("zzz");
          await expect(rows(page)).toHaveCount(0);
          await expect(
            page.getByText(app.Holy["search-surah-none"], { exact: true })
          ).toBeVisible();

          await search.fill("");
          await expect(rows(page)).toHaveCount(114);

          await search.fill("cow");
          await page.keyboard.press("Tab");
          await expect(rows(page).first()).toBeFocused();
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(BAQARAH);
        });
      })
    )
  );
});

/** A phone keeps the search behind its button in the header, and it searches the same. */
test("a phone opens the Quran index search from its header", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* openIndex(page);
        yield* Effect.promise(async () => {
          await page
            .locator('[data-slot="page-header"]')
            .getByRole("button", { name: app.Holy["search-surah"] })
            .click();
          await page
            .getByRole("textbox", { name: app.Holy["search-surah"] })
            .fill("cow");
          await expect(rows(page)).toHaveCount(1);
          await expect(rows(page)).toHaveAttribute("href", BAQARAH);
        });
      })
    )
  );
});
