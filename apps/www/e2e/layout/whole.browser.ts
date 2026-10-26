import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Catalogs whose cards and rows carry titles: the subjects of the articles, and the articles of one subject. */
const CATALOGS = ["/en/articles", "/en/articles/politics"];

/**
 * Reads every title of the page's cards and rows that is cut: one that a line
 * clamp or an ellipsis could shorten, or one whose words run past its box.
 */
function readCutTitles(page: Page) {
  return page.locator("main").evaluate((main) =>
    Array.from(main.querySelectorAll("h2, h3"))
      .filter((title) => title instanceof HTMLElement)
      .flatMap((title) => {
        // A card may clamp the box that holds its title rather than the title.
        const clamped = [title, title.parentElement].some((box) => {
          if (box === null) {
            return false;
          }
          const style = getComputedStyle(box);
          return (
            style.getPropertyValue("-webkit-line-clamp") !== "none" ||
            style.textOverflow === "ellipsis"
          );
        });
        const overflows =
          title.scrollWidth > title.clientWidth + 1 ||
          title.scrollHeight > title.clientHeight + 1;
        return clamped || overflows ? [title.textContent?.trim() ?? ""] : [];
      })
  );
}

/** Opens a catalog and proves that every title of its cards and rows shows whole. */
const verifyWholeTitles = Effect.fn("NakafaE2E.verifyWholeTitles")(function* (
  page: Page,
  path: string
) {
  yield* seedAnalyticsConsent(page, "denied");
  const response = yield* Effect.promise(() =>
    page.goto(path, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* Effect.promise(async () => {
    await expect(page.locator("main h2").first()).toBeVisible({
      timeout: readinessTimeoutMilliseconds,
    });
    expect(await readCutTitles(page)).toEqual([]);
  });
});

for (const viewport of [
  { height: 844, width: 390 },
  { height: 900, width: 1440 },
]) {
  test.describe(`card and row titles at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const path of CATALOGS) {
      test(`show whole on ${path}`, async ({ page }) => {
        await Effect.runPromise(
          withObservedPageErrors(page, verifyWholeTitles(page, path))
        );
      });
    }
  });
}
