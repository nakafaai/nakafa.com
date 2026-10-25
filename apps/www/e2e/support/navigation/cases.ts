import { expect, type Locator, type Page } from "@playwright/test";
import { TAILWIND_MEDIA_QUERIES } from "@repo/design-system/lib/breakpoints";
import {
  Array as Arr,
  Duration,
  Effect,
  Option,
  Schedule,
  Schema,
} from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { activateUntilVisible, press } from "@/e2e/support/input";
import { pressPreloaded } from "@/e2e/support/navigation/prefetch";
import { prepareClientNavigation } from "@/e2e/support/navigation/readiness";
import { appRoutes } from "@/e2e/support/route";
import {
  MARKETING_PAGE,
  VISIBLE_SIDEBAR_TRIGGER,
} from "@/e2e/support/selector";
import { observeShell } from "@/e2e/support/shell";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

const HOMEPAGE_HEADING_PATTERN = /Learn until it clicks/i;
const QURAN_HEADING_PATTERN = /Al-Baqara/i;
const TRYOUT_TITLE_PATTERN = /Try out/i;
const CURRICULUM_HREF_PATTERN = /^\/en\/curriculum\/[^/]+\/[^/]+\/[^/.]+$/;
const ARTICLE_CATEGORY_HREF_PATTERN = /^\/en\/articles\/[^/.]+$/;
const ARTICLE_HREF_PATTERN = /^\/en\/articles\/[^/]+\/[^/.]+$/;
const MATERIAL_HREF_PATTERN = /^\/en\/subjects\/[^/]+\/[^/]+\/[^/.]+$/;
const LINK_POLL_MILLISECONDS = 100;
// Navigation keeps its own budget, so it can change apart from readiness.
const NAVIGATION_TIMEOUT_MILLISECONDS = readinessTimeoutMilliseconds;

const linkedHrefRetrySchedule = Schedule.spaced(
  Duration.millis(LINK_POLL_MILLISECONDS)
).pipe(
  Schedule.upTo({
    duration: Duration.millis(NAVIGATION_TIMEOUT_MILLISECONDS),
  })
);

const InstantMarkerSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("heading"),
    text: Schema.optionalKey(Schema.RegExp),
  }),
  Schema.Struct({
    kind: Schema.Literal("title"),
    text: Schema.RegExp,
  }),
]);

const InstantShellSchema = Schema.Literals(["app", "marketing"]);

const instantShellSelector = {
  app: 'main[data-slot="sidebar-inset"]:visible',
  marketing: `${MARKETING_PAGE}:visible`,
} as const;

