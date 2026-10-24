import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { loadMarketingPage } from "@/e2e/support/marketing";
import { withObservedPageErrors } from "@/e2e/support/observe";
import {
  expectStablePricingAppShell,
  expectStablePricingTransition,
  observeStablePricingReload,
} from "@/e2e/support/pricing";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { desktopViewport } from "@/e2e/support/viewport";

const PRICING_PATH_PATTERN = /\/id\/pricing$/;
const EURO_TITLE_PATTERN = /So viel sind 8,99\s€/;
const EURO_PER_DAY_PATTERN = /0,30\s€ am Tag/;
const RUPIAH_TITLE_PATTERN = /Rp\s69\.000 itu segini/;
const RUPIAH_PER_DAY_PATTERN = /Rp\s2\.300 sehari/;

const verifyPricingPage = Effect.fn("NakafaE2E.verifyPricingPage")(function* (
  page: Page
) {
  yield* loadMarketingPage(page, "/en/pricing");
  yield* Effect.promise(() =>
    expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Free really means free"
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
        name: "Free really means free",
      })
    ).toContainText("3,000 credits every month to ask Nina")
  );
  yield* Effect.promise(() =>
    expect(
      page.getByRole("heading", { level: 2, name: "What $8.99 comes to" })
    ).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText("About 2 lattes")
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText("$0.30 a day")
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText("600 answers from Nina")
  );
  yield* Effect.promise(() =>
    expect(page.getByRole("button", { name: "Get Pro" })).toBeEnabled()
  );
  const freePlan = page.locator('[data-pricing-plan="free"]');
  yield* Effect.promise(() =>
    expect(
      freePlan.getByText("No card. No trial period.", { exact: true })
    ).toBeVisible()
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
  yield* Effect.promise(() => expect(pricingQuestions).toHaveCount(10));

  // The first question is open when the page loads; the renewal one opens on a click.
  const renewalQuestion = pricingQuestions.filter({
    hasText: "When do credits renew?",
  });
  const renewalItem = page
    .locator('#faq [data-slot="accordion-item"]')
    .filter({ hasText: "When do credits renew?" });
  const renewalPanel = renewalItem.locator('[data-slot="accordion-content"]');
  yield* Effect.promise(() => renewalQuestion.click());
  yield* Effect.promise(() =>
    expect(renewalQuestion).toHaveAttribute("aria-expanded", "true")
  );
  yield* Effect.promise(() =>
    expect(renewalPanel).toHaveAttribute("data-open", "")
  );
  yield* Effect.promise(() =>
    expect(renewalPanel).toHaveCSS("animation-name", "accordion-down")
  );
  yield* Effect.promise(() =>
    expect(renewalPanel).toHaveCSS("animation-duration", "0.18s")
  );
  yield* Effect.promise(() =>
    expect(renewalQuestion.locator("svg")).toHaveCSS("rotate", "180deg")
  );
  yield* Effect.promise(() =>
    expect(renewalQuestion.locator("svg")).toHaveCSS(
      "transition-duration",
      "0.18s"
    )
  );
  yield* Effect.promise(() =>
    expect(renewalPanel).toContainText(
      "Pro credits renew at the start of every month."
    )
  );

  const subscriptionQuestion = pricingQuestions.filter({
    hasText: "How do I manage or cancel Pro?",
  });
  yield* Effect.promise(() => subscriptionQuestion.click());
  yield* Effect.promise(() =>
    expect(page.locator("#faq")).toContainText(
      "manage or cancel the subscription"
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
    yield* Effect.promise(() =>
      expect(
        page.getByRole("heading", { level: 2, name: "$8.99 itu segini" })
      ).toBeVisible()
    );
    yield* Effect.promise(() =>
      expect(page.locator("#comparison")).toContainText("Kira-kira 2 latte")
    );

    const observation = yield* observeStablePricingReload(
      page,
      readinessTimeoutMilliseconds
    );
    yield* Effect.sync(() => expectStablePricingTransition(observation));
  }
);

/**
 * Opens a pricing page the way the edge reports a visitor from one country. The
 * first response sets the currency cookie, and the page shows that currency on
 * the next load, so the page is loaded again once the cookie is set.
 */
const loadPricingPageFrom = Effect.fn("NakafaE2E.loadPricingPageFrom")(
  function* (page: Page, href: string, country: string) {
    yield* Effect.promise(() =>
      page.setExtraHTTPHeaders({ "CF-IPCountry": country })
    );
    yield* loadMarketingPage(page, href);
    yield* Effect.promise(() => page.reload({ waitUntil: "domcontentloaded" }));
  }
);

/** The German comparisons of the dollar price, which a visitor without a country sees. */
const verifyGermanPricingComparisons = Effect.fn(
  "NakafaE2E.verifyGermanPricingComparisons"
)(function* (page: Page) {
  yield* loadMarketingPage(page, "/de/pricing");
  yield* Effect.promise(() =>
    expect(
      page.getByRole("heading", { level: 2, name: "So viel sind $8.99" })
    ).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText("Etwa 2 Lattes")
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText("$0.30 am Tag")
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText("600 Antworten von Nina")
  );
});

/** The German comparisons of the euro price, for a visitor from a euro country. */
const verifyEuroPricingComparisons = Effect.fn(
  "NakafaE2E.verifyEuroPricingComparisons"
)(function* (page: Page) {
  yield* loadPricingPageFrom(page, "/de/pricing", "DE");
  yield* Effect.promise(() =>
    expect(
      page.getByRole("heading", { level: 2, name: EURO_TITLE_PATTERN })
    ).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText(
      "Etwa 3 Kaffee zum Mitnehmen"
    )
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText(EURO_PER_DAY_PATTERN)
  );
});

/** The Indonesian comparisons of the Rupiah price, for a visitor from Indonesia. */
const verifyRupiahPricingComparisons = Effect.fn(
  "NakafaE2E.verifyRupiahPricingComparisons"
)(function* (page: Page) {
  yield* loadPricingPageFrom(page, "/id/pricing", "ID");
  yield* Effect.promise(() =>
    expect(
      page.getByRole("heading", { level: 2, name: RUPIAH_TITLE_PATTERN })
    ).toBeVisible()
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText(
      "Kira-kira 3 es kopi susu"
    )
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText(RUPIAH_PER_DAY_PATTERN)
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toContainText("600 jawaban Nina")
  );
});

/**
 * The toys of the pricing page wait for their part, and then come on screen
 * while the reader stays where they scrolled: loading the toys must not hide
 * the page and drop the reader back at the top.
 */
const verifyPricingToysWaitForTheirPart = Effect.fn(
  "NakafaE2E.verifyPricingToysWaitForTheirPart"
)(function* (page: Page) {
  yield* loadMarketingPage(page, "/en/pricing");
  const toys = page.locator('[class*="group/toy"]');
  yield* Effect.promise(() => expect(toys).toHaveCount(0));
  yield* Effect.promise(() =>
    page.locator("#comparison").scrollIntoViewIfNeeded()
  );
  const scrolled = yield* Effect.promise(() =>
    page.evaluate(() => window.scrollY)
  );
  yield* Effect.promise(() => expect(toys.first()).toBeVisible());
  yield* Effect.promise(() =>
    expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrolled)
  );
  yield* Effect.promise(() =>
    expect(page.locator("#comparison")).toBeInViewport()
  );
});

