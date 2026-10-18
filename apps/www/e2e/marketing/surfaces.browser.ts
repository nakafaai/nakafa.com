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
 * Each friend of the crowd is one animal in a round avatar: two spans around an
 * svg of 15 to 25 elements, and every fourth friend also has a typing bubble of
 * six elements. The ceilings follow the friends that the section renders, read
 * from the crowd's own constants, so a new friend adds its share and a heavier
 * drawing still breaks the budget. The figures are measured on a production
 * build of commit 0923c41e34 on 17 October 2026, by the reader this test uses,
 * at every target viewport: 18 friends, 5 of them typing, 436 descendants, 109
 * of them outside the drawings, and 44,814 bytes once serialized. Each ceiling
 * is about six percent over its measure: a fixed part plus the friends and the
 * bubbles.
 */
const COMMUNITY_MARGIN = 1.06;
const COMMUNITY_FRIENDS = CROWD_HERD.length;
const COMMUNITY_TYPING_FRIENDS = Math.ceil(
  COMMUNITY_FRIENDS / CROWD_TYPING_EVERY
);
const COMMUNITY_MAX_CHROME_DESCENDANTS = Math.ceil(
  COMMUNITY_MARGIN * (7 + 4 * COMMUNITY_FRIENDS + 6 * COMMUNITY_TYPING_FRIENDS)
);
// An animal draws a shine in each open eye and two cheeks.
const COMMUNITY_MAX_DESCENDANTS = Math.ceil(
  COMMUNITY_MARGIN *
    (10 + 28 * COMMUNITY_FRIENDS + 6 * COMMUNITY_TYPING_FRIENDS)
);
// An animal draws a shine in each open eye and two cheeks.
const COMMUNITY_MAX_HTML_BYTES = Math.ceil(
  COMMUNITY_MARGIN *
    (2743 + 2522 * COMMUNITY_FRIENDS + 667 * COMMUNITY_TYPING_FRIENDS)
);

/**
 * The homepage ceiling: the body held 3,079 elements at every target viewport
 * on the production build of commit 4eed1d1a95 on 17 October 2026, because the
 * lesson window draws all four cards in one grid cell and mounts only the open
 * lab. Six percent over 3,079 is 3,264.
 */
const HOMEPAGE_MAX_DESCENDANTS = 3264;

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
