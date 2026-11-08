import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withoutRawKeys } from "@/e2e/support/keys";
import { scrollThroughPage } from "@/e2e/support/scroll";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The box of each section under the first screen (`LaterSection`), whose HTML waits for its code until a reader nears it. */
const LATER_SECTION = '[class*="[content-visibility:auto]"]';

/** The pages every visitor reads in each language, one for each shell and each list of records. */
const PAGES = {
  de: ["/de", "/de/pricing", "/de/search", "/de/try-out", "/de/quran"],
  en: ["/en", "/en/pricing", "/en/search", "/en/try-out", "/en/quran"],
  id: ["/id", "/id/pricing", "/id/search", "/id/try-out", "/id/quran"],
};

/**
 * Opens one page, waits until it took over, and leaves its menus' messages rendered. A section under the first screen
 * renders on the client only once a reader nears it (ADR 0039), so the page is read down to its end and every such
 * section takes over: its messages are the route's to hold too.
 */
const openPage = (page: Page, path: string) =>
  Effect.gen(function* () {
    yield* Effect.promise(async () => {
      await page.goto(path, { waitUntil: "load" });
      await waitUntilTakenOver(page.locator("main").first());
    });
    yield* scrollThroughPage(page);
    yield* Effect.promise(() =>
      expect
        .poll(() =>
          page
            .locator(LATER_SECTION)
            .evaluateAll((boxes) =>
              boxes.every((box) =>
                Object.keys(box.firstElementChild ?? box).some((key) =>
                  key.startsWith("__reactFiber$")
                )
              )
            )
        )
        .toBe(true)
    );
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
      pinnedRoutes.track[locale],
    ]) {
      await Effect.runPromise(withoutRawKeys(page, path, openPage(page, path)));
    }
  });
}
