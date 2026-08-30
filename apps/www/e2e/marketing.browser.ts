import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { withObservedPageErrors } from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";
import {
  legacyAvatarFragmentIds,
  measureMarketingPage,
  readFirstContributor,
  swipeContributorDrawer,
  verifyDesktopSplitter,
} from "@/e2e/support/marketing";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { contributors } from "@/lib/data/contributor";

/**
 * Raw Community markup is dominated by the 16 preserved vector Characters.
 * Protected #330 and the exact-head trace both measured 755 total descendants,
 * 220 non-SVG descendants, and about 210 KB. These ceilings leave about six
 * percent regression room without changing the visible avatar representation.
 */
const COMMUNITY_MAX_CHROME_DESCENDANTS = 235;
const COMMUNITY_MAX_DESCENDANTS = 800;
const COMMUNITY_MAX_HTML_BYTES = 223_000;
const HOMEPAGE_MAX_DESCENDANTS = 2800;
const READINESS_TIMEOUT_MILLISECONDS = 15_000;
const TRUST_MAX_DESCENDANTS = 330;
const TRUST_RESIZE_LABEL = "Resize the human and agent views";

const targetViewports = [
  { desktop: false, height: 800, name: "compact", width: 320 },
  {
    desktop: false,
    hasTouch: true,
    height: 844,
    name: "touch",
    width: 390,
  },
  { desktop: false, height: 1024, name: "tablet-portrait", width: 768 },
  { desktop: true, height: 768, name: "tablet-landscape", width: 1024 },
  { desktop: true, height: 900, name: "desktop", width: 1440 },
] as const;

type MarketingViewport = (typeof targetViewports)[number];

