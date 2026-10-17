import { expect, type Page, test } from "@playwright/test";
import en from "@repo/internationalization/dictionaries/en.json" with {
  type: "json",
};
import { Array as Arr, Effect, Order, Record as Rec } from "effect";
import {
  CROWD_HERD,
  CROWD_TYPING_EVERY,
} from "@/components/marketing/about/toys/herd";
import { activateUntilVisible } from "@/e2e/support/input";
import {
  measureMarketingPage,
  readFirstContributor,
} from "@/e2e/support/marketing";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  expectStablePricingAppShell,
  expectStablePricingTransition,
  observeStablePricingReload,
} from "@/e2e/support/pricing";
import { openRoute } from "@/e2e/support/route";
import { DRAWER_TITLE, MARKETING_PAGE } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, targetViewports } from "@/e2e/support/viewport";
import { contributors } from "@/lib/data/contributor";

/**
 * Each friend of the crowd is one animal drawn as an svg of 15 to 25 elements,
 * and every fourth friend also has a typing bubble of six elements. The ceilings
 * follow the friends that the section renders, read from the crowd's own
 * constants, so a new friend adds its share and a heavier drawing still breaks
 * the budget. The per-friend figures come from the trace snapshot of the home
 * page of commit d739c56bd6 on 17 October 2026: 18 friends, 5 of them typing,
 * 400 descendants, 73 non-SVG descendants, and 35,739 bytes once serialized,
 * which approximates the browser's outerHTML. The crowd's markup has since
 * changed without changing any element count, and the exact byte deltas are
 * added to the byte ceiling: the list became a labelled div with a role, which
 * adds 13 bytes to the fixed part, the English label is 13 bytes longer, also in
 * the fixed part, each friend's wrapper is a div rather than an li, which adds
 * two bytes per friend, and each typing bubble is hidden from assistive
 * technology, which adds 19 bytes per bubble. Each ceiling is about six percent
 * over its measure: a fixed part plus the friends and the bubbles.
 */
const COMMUNITY_MARGIN = 1.06;
const COMMUNITY_FRIENDS = CROWD_HERD.length;
const COMMUNITY_TYPING_FRIENDS = Math.ceil(
  COMMUNITY_FRIENDS / CROWD_TYPING_EVERY
);
const COMMUNITY_MAX_CHROME_DESCENDANTS = Math.ceil(
  COMMUNITY_MARGIN * (7 + 2 * COMMUNITY_FRIENDS + 6 * COMMUNITY_TYPING_FRIENDS)
);
const COMMUNITY_MAX_DESCENDANTS = Math.ceil(
  COMMUNITY_MARGIN *
    (11 + 20 * COMMUNITY_FRIENDS + 6 * COMMUNITY_TYPING_FRIENDS)
);
const COMMUNITY_MAX_HTML_BYTES = Math.ceil(
  COMMUNITY_MARGIN *
    (2743 + 1657 * COMMUNITY_FRIENDS + 667 * COMMUNITY_TYPING_FRIENDS)
);

/**
 * The homepage ceiling, derived. The 17 October trace of this page, with the
 * 18-friend crowd, counted 1,919 body elements outside the lesson section at the
 * touch viewport, and 2,685 in all. The lesson section's server markup holds its
 * chat and heading, 21 elements, and the window, 745: the 741 of its tabs and its
 * four cards from a static render, plus the four inert wrappers that hold each
 * card until its lab mounts. The window draws all four cards in one grid cell,
 * so it keeps one height through every tab, and only the open lab mounts. That
 * gives 2,685 (1,919 + 21 + 745), and six percent over it is 2,847.
 *
 * PLACEHOLDER: the window's 745 comes from a static render of its markup, not from
 * a browser. Each run records the measured count as an annotation, and the
 * orchestrator replaces this constant with that measure, rounded up with the same
 * margin.
 */
const HOMEPAGE_MAX_DESCENDANTS = 2847;
const PRICING_PATH_PATTERN = /\/id\/pricing$/;

/**
 * Records one measured count on the running test, so every run reports the number
 * that a ceiling of this file is derived from, even when the check passes.
 */
function recordMeasure(name: string, value: number) {
  const info = test.info();
  info.annotations = Arr.append(info.annotations, {
    description: String(value),
    type: name,
  });
}

