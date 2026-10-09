import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, MutableList } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import {
  openObservedRoute,
  openPrefetched,
  readPathname,
} from "@/e2e/support/navigation/prefetch";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { paginationNavigation } from "@/e2e/support/selector";
import { desktopViewport, touchViewport } from "@/e2e/support/viewport";

const lessonHref = pinnedRoutes.material.en;
const articleHref = pinnedRoutes.article.en;
const articleCategoryHref = articleHref.slice(0, articleHref.lastIndexOf("/"));
const NEXT_LINK_PATTERN = /^Next/;
const PREVIOUS_LINK_PATTERN = /^Previous/;

const viewports = [desktopViewport, touchViewport] as const;

const paginationLink = (page: Page, name: RegExp) =>
  paginationNavigation(page).getByRole("link", { name });

/**
 * A first visit opens the usage-data prompt. Its privacy link must never
 * prefetch, because a prefetched signed Page makes the client router read
 * every lesson URL as a Page, and the next lesson must still come from the
 * Next link's own prefetch.
 */
const verifyNextLesson = Effect.fn("NakafaE2E.verifyNextLesson")(function* (
  page: Page,
  hasTouch: boolean
) {
  const requested = MutableList.make<string>();
  yield* Effect.sync(() =>
    page.on("request", (request) => {
      if (request.headers().rsc === "1") {
        MutableList.append(requested, new URL(request.url()).pathname);
      }
    })
  );
  yield* openObservedRoute(page, lessonHref);
  const prompt = page.getByRole("region", { name: "Usage data" });
  const privacyPathname = yield* readPathname(
    prompt.getByRole("link", { name: "Privacy Policy" })
  );
  yield* Effect.promise(() =>
    prompt.getByRole("button", { name: "Decline" }).click()
  );
  yield* Effect.promise(() => expect(prompt).toBeHidden());
  yield* openPrefetched(
    page,
    paginationLink(page, NEXT_LINK_PATTERN),
    hasTouch
  );
  yield* Effect.sync(() =>
    expect(Arr.contains(MutableList.toArray(requested), privacyPathname)).toBe(
      false
    )
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
