import { expect, type Page, test } from "@playwright/test";
import app from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The first surah, whose header searches for another. */
const FATIHAH = "/en/quran/1";

/** The address of Al-Baqarah, which each search below finds. */
const BAQARAH = /\/en\/quran\/2$/u;

/** The name of Al-Baqarah's option in the search's list. */
const BAQARAH_OPTION = /Al-Baqara\b/u;

/** The header of the surah page. */
const header = (page: Page) => page.locator('[data-slot="page-header"]');

/** The search box once its list has loaded, which a combobox names. */
const searchBox = (page: Page) =>
  page.getByRole("combobox", { name: app.Holy["search-surah"] });

/** Opens a surah from its own address with its router hydrated. */
const openSurah = Effect.fn("NakafaE2E.openSurahForSearch")(function* (
  page: Page,
  href: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(href));
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );
});

/**
 * A surah page's header searches every surah: the box loads its list when the
 * reader turns to it, the list keeps the surahs whose number, names or meaning
 * hold the words, the first one highlighted, and Enter opens it. A word nothing
 * holds says so, and the next surah's header starts empty.
 */
test("a surah page's header finds another surah by its meaning, its names and its number", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* openSurah(page, FATIHAH);
        yield* Effect.promise(async () => {
          await header(page)
            .getByRole("textbox", { name: app.Holy["search-surah"] })
            .click();
          const box = searchBox(page);
          await expect(box).toBeFocused();

          for (const words of ["al baqarah", "البقرة", "2"]) {
            await box.fill(words);
            await expect(page.getByRole("option").first()).toHaveAccessibleName(
              BAQARAH_OPTION
            );
          }

          await box.fill("zzz");
          await expect(
            page.getByText(app.Holy["search-surah-none"], { exact: true })
          ).toBeVisible();

          await box.fill("cow");
          await expect(page.getByRole("option")).toHaveCount(1);
          await box.press("Enter");
          await expect(page).toHaveURL(BAQARAH);
          await expect(
            header(page).getByRole("textbox", {
              name: app.Holy["search-surah"],
            })
          ).toHaveValue("");
        });
      })
    )
  );
});

/** A phone opens the search from its header button, and a press on a surah opens it. */
test("a phone finds another surah from the search button of a surah page's header", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* openSurah(page, FATIHAH);
        yield* Effect.promise(async () => {
          await header(page)
            .getByRole("button", { name: app.Holy["search-surah"] })
            .click();
          const box = searchBox(page);
          await expect(box).toBeFocused();
          await box.fill("cow");
          await page.getByRole("option", { name: BAQARAH_OPTION }).click();
          await expect(page).toHaveURL(BAQARAH);
        });
      })
    )
  );
});