const loadMarketingPage = Effect.fn("NakafaE2E.loadMarketingPage")(function* (
  page: Page,
  href: string
) {
  yield* openRoute(page, href, "denied");
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    readinessTimeoutMilliseconds
  );
  /**
   * Next.js may commit App Router history before React reveals a streamed route.
   * Keep the existing readiness budget attached to the visible route boundary.
   * @see https://nextjs.org/docs/app/getting-started/linking-and-navigating#streaming
   */
  yield* Effect.promise(() =>
    expect(page.locator(MARKETING_PAGE).filter({ visible: true })).toHaveCount(
      1,
      { timeout: readinessTimeoutMilliseconds }
    )
  );
});

const verifyMarketingSurface = Effect.fn("NakafaE2E.verifyMarketingSurface")(
  function* (page: Page) {
    yield* loadMarketingPage(page, "/en");
    const measurements = yield* measureMarketingPage(page);
    recordMeasure(
      "community-chrome-descendants",
      measurements.communityChromeDescendants
    );
    recordMeasure("community-descendants", measurements.communityDescendants);
    recordMeasure("community-html-bytes", measurements.communityHtmlBytes);
    recordMeasure("homepage-descendants", measurements.homepageDescendants);

    // The crowd is one picture to assistive technology: one named image, and no list of friends.
    const community = page.locator("#community");
    yield* Effect.promise(() =>
      expect(
        community.getByRole("img", { name: en.Landing["community-crowd"] })
      ).toHaveCount(1)
    );
    yield* Effect.promise(() =>
      expect(community.getByRole("listitem")).toHaveCount(0)
    );

    yield* Effect.sync(() => {
      expect(measurements.duplicateIds).toEqual([]);
      expect(measurements.missingFragmentReferences).toEqual([]);
      expect(measurements.communityChromeDescendants).toBeLessThanOrEqual(
        COMMUNITY_MAX_CHROME_DESCENDANTS
      );
      expect(measurements.communityDescendants).toBeLessThanOrEqual(
        COMMUNITY_MAX_DESCENDANTS
      );
      expect(measurements.communityHtmlBytes).toBeLessThanOrEqual(
        COMMUNITY_MAX_HTML_BYTES
      );
      expect(measurements.homepageDescendants).toBeLessThanOrEqual(
        HOMEPAGE_MAX_DESCENDANTS
      );
    });
    yield* Effect.promise(() =>
      expect(page.locator('#faq [data-slot="accordion-trigger"]')).toHaveCount(
        10
      )
    );
  }
);

const verifyContributorPayloads = Effect.fn(
  "NakafaE2E.verifyContributorPayloads"
)(function* (page: Page) {
  yield* loadMarketingPage(page, "/en/contributor");
  const gallery = page.locator("[data-contributor-gallery]");
  const drawer = page.locator("[data-contributor-drawer]");
  const firstContributor = yield* readFirstContributor(contributors);
  const firstTrigger = gallery.locator(
    `[data-contributor-username="${firstContributor.username}"]`
  );

  // Opening and closing proves this detached client boundary is interactive
  // before the tooltip-specific hover and focus checks begin.
  yield* Effect.promise(() => firstTrigger.click());
  yield* Effect.promise(() => expect(drawer).toHaveCount(1));
  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(drawer).toHaveCount(0));
  yield* Effect.promise(() => expect(firstTrigger).toBeFocused());
  // Closing the drawer can scroll a different trigger under the last click.
  // Remove pointer ownership before verifying the focused tooltip contract.
  yield* Effect.promise(() => page.mouse.move(0, 0));
  yield* Effect.promise(() => page.keyboard.press("Tab"));
  yield* Effect.promise(() => page.keyboard.press("Shift+Tab"));
  yield* Effect.promise(() => expect(firstTrigger).toBeFocused());
  // Base UI 1.7 describes Tooltip as a visual hint and its Popup renders a
  // div without a tooltip role. The trigger's aria-label owns its identity.
  // @see https://base-ui.com/react/components/tooltip
  const tooltip = page.locator(
    '[data-slot="tooltip-content"][data-open]:not([data-starting-style]):not([data-ending-style])'
  );
  yield* Effect.promise(() =>
    expect(tooltip).toHaveText(firstContributor.name)
  );
  yield* Effect.promise(() => expect(tooltip).toBeVisible());
  yield* Effect.promise(() => page.keyboard.press("Escape"));
  yield* Effect.promise(() => expect(tooltip).toHaveCount(0));
  yield* Effect.promise(() => page.mouse.move(0, 0));
  yield* Effect.promise(() => firstTrigger.hover());
  yield* Effect.promise(() =>
    expect(tooltip).toHaveText(firstContributor.name)
  );
  yield* Effect.promise(() => expect(tooltip).toBeVisible());
  yield* Effect.promise(() => page.mouse.move(0, 0));
  yield* Effect.promise(() => expect(tooltip).toHaveCount(0));

  for (const contributor of contributors) {
    const trigger = gallery.locator(
      `[data-contributor-username="${contributor.username}"]`
    );
    yield* Effect.promise(() => trigger.click());
    yield* Effect.promise(() => expect(drawer).toHaveCount(1));
    yield* Effect.promise(() =>
      expect(drawer).toHaveAttribute(
        "data-contributor-username",
        contributor.username
      )
    );
    yield* Effect.promise(() =>
      expect(drawer.locator(DRAWER_TITLE)).toHaveText(contributor.name)
    );
    yield* Effect.promise(() =>
      expect(drawer).toHaveAccessibleName(contributor.name)
    );

    const actualSocialLinks = yield* Effect.promise(() =>
      drawer
        .locator('a[target="_blank"]')
        .evaluateAll((links) =>
          links.map((link) => link.getAttribute("href")).sort()
        )
    );
    const expectedSocialLinks = Arr.sort(
      Arr.filter(
        Rec.values<string, string | undefined>(contributor.social ?? {}),
        (href): href is string => href !== undefined
      ),
      Order.String
    );
    yield* Effect.sync(() =>
      expect(actualSocialLinks).toEqual(expectedSocialLinks)
    );

    yield* Effect.promise(() => page.keyboard.press("Escape"));
    yield* Effect.promise(() => expect(drawer).toHaveCount(0));
    yield* Effect.promise(() => expect(trigger).toBeFocused());
  }
});

