import { expect, type Page, test } from "@playwright/test";
import { Array as Arr, Effect, Order, Record as Rec } from "effect";
import { activateUntilVisible } from "@/e2e/support/input";
import {
  loadMarketingPage,
  measureMarketingPage,
  readFirstContributor,
} from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { DRAWER_TITLE } from "@/e2e/support/selector";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport, targetViewports } from "@/e2e/support/viewport";
import { contributors } from "@/lib/data/contributor";

/**
 * These ceilings guard the markup of the marketing pages. They were measured
 * before the home page drew its current parts: the Community section now draws
 * the crowd of animals in `CROWD_HERD`, not the contributor gallery. Measure
 * them again on a production build before they guard new markup.
 */
const COMMUNITY_MAX_CHROME_DESCENDANTS = 45;
const COMMUNITY_MAX_DESCENDANTS = 295;
const COMMUNITY_MAX_HTML_BYTES = 35_000;
const HOMEPAGE_MAX_DESCENDANTS = 2063;
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
