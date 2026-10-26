import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { readLayoutShift } from "@/e2e/support/layout";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { CARD } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const verifyQuranLayoutStability = Effect.fn(
  "NakafaE2E.verifyQuranLayoutStability"
)(function* (page: Page) {
  yield* seedAnalyticsConsent(page, "denied");

  // A short surah keeps the pagination in the first viewport, where a list
  // that grows after hydration would push it down.
  for (const href of ["/en/quran/1", appRoutes.quranSurah]) {
    const response = yield* Effect.promise(() =>
      page.goto(href, { waitUntil: "domcontentloaded" })
    );
    yield* Effect.sync(() => expect(response?.ok()).toBe(true));
    yield* waitForCommittedAppRouter(
      page,
      href,
      href,
      readinessTimeoutMilliseconds
    );
    yield* Effect.promise(() => page.waitForLoadState("networkidle"));
    const layoutShift = yield* readLayoutShift(page);
    yield* Effect.sync(() => expect(layoutShift).toBe(0));
  }
});

/**
 * The surah list fills its card: the first row's highlight reaches the top
 * edge and the last row's the bottom edge, each with the card's spacing, and
 * the page leaves room below the card.
 */
const verifyQuranIndexEdges = Effect.fn("NakafaE2E.verifyQuranIndexEdges")(
  function* (page: Page) {
    yield* seedAnalyticsConsent(page, "denied");
    const href = appRoutes.quran;
    yield* Effect.promise(() => page.goto(href));
    yield* waitForCommittedAppRouter(
      page,
      href,
      href,
      readinessTimeoutMilliseconds
    );
    const edges = yield* Effect.promise(() =>
      page
        .locator(CARD)
        .first()
        .evaluate((card) => {
          const rows = card.querySelectorAll("li > a");
          const first = rows.item(0);
          const last = rows.item(rows.length - 1);
          const box = card.getBoundingClientRect();
          return {
            firstGap: first.getBoundingClientRect().top - box.top,
            firstSpacing: getComputedStyle(first).paddingTop,
            lastGap: box.bottom - last.getBoundingClientRect().bottom,
            lastSpacing: getComputedStyle(last).paddingBottom,
            roomBelow:
              document.documentElement.scrollHeight - box.bottom - scrollY,
          };
        })
    );
    yield* Effect.sync(() =>
      expect(edges).toMatchObject({
        firstGap: 0,
        firstSpacing: "24px",
        lastGap: 0,
        lastSpacing: "24px",
      })
    );
    yield* Effect.sync(() =>
      expect(edges.roomBelow).toBeGreaterThanOrEqual(80)
    );
  }
);

test.describe("Quran index", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test("fills its card from edge to edge", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyQuranIndexEdges(page))
    );
  });
});

test.describe("Quran layout stability", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("renders surahs without layout shift", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyQuranLayoutStability(page))
    );
  });
});