const verifyContributorPage = Effect.fn("NakafaE2E.verifyContributorPage")(
  function* (page: Page) {
    yield* loadMarketingPage(page, "/en/contributor");
    const gallery = page.locator("[data-contributor-gallery]");
    const triggers = gallery.locator("[data-contributor-username]");
    yield* Effect.promise(() => expect(gallery).toHaveCount(1));
    yield* Effect.promise(() =>
      expect(triggers).toHaveCount(contributors.length)
    );
    const lastTrigger = triggers.last();
    yield* Effect.promise(() => expect(lastTrigger).toBeVisible());
    yield* Effect.promise(() => expect(lastTrigger).toBeEnabled());
    yield* Effect.promise(() => lastTrigger.press("Enter"));
    yield* Effect.promise(() =>
      expect(page.locator("[data-contributor-drawer]")).toHaveCount(1)
    );
  }
);

const verifyPricingPage = Effect.fn("NakafaE2E.verifyPricingPage")(function* (
  page: Page
) {
  yield* loadMarketingPage(page, "/en/pricing");
  yield* Effect.promise(() =>
    expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Start with Free. Move to Pro when you are ready."
    )
  );
  yield* Effect.promise(() =>
    expect(page.getByRole("heading", { level: 2, name: "Free" })).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(page.getByRole("heading", { level: 2, name: "Pro" })).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(
      page.getByRole("region", {
        name: "Start with Free. Move to Pro when you are ready.",
      })
    ).toContainText("3,000 AI credits")
  );
  yield* Effect.promise(() =>
    expect(page.getByRole("button", { name: "Get Pro" })).toBeEnabled()
  );
  yield* Effect.promise(() =>
    expect(page.locator("[data-pricing-plan]")).toHaveCount(2)
  );
  yield* Effect.promise(() =>
    expect(page.locator("[data-pricing-price-slot]")).toHaveCount(2)
  );
  yield* Effect.promise(() =>
    expect(page.locator("[data-pricing-price-fallback]")).toHaveCount(0)
  );

  const pricingQuestions = page.locator('#faq [data-slot="accordion-trigger"]');
  yield* Effect.promise(() => expect(pricingQuestions).toHaveCount(20));

  const productQuestion = pricingQuestions.filter({
    hasText: "What can I learn on Nakafa?",
  });
  const productItem = page
    .locator('#faq [data-slot="accordion-item"]')
    .filter({ hasText: "What can I learn on Nakafa?" });
  const productPanel = productItem.locator('[data-slot="accordion-content"]');
  yield* Effect.promise(() => productQuestion.click());
  yield* Effect.promise(() =>
    expect(productQuestion).toHaveAttribute("aria-expanded", "true")
  );
  yield* Effect.promise(() =>
    expect(productPanel).toHaveAttribute("data-open", "")
  );
  yield* Effect.promise(() =>
    expect(productPanel).toHaveCSS("animation-name", "accordion-down")
  );
  yield* Effect.promise(() =>
    expect(productPanel).toHaveCSS("animation-duration", "0.18s")
  );
  yield* Effect.promise(() =>
    expect(productQuestion.locator("svg")).toHaveCSS("rotate", "180deg")
  );
  yield* Effect.promise(() =>
    expect(productQuestion.locator("svg")).toHaveCSS(
      "transition-duration",
      "0.18s"
    )
  );
  yield* Effect.promise(() =>
    expect(page.locator("#faq")).toContainText(
      "primary school through university"
    )
  );

  const subscriptionQuestion = pricingQuestions.filter({
    hasText: "How do I manage or cancel Pro?",
  });
  yield* Effect.promise(() => subscriptionQuestion.click());
  yield* Effect.promise(() =>
    expect(page.locator("#faq")).toContainText(
      "manage or cancel your subscription"
    )
  );
  yield* Effect.promise(() =>
    expect(page.locator('header nav [href="/en/pricing"]')).toHaveText(
      "Pricing"
    )
  );
  yield* Effect.promise(() =>
    expect(page.locator('header nav [href="/en/pricing"]')).toHaveAttribute(
      "aria-current",
      "page"
    )
  );
});