const verifyPricingReducedMotion = Effect.fn(
  "NakafaE2E.verifyPricingReducedMotion"
)(function* (page: Page) {
  yield* loadMarketingPage(page, "/en/pricing");
  // The toys load when the comparison comes on screen, so the page reaches it first.
  yield* Effect.promise(() =>
    page.locator("#comparison").scrollIntoViewIfNeeded()
  );
  // A thing moves only through a motion that is on for people who allow it.
  const thing = page.locator('[class*="animate-thing-"]').first();
  yield* Effect.promise(() =>
    expect(thing).toHaveCSS("animation-name", "none")
  );
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

  test("compares the dollar price in German", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyGermanPricingComparisons(page))
    );
  });

  test("compares the euro price in German", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyEuroPricingComparisons(page))
    );
  });

  test("compares the Rupiah price in Indonesian", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyRupiahPricingComparisons(page))
    );
  });
});

test.describe("dedicated pricing page with the comparison below the screen", () => {
  test.use({
    viewport: {
      height: 600,
      width: desktopViewport.width,
    },
  });

  test("loads the toys only when their part comes on screen", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyPricingToysWaitForTheirPart(page))
    );
  });
});

test.describe("dedicated pricing page with reduced motion", () => {
  test.use({
    reducedMotion: "reduce",
    viewport: {
      height: desktopViewport.height,
      width: desktopViewport.width,
    },
  });

  test("holds its things still", async ({ page }) => {
    await Effect.runPromise(
      withObservedPageErrors(page, verifyPricingReducedMotion(page))
    );
  });
});
