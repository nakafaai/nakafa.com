import { instant } from "@next/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { Array as Arr, Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import {
  observeShell,
  readPageTime,
  readShellObservation,
} from "@/e2e/support/shell";

const readinessTimeoutMilliseconds = 15_000;
const lessonHref = pinnedRoutes.material.en;
const articleHref = pinnedRoutes.article.en;
const articleCategoryHref = articleHref.slice(0, articleHref.lastIndexOf("/"));
const NEXT_LINK_PATTERN = /^Next/;

const viewports = [
  { hasTouch: false, height: 900, name: "desktop", width: 1440 },
  { hasTouch: true, height: 844, name: "touch", width: 390 },
] as const;

/** Loads `href` with the frame recorder running and its router hydrated. */
const open = Effect.fn("NakafaE2E.openObservedRoute")(function* (
  page: Page,
  href: string
) {
  yield* observeShell(page);
  yield* Effect.promise(() =>
    page.goto(href, { waitUntil: "domcontentloaded" })
  );
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );
});

/** Reads the path a link opens. */
const readPathname = Effect.fn("NakafaE2E.readLinkPathname")(function* (
  link: Locator
) {
  const href = yield* Effect.promise(() => link.getAttribute("href")).pipe(
    Effect.flatMap(Effect.fromNullishOr)
  );
  return new URL(href, "https://nakafa.com").pathname;
});

/**
 * Opens `link` while Next.js holds back everything a prefetch did not load, so
 * the destination's heading and article have to come from the link's own
 * prefetch. A touch press taps; otherwise the link is focused, the keyboard's
 * sign of intent, and opened with Enter. Every frame from the press on must
 * show the one app shell and a page heading: first the current page's, then
 * the destination's, with no empty frame between them.
 */
const openPrefetched = Effect.fn("NakafaE2E.openPrefetched")(function* (
  page: Page,
  link: Locator,
  hasTouch: boolean
) {
  const pathname = yield* readPathname(link);
  const heading = page.getByRole("heading", { level: 1 });
  const source = yield* Effect.promise(() => heading.innerText());
  yield* Effect.promise(() => link.scrollIntoViewIfNeeded());
  const since = yield* readPageTime(page);
  // @next/playwright owns this native Promise callback while its lock is held.
  yield* Effect.promise(() =>
    instant(page, () =>
      (hasTouch
        ? link.tap({ noWaitAfter: true })
        : link.focus().then(() => link.press("Enter", { noWaitAfter: true }))
      )
        .then(() =>
          page.waitForURL((url) => url.pathname === pathname, {
            timeout: readinessTimeoutMilliseconds,
          })
        )
        .then(() =>
          expect(heading).toHaveCount(1, {
            timeout: readinessTimeoutMilliseconds,
          })
        )
        .then(() => expect(heading).not.toHaveText(source))
        .then(() =>
          expect(page.getByRole("article").locator("p").first()).toBeVisible({
            timeout: readinessTimeoutMilliseconds,
          })
        )
    )
  );
  const observation = yield* readShellObservation(page, since);
  yield* Effect.sync(() => {
    expect(observation.frames).toBeGreaterThan(0);
    expect(observation.hiddenFrames).toBe(0);
    expect(observation.headinglessFrames).toBe(0);
    expect(observation.shells).toBe(1);
  });
});

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
  const requested: string[] = [];
  yield* Effect.sync(() =>
    page.on("request", (request) => {
      if (request.headers().rsc === "1") {
        requested.push(new URL(request.url()).pathname);
      }
    })
  );
  yield* open(page, lessonHref);
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
    page
      .getByRole("navigation", { name: "Pagination navigation" })
      .getByRole("link", { name: NEXT_LINK_PATTERN }),
    hasTouch
  );
  yield* Effect.sync(() =>
    expect(Arr.contains(requested, privacyPathname)).toBe(false)
  );
});

/** An article card loads its article once the reader shows intent. */
const verifyArticleCard = Effect.fn("NakafaE2E.verifyArticleCard")(function* (
  page: Page,
  hasTouch: boolean
) {
  yield* seedDeniedAnalyticsConsent(page);
  yield* open(page, articleCategoryHref);
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
  yield* seedDeniedAnalyticsConsent(page);
  yield* open(page, lessonHref);
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