const verifyPricingNavigation = Effect.fn("NakafaE2E.verifyPricingNavigation")(
  function* (page: Page) {
    yield* expectStablePricingAppShell(page);
    yield* loadMarketingPage(page, "/id");

    const pricingLink = page.locator('header nav [href="/id/pricing"]');
    yield* Effect.promise(() => expect(pricingLink).toHaveText("Harga"));
    yield* Effect.promise(() => pricingLink.click());
    yield* Effect.promise(() =>
      expect(page).toHaveURL(PRICING_PATH_PATTERN, {
        timeout: readinessTimeoutMilliseconds,
      })
    );
    yield* Effect.promise(() =>
      expect(page.locator("[data-pricing-plan]:visible")).toHaveCount(2)
    );
    yield* Effect.promise(() =>
      expect(page.locator("[data-pricing-price-fallback]")).toHaveCount(0)
    );

    const observation = yield* observeStablePricingReload(
      page,
      readinessTimeoutMilliseconds
    );
    yield* Effect.sync(() => expectStablePricingTransition(observation));
  }
);

for (const viewport of targetViewports) {
  test.describe(`marketing surfaces at ${viewport.name}`, () => {
    test.use({
      hasTouch: viewport.hasTouch,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("preserves one responsive content tree and project DOM budgets", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyMarketingSurface(page))
      );
    });
  });
}

test.describe("detached contributor payloads", () => {
  test.use({
    viewport: {
      height: desktopViewport.height,
      width: desktopViewport.width,
    },
  });

  test("renders every contributor through one drawer root", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyContributorPayloads(page))
    );
  });

  test("uses the same one-root gallery on the contributor page", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyContributorPage(page))
    );
  });
});

test.describe("dedicated pricing page", () => {
  test.use({
    viewport: {
      height: desktopViewport.height,
      width: desktopViewport.width,
    },
  });

  test("renders plans and pricing questions through the marketing shell", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyPricingPage(page))
    );
  });

  test("navigates from the header with a stable pricing shell", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyPricingNavigation(page))
    );
  });
});

const DARK_THEME_CLASS = /(^|\s)dark(\s|$)/;

test("the footer theme selector loads its list on demand and applies a theme", async ({
  page,
}) => {
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* openRoute(page, "/en", "denied");

        const selector = page
          .locator("footer")
          .getByRole("button", { exact: true, name: "Theme" });
        const dark = page.getByRole("menuitem", { exact: true, name: "Dark" });
        yield* Effect.promise(() => expect(dark).toHaveCount(0));
        yield* activateUntilVisible(
          selector,
          dark,
          readinessTimeoutMilliseconds
        );
        yield* Effect.promise(() => dark.click());
        yield* Effect.promise(() =>
          expect(page.locator("html")).toHaveClass(DARK_THEME_CLASS)
        );
      })
    )
  );
});
