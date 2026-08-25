import { instant } from "@next/playwright";
import { expect, type Locator, type Page } from "@playwright/test";
import { Duration, Effect, Schedule, Schema } from "effect";
import { prepareClientNavigation } from "./readiness";

const HOMEPAGE_HEADING_PATTERN = /Learn until it clicks/i;
const QURAN_HEADING_PATTERN = /Al-Baqara/i;
const TRYOUT_TITLE_PATTERN = /Try out/i;
const CURRICULUM_HREF_PATTERN = /^\/en\/curriculum\/[^/]+\/[^/]+\/[^/.]+$/;
const ARTICLE_CATEGORY_HREF_PATTERN = /^\/en\/articles\/[^/.]+$/;
const ARTICLE_HREF_PATTERN = /^\/en\/articles\/[^/]+\/[^/.]+$/;
const MATERIAL_HREF_PATTERN = /^\/en\/subjects\/[^/]+\/[^/]+\/[^/.]+$/;
const LINK_POLL_MILLISECONDS = 100;
const NAVIGATION_TIMEOUT_MILLISECONDS = 15_000;

const linkedHrefRetrySchedule = Schedule.spaced(
  Duration.millis(LINK_POLL_MILLISECONDS)
).pipe(
  Schedule.upTo({
    duration: Duration.millis(NAVIGATION_TIMEOUT_MILLISECONDS),
  })
);

type InstantMarker =
  | { readonly kind: "heading"; readonly text?: RegExp }
  | { readonly kind: "title"; readonly text: RegExp };

/** A rendered source route has no visible link matching its signed catalog. */
export class NavigationLinkMissing extends Schema.TaggedError<NavigationLinkMissing>()(
  "NavigationLinkMissing",
  {
    hrefPattern: Schema.String,
    sourceHref: Schema.String,
  }
) {
  get message() {
    return `No visible link matching ${this.hrefPattern} was found on ${this.sourceHref}.`;
  }
}

export interface NavigationTarget {
  readonly href: string;
  readonly marker: InstantMarker;
  readonly name: string;
  readonly sourceHref: string;
}

export interface NavigationCase {
  readonly name: string;
  readonly resolve: (
    page: Page
  ) => Effect.Effect<NavigationTarget, NavigationLinkMissing>;
}

const assertSettledNavigation = Effect.fn("NakafaE2E.assertSettledNavigation")(
  function* (page: Page, target: NavigationTarget) {
    yield* Effect.promise(() =>
      expect(page).toHaveURL((url) => url.pathname === target.href, {
        timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
      })
    );

    if (target.marker.kind === "title") {
      const titleText = target.marker.text;
      yield* Effect.promise(() =>
        expect(page).toHaveTitle(titleText, {
          timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
        })
      );
      return;
    }

    const markerText = target.marker.text;
    const heading = markerText
      ? page.locator("h1:visible").filter({ hasText: markerText }).first()
      : page.locator("h1:visible").first();
    yield* Effect.promise(() =>
      expect(heading).toBeVisible({
        timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
      })
    );
    if (markerText) {
      yield* Effect.promise(() => expect(heading).toContainText(markerText));
    }
  }
);

const requireVisibleLocator = Effect.fn("NakafaE2E.requireVisibleLocator")(
  function* (locator: Locator, failure: NavigationLinkMissing) {
    const isVisible = yield* Effect.promise(() => locator.isVisible());
    if (!isVisible) {
      return yield* failure;
    }
    return locator;
  }
);

const waitForVisibleLocator = Effect.fn("NakafaE2E.waitForVisibleLocator")(
  (locator: Locator, failure: NavigationLinkMissing) =>
    requireVisibleLocator(locator, failure).pipe(
      Effect.retry(linkedHrefRetrySchedule)
    )
);

