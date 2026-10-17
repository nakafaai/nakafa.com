import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, Order, Record as Rec } from "effect";
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
 * The community section, measured in the browser on 14 October 2026 with its
 * gallery of 16 contributors at every target viewport, the same at each: 74
 * non-SVG descendants, 340 descendants, and 39,335 bytes. The ceilings leave
 * about six percent room over that measure.
 *
 * The crowd draws 16 friends, the same count: each one an animal drawn as an svg
 * of 14 to 24 elements inside its list item, and each friend whose index is a
 * multiple of CROWD_TYPING_EVERY has a typing bubble of six elements. Counting
 * the section's server markup gives 63 non-SVG descendants, 346 descendants, and
 * 30,798 bytes. The same count gives 400 descendants for the 18-friend crowd of
 * commit d739c56bd6, which the 17 October browser trace measured, so the count
 * matches the browser.
 */
const COMMUNITY_MAX_CHROME_DESCENDANTS = 79;
const COMMUNITY_MAX_DESCENDANTS = 361;
const COMMUNITY_MAX_HTML_BYTES = 41_700;

/**
 * The homepage ceiling. The 17 October traces of this page with the 18-friend
 * crowd counted at most 2,685 body elements, at the touch viewport. The 16-friend
 * crowd renders 54 fewer (400 community descendants against 346), so the measure
 * is 2,631, and six percent over it is 2,789.
 */
const HOMEPAGE_MAX_DESCENDANTS = 2789;
const PRICING_PATH_PATTERN = /\/id\/pricing$/;

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