/** A rendered source route has no visible link matching its signed catalog. */
class NavigationLinkMissing extends Schema.TaggedError<NavigationLinkMissing>()(
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

const NavigationTargetSchema = Schema.Struct({
  href: Schema.String,
  marker: InstantMarkerSchema,
  name: Schema.String,
  shell: InstantShellSchema,
  sourceHref: Schema.String,
  /** The shell of the page the reader starts from. */
  sourceShell: InstantShellSchema,
});

type NavigationTarget = typeof NavigationTargetSchema.Type;

/** Finds the target of one navigation case from the page that starts it. */
type NavigationResolve = (
  page: Page
) => Effect.Effect<NavigationTarget, NavigationLinkMissing>;

/** Waits for the destination's own marker: the heading or the title its content brings. */
function expectMarker(page: Page, marker: NavigationTarget["marker"]) {
  if (marker.kind === "title") {
    return expect(page).toHaveTitle(marker.text, {
      timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
    });
  }
  const headings = page.locator("h1:visible");
  const heading = marker.text
    ? headings.filter({ hasText: marker.text }).first()
    : headings.first();
  return expect(heading).toBeVisible({
    timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
  });
}

const assertSettledNavigation = Effect.fn("NakafaE2E.assertSettledNavigation")(
  function* (page: Page, target: NavigationTarget) {
    yield* Effect.promise(() =>
      expect(page).toHaveURL((url) => url.pathname === target.href, {
        timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
      })
    );
    yield* Effect.promise(() => expectMarker(page, target.marker));
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

  const usesMobileSidebar = yield* Effect.promise(() =>
    page.evaluate(
      (mediaQuery) => window.matchMedia(mediaQuery).matches,
      TAILWIND_MEDIA_QUERIES.belowLg
    )
  );
  if (!usesMobileSidebar) {
    return yield* waitForVisibleLocator(link, missingLink);
  }

  const sidebarTrigger = page.locator(VISIBLE_SIDEBAR_TRIGGER).first();
  yield* waitForVisibleLocator(sidebarTrigger, missingLink);
  return yield* activateUntilVisible(
    sidebarTrigger,
    link,
    NAVIGATION_TIMEOUT_MILLISECONDS
  );
});

const readVisibleLinkedHref = Effect.fn("NakafaE2E.readVisibleLinkedHref")(
  function* (
    page: Page,
    sourceHref: string,
    hrefPattern: RegExp,
    skipHref?: string
  ) {
    // One read of every link's address and visibility, so a page with hundreds
    // of links costs one round trip instead of two per link.
    const links = yield* Effect.promise(() =>
      page.locator("a[href]").evaluateAll((nodes) =>
        nodes.map((node) => ({
          href: node.getAttribute("href") ?? "",
          visible: node.checkVisibility(),
        }))
      )
    );
    const found = Arr.findFirst(
      links,
      ({ href, visible }) =>
        visible && href !== "" && href !== skipHref && hrefPattern.test(href)
    );
    if (Option.isSome(found)) {
      return found.value.href;
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
  hrefPattern: RegExp,
  skipHref?: string
) {
  const response = yield* Effect.promise(() =>
    page.goto(sourceHref, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));

  return yield* readVisibleLinkedHref(
    page,
    sourceHref,
    hrefPattern,
    skipHref
  ).pipe(Effect.retry(linkedHrefRetrySchedule));
});

/**
 * Loads the destination by a hard navigation, then checks its settled page.
 * The shell and the destination's own marker must show on the document.
 */
const navigateHard = Effect.fn("NakafaE2E.navigateHard")(function* (
  page: Page,
  target: NavigationTarget
) {
  yield* Effect.promise(() =>
    page
      .goto(target.href, { waitUntil: "domcontentloaded" })
      .then((response) => {
        expect(response?.ok()).toBe(true);
        return page.waitForURL((url) => url.pathname === target.href, {
          timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
        });
      })
      .then(() => {
        const shell = page.locator(instantShellSelector[target.shell]);
        return expect(shell).toBeVisible({
          timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
        });
      })
      .then(() => expectMarker(page, target.marker))
  );
  yield* assertSettledNavigation(page, target);
});

/**
 * Opens the destination from a link that the reader showed intent toward, with
 * the contract of `pressPreloaded`: the press shows the destination's shell and
 * marker, makes no data request, and keeps the shell on every frame.
 */
const navigateClient = Effect.fn("NakafaE2E.navigateClient")(function* (
  page: Page,
  target: NavigationTarget,
  hasTouch: boolean
) {
  // The frame recorder must be in place before the source document loads.
  yield* observeShell(page);
  const link = yield* prepareClientNavigation(
    page,
    target.sourceHref,
    target.href,
    NAVIGATION_TIMEOUT_MILLISECONDS,
    () => findVisibleLink(page, target.href, target.sourceHref)
  );

  yield* pressPreloaded(
    page,
    link,
    hasTouch,
    Effect.promise(() =>
      press(link, hasTouch, {
        noWaitAfter: true,
        timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
      })
    ),
    Effect.promise(() =>
      page
        .waitForURL((url) => url.pathname === target.href, {
          timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
        })
        .then(() => {
          const shell = page.locator(instantShellSelector[target.shell]);
          return expect(shell).toBeVisible({
            timeout: NAVIGATION_TIMEOUT_MILLISECONDS,
          });
        })
        .then(() => expectMarker(page, target.marker))
    ),
    target.sourceShell === target.shell ? 1 : 2
  );
  yield* assertSettledNavigation(page, target);
});

/** Checks one destination from a hard navigation and from a preloaded client navigation. */
export const verifyHardAndClientNavigation = Effect.fn(
  "NakafaE2E.verifyHardAndClientNavigation"
)(function* (page: Page, target: NavigationTarget, hasTouch: boolean) {
  yield* navigateHard(page, target);
  yield* navigateClient(page, target, hasTouch);
});

const resolveHomepage: NavigationResolve = Effect.fn(
  "NakafaE2E.resolveHomepage"
)(() =>
  Effect.succeed({
    href: "/en",
    marker: { kind: "heading", text: HOMEPAGE_HEADING_PATTERN },
    name: "homepage",
    shell: "marketing",
    sourceHref: appRoutes.quran,
    sourceShell: "app",
  } satisfies NavigationTarget)
);

const resolveQuran: NavigationResolve = Effect.fn("NakafaE2E.resolveQuran")(
  () =>
    Effect.succeed({
      href: appRoutes.quranSurahId,
      marker: { kind: "heading", text: QURAN_HEADING_PATTERN },
      name: "Quran",
      shell: "app",
      sourceHref: appRoutes.quranId,
      sourceShell: "app",
    } satisfies NavigationTarget)
);

const resolveTryout: NavigationResolve = Effect.fn("NakafaE2E.resolveTryout")(
  () =>
    Effect.succeed({
      href: appRoutes.tryout,
      marker: { kind: "title", text: TRYOUT_TITLE_PATTERN },
      name: "tryout",
      shell: "app",
      sourceHref: "/en",
      sourceShell: "marketing",
    } satisfies NavigationTarget)
);

const resolveCurriculum: NavigationResolve = Effect.fn(
  "NakafaE2E.resolveCurriculum"
)(function* (page: Page) {
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
    shell: "app",
    sourceHref,
    sourceShell: "marketing",
  } satisfies NavigationTarget;
});

const resolveArticle: NavigationResolve = Effect.fn("NakafaE2E.resolveArticle")(
  function* (page: Page) {
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
      shell: "app",
      sourceHref,
      sourceShell: "app",
    } satisfies NavigationTarget;
  }
);

/**
 * The homepage links curriculums rather than lessons, so the material case
 * starts from the lesson the acceptance corpus pins.
 */
const resolveMaterial: NavigationResolve = Effect.fn(
  "NakafaE2E.resolveMaterial"
)(function* (page: Page) {
  const sourceHref = pinnedRoutes.material.en;
  const href = yield* discoverLinkedHref(
    page,
    sourceHref,
    MATERIAL_HREF_PATTERN,
    sourceHref
  );
  return {
    href,
    marker: { kind: "heading" },
    name: "material",
    shell: "app",
    sourceHref,
    sourceShell: "app",
  } satisfies NavigationTarget;
});

export const navigationCases = [
  { name: "homepage", resolve: resolveHomepage },
  { name: "Quran", resolve: resolveQuran },
  { name: "tryout", resolve: resolveTryout },
  { name: "curriculum", resolve: resolveCurriculum },
  { name: "article", resolve: resolveArticle },
  { name: "material", resolve: resolveMaterial },
] as const;