const findVisibleLink = Effect.fn("NakafaE2E.findVisibleLink")(function* (
  page: Page,
  href: string,
  sourceHref: string
) {
  const link = page.locator(`a[href="${href}"]:visible`).first();
  const missingLink = new NavigationLinkMissing({
    hrefPattern: href,
    sourceHref,
  });
  const linkIsVisible = yield* Effect.promise(() => link.isVisible());
  if (linkIsVisible) {
    return link;
  }
  if (href !== "/en") {
    return yield* waitForVisibleLocator(link, missingLink);
  }

  const sidebarTrigger = page
    .locator('[data-slot="sidebar-trigger"]:visible')
    .first();
  const sidebarTriggerIsVisible = yield* Effect.promise(() =>
    sidebarTrigger.isVisible()
  );
  if (!sidebarTriggerIsVisible) {
    return yield* waitForVisibleLocator(link, missingLink);
  }
  yield* Effect.promise(() =>
    sidebarTrigger.click({ timeout: NAVIGATION_TIMEOUT_MILLISECONDS })
  );
  return yield* waitForVisibleLocator(link, missingLink);
});

const readVisibleLinkedHref = Effect.fn("NakafaE2E.readVisibleLinkedHref")(
  function* (page: Page, sourceHref: string, hrefPattern: RegExp) {
    const candidates = page.locator("a[href]");
    const candidateCount = yield* Effect.promise(() => candidates.count());

    for (let index = 0; index < candidateCount; index += 1) {
      const candidate = candidates.nth(index);
      const href = yield* Effect.promise(() => candidate.getAttribute("href"));
      if (!href) {
        continue;
      }
      if (!hrefPattern.test(href)) {
        continue;
      }
      const isVisible = yield* Effect.promise(() => candidate.isVisible());
      if (isVisible) {
        return href;
      }
    }

    return yield* new NavigationLinkMissing({
      hrefPattern: hrefPattern.source,
      sourceHref,
    });
  }
);

const discoverLinkedHref = Effect.fn("NakafaE2E.discoverLinkedHref")(function* (
  page: Page,
  sourceHref: string,
  hrefPattern: RegExp
) {
  const response = yield* Effect.promise(() =>
    page.goto(sourceHref, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));

  return yield* readVisibleLinkedHref(page, sourceHref, hrefPattern).pipe(
    Effect.retry(linkedHrefRetrySchedule)
  );
});

/**
 * The installed instant lock completes the target prefetch before navigation
 * and withholds dynamic data until its callback returns. The callback therefore
 * owns the shell assertion, while the Effect program verifies settled content
 * after release.
 *
 * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next/src/client/components/segment-cache/navigation.ts
 * @see https://github.com/vercel/next.js/blob/v16.3.2/packages/next-playwright/README.md
 */
const navigateHard = Effect.fn("NakafaE2E.navigateHard")(function* (
  page: Page,
  baseURL: string,
  target: NavigationTarget
) {
  // @next/playwright requires this callback to return its native Promise.
  // The surrounding operation remains one Effect run by the test boundary.
  yield* Effect.promise(() =>
    instant(
      page,
      () =>
        page
          .goto(target.href, { waitUntil: "domcontentloaded" })
          .then((response) => {
            expect(response?.ok()).toBe(true);
            return page.waitForURL((url) => url.pathname === target.href, {
              timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
            });
          })
          .then(() => {
            if (target.marker.kind === "title") {
              return expect(page).toHaveTitle(target.marker.text, {
                timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
              });
            }

            const markerText = target.marker.text;
            const heading = markerText
              ? page
                  .locator("h1:visible")
                  .filter({ hasText: markerText })
                  .first()
              : page.locator("h1:visible").first();
            return expect(heading)
              .toBeVisible({ timeout: NAVIGATION_TIMEOUT_MILLISECONDS })
              .then(() =>
                markerText
                  ? expect(heading).toContainText(markerText, {
                      timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
                    })
                  : undefined
              );
          }),
      { baseURL }
    )
  );
  yield* assertSettledNavigation(page, target);
});

