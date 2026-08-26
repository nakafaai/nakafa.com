import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/browser-context";
import { seedDeniedAnalyticsConsent } from "@/e2e/support/consent";

const NINA_ANSWER_TEXT = "Subtract the first equation";
const NINA_HEADING_PATTERN = /Nina already knows/;
const NINA_REASONING_TEXT = "Compare the two known equations";
const NEXT_CHUNK_PATH = /\/_next\/static\/chunks\/.*\.js(?:\?.*)?$/;

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
    yield* seedDeniedAnalyticsConsent(page);
    const response = yield* Effect.promise(() =>
      page.goto("/en", { waitUntil: "domcontentloaded" })
    );
    yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  }
);

const expectConversationAtBottom = Effect.fn(
  "NakafaE2E.expectConversationAtBottom"
)(function* (scroller: Locator) {
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
});

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
  yield* expectConversationAtBottom(scroller);
  yield* Effect.promise(() => reasoningTrigger.click());
  yield* Effect.promise(() =>
    expect(page.getByText(NINA_REASONING_TEXT, { exact: false })).toBeVisible()
  );

  // A real upward wheel uses use-stick-to-bottom's owned escape path before
  // Playwright targets content above the clipped conversation viewport.
  yield* Effect.promise(() => scroller.hover({ scroll: "none" }));
  yield* Effect.promise(() => page.mouse.wheel(0, -1));
  yield* Effect.promise(() => mathTrigger.scrollIntoViewIfNeeded());
  yield* Effect.promise(() => expect(mathTrigger).toBeInViewport({ ratio: 1 }));
  yield* Effect.promise(() => mathTrigger.click({ scroll: "none" }));
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

const expectProjectileRecovery = Effect.fn(
  "NakafaE2E.expectProjectileRecovery"
)(function* (page: Page) {
  const visual = page.getByRole("region", {
    name: "Cannonball projectile analysis visual",
  });
  const error = visual.getByRole("alert");

  yield* Effect.promise(() =>
    page.route(NEXT_CHUNK_PATH, (route) => route.abort("failed"))
  );
  yield* Effect.promise(() => visual.scrollIntoViewIfNeeded());
  yield* Effect.promise(() => expect(error).toBeVisible({ timeout: 15_000 }));
  yield* Effect.promise(() =>
    expect(error.getByRole("button", { name: "Retry" })).toBeVisible()
  );
  yield* Effect.promise(() => page.unroute(NEXT_CHUNK_PATH));
  yield* Effect.promise(() =>
    Promise.all([
      page.waitForEvent("framenavigated", {
        predicate: (frame) => frame === page.mainFrame(),
      }),
      error.getByRole("button", { name: "Retry" }).click(),
    ])
  );
  yield* Effect.promise(() => page.waitForLoadState("domcontentloaded"));
  yield* Effect.promise(() =>
    expect
      .poll(() =>
        page.evaluate(() => {
          const [entry] = performance.getEntriesByType("navigation");
          return entry instanceof PerformanceNavigationTiming
            ? entry.type
            : null;
        })
      )
      .toBe("reload")
  );
  yield* expectProjectileInteraction(page);
});

const expectProjectileDeferred = Effect.fn(
  "NakafaE2E.expectProjectileDeferred"
)(function* (page: Page) {
  const visual = page.getByRole("region", {
    name: "Cannonball projectile analysis visual",
  });

  yield* Effect.promise(() => expect(visual).toHaveCount(1));
  yield* Effect.promise(() => expect(visual.locator("canvas")).toHaveCount(0));
  yield* Effect.promise(() =>
    expect(visual.getByRole("status")).toHaveCount(0)
  );
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

test("homepage projectile recovers from a terminal scene load failure", async ({
  baseURL,
  browser,
}) => {
  expect(baseURL).toBeTruthy();
  await Effect.runPromise(
    withBrowserContext(
      browser,
      {
        baseURL: baseURL ?? "",
        reducedMotion: "reduce",
        serviceWorkers: "block",
        viewport: { height: 768, width: 1024 },
      },
      (context) =>
        Effect.gen(function* () {
          const page = yield* Effect.promise(() => context.newPage());
          yield* withObservedPageErrors(
            page,
            Effect.gen(function* () {
              yield* prepareFeaturesPage(page);
              yield* expectProjectileDeferred(page);
              yield* expectProjectileRecovery(page);
            })
          );
        })
    )
  );
});