const loadMarketingPage = Effect.fn("NakafaE2E.loadMarketingPage")(function* (
  page: Page,
  href: string
) {
  yield* seedDeniedAnalyticsConsent(page);
  const response = yield* Effect.promise(() =>
    page.goto(href, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  yield* waitForCommittedAppRouter(
    page,
    href,
    href,
    READINESS_TIMEOUT_MILLISECONDS
  );
  /**
   * Next.js may commit App Router history before React reveals a streamed route.
   * Keep the existing readiness budget attached to the visible route boundary.
   * @see https://nextjs.org/docs/app/getting-started/linking-and-navigating#streaming
   */
  yield* Effect.promise(() =>
    expect(
      page.locator('main[data-marketing-page="true"]').filter({ visible: true })
    ).toHaveCount(1, { timeout: READINESS_TIMEOUT_MILLISECONDS })
  );
});

const verifyMarketingSurface = Effect.fn("NakafaE2E.verifyMarketingSurface")(
  function* (page: Page, viewport: MarketingViewport) {
    yield* loadMarketingPage(page, "/en");
    const measurements = yield* measureMarketingPage(page);

    yield* Effect.sync(() => {
      expect(measurements.unexpectedDuplicateIds).toEqual([]);
      expect(measurements.legacyAvatarDuplicateIds).toEqual(
        [...legacyAvatarFragmentIds].sort()
      );
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
      expect(measurements.trustDescendants).toBeLessThanOrEqual(
        TRUST_MAX_DESCENDANTS
      );
      expect(measurements.homepageDescendants).toBeLessThanOrEqual(
        HOMEPAGE_MAX_DESCENDANTS
      );
    });

    const gallery = page.locator("#community [data-contributor-gallery]");
    const triggers = gallery.locator("[data-contributor-username]");
    yield* Effect.promise(() => expect(gallery).toHaveCount(1));
    yield* Effect.promise(() =>
      expect(triggers).toHaveCount(contributors.length)
    );
    yield* Effect.promise(() =>
      expect(page.locator("[data-contributor-drawer]")).toHaveCount(0)
    );

    const trust = page.locator("#trust");
    const primaryPane = trust.locator("[data-trust-primary-pane]");
    const sourcePane = trust.locator("[data-trust-source-pane]");
    const splitter = trust.locator("[data-trust-splitter]");
    yield* Effect.promise(() =>
      expect(trust.locator("[data-trust-layout]")).toHaveCount(1)
    );
    yield* Effect.promise(() => expect(primaryPane).toHaveCount(1));
    yield* Effect.promise(() => expect(sourcePane).toHaveCount(1));
    yield* Effect.promise(() =>
      expect(primaryPane.locator("article")).toHaveCount(1)
    );
    yield* Effect.promise(() =>
      expect(sourcePane.locator("aside")).toHaveCount(1)
    );
    yield* Effect.promise(() =>
      expect(trust.locator('[data-slot="skeleton"]')).toHaveCount(0)
    );

    if (viewport.desktop) {
      yield* verifyDesktopSplitter(
        primaryPane,
        sourcePane,
        splitter,
        page,
        TRUST_RESIZE_LABEL
      );
    } else {
      yield* Effect.promise(() => expect(splitter).toBeHidden());
      const [primaryBounds, sourceBounds] = yield* Effect.all([
        Effect.promise(() => primaryPane.boundingBox()),
        Effect.promise(() => sourcePane.boundingBox()),
      ]);
      yield* Effect.sync(() => {
        expect(primaryBounds).not.toBeNull();
        expect(sourceBounds).not.toBeNull();
        expect(sourceBounds?.y).toBeGreaterThan(
          primaryBounds?.y ?? Number.MAX_VALUE
        );
      });
    }

    const hasTouch = "hasTouch" in viewport && viewport.hasTouch;
    const firstContributor = yield* readFirstContributor(contributors);
    const firstTrigger = triggers.first();
    yield* Effect.promise(() =>
      hasTouch ? firstTrigger.tap() : firstTrigger.click()
    );
    const drawer = page.locator("[data-contributor-drawer]");
    yield* Effect.promise(() => expect(drawer).toHaveCount(1));
    yield* Effect.promise(() => expect(drawer).toBeVisible());
    yield* Effect.promise(() =>
      expect(drawer).toHaveAccessibleName(firstContributor.name)
    );
    yield* Effect.promise(() =>
      expect(drawer).toHaveAttribute(
        "data-contributor-username",
        firstContributor.username
      )
    );

    for (let press = 0; press < 6; press += 1) {
      yield* Effect.promise(() => page.keyboard.press("Tab"));
      yield* Effect.promise(() =>
        expect
          .poll(() =>
            drawer.evaluate((element) =>
              element.contains(document.activeElement)
            )
          )
          .toBe(true)
      );
    }

    if (hasTouch) {
      yield* swipeContributorDrawer(drawer, page);
    } else {
      yield* Effect.promise(() => page.keyboard.press("Escape"));
    }
    yield* Effect.promise(() => expect(drawer).toHaveCount(0));
    yield* Effect.promise(() => expect(firstTrigger).toBeFocused());

    yield* Effect.promise(() =>
      hasTouch ? firstTrigger.tap() : firstTrigger.click()
    );
    const outsideSurface = page.locator('[data-slot="drawer-viewport"]');
    yield* Effect.promise(() =>
      hasTouch
        ? outsideSurface.tap({ position: { x: 2, y: 2 } })
        : outsideSurface.click({ position: { x: 2, y: 2 } })
    );
    yield* Effect.promise(() => expect(drawer).toHaveCount(0));
    yield* Effect.promise(() => expect(firstTrigger).toBeFocused());
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
      expect(drawer.locator('[data-slot="drawer-title"]')).toHaveText(
        contributor.name
      )
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
    const expectedSocialLinks = Object.values(contributor.social ?? {})
      .filter((href) => href !== undefined)
      .sort();
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

  const productQuestion = page.getByRole("button", {
    name: "What can I learn on Nakafa?",
  });
  yield* Effect.promise(() => productQuestion.click());
  yield* Effect.promise(() =>
    expect(page.locator("#faq")).toContainText(
      "primary school through university"
    )
  );

  const subscriptionQuestion = page.getByRole("button", {
    name: "How do I manage or cancel Pro?",
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
});

for (const viewport of targetViewports) {
  test.describe(`marketing surfaces at ${viewport.name}`, () => {
    test.use({
      hasTouch: "hasTouch" in viewport ? viewport.hasTouch : false,
      viewport: { height: viewport.height, width: viewport.width },
    });

    test("preserves one responsive content tree and project DOM budgets", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, verifyMarketingSurface(page, viewport))
      );
    });
  });
}

test.describe("detached contributor payloads", () => {
  test.use({ viewport: { height: 900, width: 1440 } });

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
  test.use({ viewport: { height: 900, width: 1440 } });

  test("renders plans and pricing questions through the marketing shell", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyPricingPage(page))
    );
  });
});