const navigateClient = Effect.fn("NakafaE2E.navigateClient")(function* (
  page: Page,
  target: NavigationTarget,
  hasTouch: boolean
) {
  const link = yield* prepareClientNavigation(
    page,
    target.sourceHref,
    target.href,
    NAVIGATION_TIMEOUT_MILLISECONDS,
    () => findVisibleLink(page, target.href, target.sourceHref)
  );

  // @next/playwright owns this native Promise callback while its lock is held.
  yield* Effect.promise(() =>
    instant(page, () =>
      (hasTouch
        ? link.tap({ timeout: NAVIGATION_TIMEOUT_MILLISECONDS })
        : link.click({ timeout: NAVIGATION_TIMEOUT_MILLISECONDS })
      )
        .then(() =>
          page.waitForURL((url) => url.pathname === target.href, {
            timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
          })
        )
        .then(() => {
          if (target.marker.kind === "title") {
            return expect(page).toHaveTitle(target.marker.text, {
              timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
            });
          }

          const markerText = target.marker.text;
          const heading = markerText
            ? page.locator("h1:visible").filter({ hasText: markerText }).first()
            : page.locator("h1:visible").first();
          return expect(heading)
            .toBeVisible({ timeout: NAVIGATION_TIMEOUT_MILLISECONDS })
            .then(() =>
              markerText
                ? expect(heading).toContainText(markerText, {
                    timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
                  })
                : undefined
            );
        })
    )
  );
  yield* assertSettledNavigation(page, target);
});

export const verifyHardAndClientNavigation = Effect.fn(
  "NakafaE2E.verifyHardAndClientNavigation"
)(function* (
  page: Page,
  baseURL: string,
  target: NavigationTarget,
  hasTouch: boolean
) {
  yield* navigateHard(page, baseURL, target);
  yield* navigateClient(page, target, hasTouch);
});

const resolveHomepage = Effect.fn("NakafaE2E.resolveHomepage")(() =>
  Effect.succeed({
    href: "/en",
    marker: { kind: "heading", text: HOMEPAGE_HEADING_PATTERN },
    name: "homepage",
    sourceHref: "/en/quran",
  } satisfies NavigationTarget)
);

const resolveQuran = Effect.fn("NakafaE2E.resolveQuran")(() =>
  Effect.succeed({
    href: "/id/quran/2",
    marker: { kind: "heading", text: QURAN_HEADING_PATTERN },
    name: "Quran",
    sourceHref: "/id/quran",
  } satisfies NavigationTarget)
);

const resolveTryout = Effect.fn("NakafaE2E.resolveTryout")(() =>
  Effect.succeed({
    href: "/en/try-out",
    marker: { kind: "title", text: TRYOUT_TITLE_PATTERN },
    name: "tryout",
    sourceHref: "/en",
  } satisfies NavigationTarget)
);

const resolveCurriculum = Effect.fn("NakafaE2E.resolveCurriculum")(function* (
  page: Page
) {
  const sourceHref = "/en";
  const href = yield* discoverLinkedHref(
    page,
    sourceHref,
    CURRICULUM_HREF_PATTERN
  );
  return {
    href,
    marker: { kind: "heading" },
    name: "curriculum",
    sourceHref,
  } satisfies NavigationTarget;
});

const resolveArticle = Effect.fn("NakafaE2E.resolveArticle")(function* (
  page: Page
) {
  const categoryHref = yield* discoverLinkedHref(
    page,
    "/en/articles",
    ARTICLE_CATEGORY_HREF_PATTERN
  );
  const sourceHref = categoryHref;
  const href = yield* discoverLinkedHref(
    page,
    sourceHref,
    ARTICLE_HREF_PATTERN
  );
  return {
    href,
    marker: { kind: "heading" },
    name: "article",
    sourceHref,
  } satisfies NavigationTarget;
});

const resolveMaterial = Effect.fn("NakafaE2E.resolveMaterial")(function* (
  page: Page
) {
  const sourceHref = "/en";
  const href = yield* discoverLinkedHref(
    page,
    sourceHref,
    MATERIAL_HREF_PATTERN
  );
  return {
    href,
    marker: { kind: "heading" },
    name: "material",
    sourceHref,
  } satisfies NavigationTarget;
});

export const navigationCases = [
  { name: "homepage", resolve: resolveHomepage },
  { name: "Quran", resolve: resolveQuran },
  { name: "tryout", resolve: resolveTryout },
  { name: "curriculum", resolve: resolveCurriculum },
  { name: "article", resolve: resolveArticle },
  { name: "material", resolve: resolveMaterial },
] as const satisfies readonly NavigationCase[];
