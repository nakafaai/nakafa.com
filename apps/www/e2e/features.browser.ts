import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "./support/browser-context";

const ANALYTICS_CONSENT_STORAGE_KEY = "nakafa-analytics-consent";
const NINA_ANSWER_TEXT = "Subtract the first equation";
const NINA_HEADING_PATTERN = /Nina already knows/;
const NINA_REASONING_TEXT = "Compare the two known equations";
const deniedConsent = JSON.stringify({
  category: "analytics",
  decidedAt: 1,
  decision: "denied",
  mechanism: "privacy-controls",
  noticeVersion: "privacy-2026-08-22",
});

// Normal motion remains covered at three widths. Wide layouts use the product's
// reduced-motion path so continuous WebGL frames cannot starve pointer checks.
const targetViewports = [
  {
    height: 800,
    name: "compact",
    reducedMotion: "no-preference",
    width: 320,
  },
  {
    hasTouch: true,
    height: 844,
    name: "touch",
    reducedMotion: "no-preference",
    width: 390,
  },
  {
    height: 1024,
    name: "tablet-portrait",
    reducedMotion: "no-preference",
    width: 768,
  },
  {
    height: 768,
    name: "tablet-landscape",
    reducedMotion: "reduce",
    width: 1024,
  },
  {
    height: 900,
    name: "desktop",
    reducedMotion: "reduce",
    width: 1440,
  },
] as const;

const prepareFeaturesPage = Effect.fn("NakafaE2E.prepareFeaturesPage")(
  function* (page: Page) {
    yield* Effect.promise(() =>
      page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
        key: ANALYTICS_CONSENT_STORAGE_KEY,
        value: deniedConsent,
      })
    );
    const response = yield* Effect.promise(() =>
      page.goto("/en", { waitUntil: "domcontentloaded" })
    );
    yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  }
);

const expectNinaAtBottom = Effect.fn("NakafaE2E.expectNinaAtBottom")(function* (
  page: Page
) {
  const conversation = page
    .locator('[role="log"]')
    .filter({ hasText: NINA_ANSWER_TEXT });
  const scroller = conversation.locator(":scope > div").first();
  const reasoningTrigger = page.getByRole("button", {
    name: "Thought for a few seconds",
  });
  const mathTrigger = page.getByRole("button", { name: "Calculating" });

  yield* Effect.promise(() => expect(conversation).toHaveCount(1));
  yield* Effect.promise(() => conversation.scrollIntoViewIfNeeded());
  yield* Effect.promise(() =>
    expect
      .poll(() =>
        scroller.evaluate(
          (element) =>
            element.scrollHeight - element.clientHeight - element.scrollTop
        )
      )
      .toBeLessThanOrEqual(2)
  );
  yield* Effect.promise(() => reasoningTrigger.click());
  yield* Effect.promise(() =>
    expect(page.getByText(NINA_REASONING_TEXT, { exact: false })).toBeVisible()
  );
  yield* Effect.promise(() => mathTrigger.click());
  yield* Effect.promise(() =>
    expect(mathTrigger).toHaveAttribute("aria-expanded", "true")
  );
});

const expectResponsiveFeatureLayout = Effect.fn(
  "NakafaE2E.expectResponsiveFeatureLayout"
)(function* (page: Page, width: number) {
  const ninaCard = page
    .getByRole("heading", { name: NINA_HEADING_PATTERN })
    .locator("..");
  const projectileCard = page
    .getByRole("region", { name: "Cannonball projectile analysis visual" })
    .locator("xpath=ancestor::div[contains(@class, 'lg:col-span-7')][1]");
  const [ninaBounds, projectileBounds] = yield* Effect.all([
    Effect.promise(() => ninaCard.boundingBox()),
    Effect.promise(() => projectileCard.boundingBox()),
  ]);

  yield* Effect.sync(() => {
    expect(ninaBounds).not.toBeNull();
    expect(projectileBounds).not.toBeNull();
  });
  if (!(ninaBounds && projectileBounds)) {
    return;
  }

  if (width < 1024) {
    yield* Effect.sync(() =>
      expect(projectileBounds.y).toBeGreaterThanOrEqual(
        ninaBounds.y + ninaBounds.height - 2
      )
    );
    return;
  }

  yield* Effect.sync(() => {
    expect(Math.abs(projectileBounds.y - ninaBounds.y)).toBeLessThanOrEqual(2);
    expect(projectileBounds.x).toBeGreaterThanOrEqual(
      ninaBounds.x + ninaBounds.width - 2
    );
  });
});

const expectProjectileInteraction = Effect.fn(
  "NakafaE2E.expectProjectileInteraction"
)(function* (page: Page) {
  const visual = page.getByRole("region", {
    name: "Cannonball projectile analysis visual",
  });
  const canvas = visual.locator("canvas");
  const highArc = page.getByRole("button", { name: "High Arc" });

  yield* Effect.promise(() => expect(visual).toHaveCount(1));
  yield* Effect.promise(() => visual.scrollIntoViewIfNeeded());
  yield* Effect.promise(() => expect(canvas).toBeVisible({ timeout: 30_000 }));
  yield* Effect.promise(() => highArc.click());
  yield* Effect.promise(() =>
    expect(highArc).toHaveAttribute("aria-pressed", "true")
  );
});

const expectProjectileDeferred = Effect.fn(
  "NakafaE2E.expectProjectileDeferred"
)(function* (page: Page) {
  const visual = page.getByRole("region", {
    name: "Cannonball projectile analysis visual",
  });

  yield* Effect.promise(() => expect(visual).toHaveCount(1));
  yield* Effect.promise(() => expect(visual.locator("canvas")).toHaveCount(0));
});

for (const viewport of targetViewports) {
  test(`homepage features preserve UX at ${viewport.name}`, async ({
    baseURL,
    browser,
  }) => {
    expect(baseURL).toBeTruthy();
    await Effect.runPromise(
      withBrowserContext(
        browser,
        {
          baseURL: baseURL ?? "",
          hasTouch: "hasTouch" in viewport ? viewport.hasTouch : false,
          reducedMotion: viewport.reducedMotion,
          serviceWorkers: "block",
          viewport: { height: viewport.height, width: viewport.width },
        },
        (context) =>
          Effect.gen(function* () {
            const page = yield* Effect.promise(() => context.newPage());
            yield* withObservedPageErrors(
              page,
              Effect.gen(function* () {
                yield* prepareFeaturesPage(page);
                yield* expectProjectileDeferred(page);
                yield* expectResponsiveFeatureLayout(page, viewport.width);
                yield* expectNinaAtBottom(page);
                yield* expectProjectileInteraction(page);
              })
            );
          })
      )
    );
  });
}
