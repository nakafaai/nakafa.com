import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import {
  openObservedRoute,
  openPrefetched,
} from "@/e2e/support/navigation/prefetch";
import { settleRouter } from "@/e2e/support/navigation/settle";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { recordServerFunctionCalls } from "@/e2e/support/requests";
import { paginationNavigation } from "@/e2e/support/selector";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

const lessonHref = pinnedRoutes.material.en;
const articleHref = pinnedRoutes.article.en;
const articleCategoryHref = articleHref.slice(0, articleHref.lastIndexOf("/"));
const FORWARD_LINK_PATTERN = /^Next/;
const PREVIOUS_LINK_PATTERN = /^Previous/;

const viewports = [desktopViewport, touchViewport] as const;

const paginationLink = (page: Page, name: RegExp) =>
  paginationNavigation(page).getByRole("link", { name });

/**
 * A first visit opens the usage-data prompt. Intent over its privacy link must
 * not preload the page it opens, and the next lesson must still come from its
 * own intent preload.
 */
const verifyNextLesson = Effect.fn("NakafaE2E.verifyNextLesson")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* openObservedRoute(page, lessonHref);
  const prompt = page.getByRole("region", { name: "Usage data" });
  const privacyLink = prompt.getByRole("link", { name: "Privacy Policy" });
  const dataCalls = recordServerFunctionCalls(page);
  yield* settleRouter(
    page,
    Effect.promise(() => privacyLink.hover())
  );
  yield* Effect.sync(() => expect(dataCalls.length).toBe(0));
  yield* Effect.promise(() =>
    prompt.getByRole("button", { name: "Decline" }).click()
  );
  yield* Effect.promise(() => expect(prompt).toBeHidden());
  yield* openPrefetched(
    page,
    paginationLink(page, FORWARD_LINK_PATTERN),
    hasTouch
  );
});

/** Previous waits for intent, and its page must paint from that prefetch. */
const verifyPreviousLesson = Effect.fn("NakafaE2E.verifyPreviousLesson")(
  function* (page: Page, hasTouch: boolean) {
    yield* seedAnalyticsConsent(page, "denied");
    yield* openObservedRoute(page, lessonHref);
    yield* openPrefetched(
      page,
      paginationLink(page, PREVIOUS_LINK_PATTERN),
      hasTouch
    );
  }
);

/** An article card loads its article once the reader shows intent. */
const verifyArticleCard = Effect.fn("NakafaE2E.verifyArticleCard")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* openObservedRoute(page, articleCategoryHref);
  yield* openPrefetched(
    page,
    page.locator(`main a[href="${articleHref}"]`),
    hasTouch
  );
});

/** A link in a lesson's text loads the lesson it names once the reader shows intent. */
const verifyContentLink = Effect.fn("NakafaE2E.verifyContentLink")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* openObservedRoute(page, lessonHref);
  yield* openPrefetched(
    page,
    page
      .getByRole("article")
      .locator(`a[href^="/en/subjects/"]:not([href="${lessonHref}"])`)
      .first(),
    hasTouch
  );
});

for (const viewport of viewports) {
  test.describe(`Prefetched navigation on ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("the next lesson paints from its prefetch on a first visit", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyNextLesson(page, viewport.hasTouch))
      );
    });

    test("the previous lesson paints from its intent prefetch", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          verifyPreviousLesson(page, viewport.hasTouch)
        )
      );
    });

    test("an article card paints its article from the intent prefetch", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyArticleCard(page, viewport.hasTouch))
      );
    });

    test("a link in a lesson paints its lesson from the intent prefetch", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyContentLink(page, viewport.hasTouch))
      );
    });
  });
}
