import { type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withoutRawKeys } from "@/e2e/support/keys";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The pages every visitor reads in each language, one for each shell and each list of records. */
const PAGES = {
  de: ["/de", "/de/pricing", "/de/search", "/de/try-out", "/de/quran"],
  en: ["/en", "/en/pricing", "/en/search", "/en/try-out", "/en/quran"],
  id: ["/id", "/id/pricing", "/id/search", "/id/try-out", "/id/quran"],
};

/** Opens one page, waits until it took over, and leaves its menus' messages rendered. */
const openPage = (page: Page, path: string) =>
  Effect.promise(async () => {
    await page.goto(path, { waitUntil: "load" });
    await waitUntilTakenOver(page.locator("main").first());
  });

/**
 * On 1 November the try-out table's sort menu showed `DataTable.sort` on production: the route's pick of namespaces
 * left the table's messages out, in every language. A page that draws a raw key, or renders a message its route does
 * not hold, fails here in each of them.
 */
for (const locale of ["de", "en", "id"] as const) {
  test(`every visitor page in ${locale} draws its messages, never a raw key`, async ({
    page,
  }) => {
    for (const path of [
      ...PAGES[locale],
      pinnedRoutes.article[locale],
      pinnedRoutes.material[locale],
      `/${locale}/try-out/indonesia/snbt/2027`,
    ]) {
      await Effect.runPromise(withoutRawKeys(page, path, openPage(page, path)));
    }
  });
}
