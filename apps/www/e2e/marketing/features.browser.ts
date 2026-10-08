import { expect, type Locator, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import {
  withBrowserContext,
  withObservedPageErrors,
} from "@/e2e/support/context";

const NINA_ANSWER_TEXT = "Subtract the first equation";
const NINA_HEADING_PATTERN = /Nina already knows/;
const NINA_REASONING_TEXT = "Compare the two known equations";
const FEATURED_TRYOUT_HEADING =
  "After learning, see what you really understood";
const NON_WHITESPACE_PATTERN = /\S/;
const ANSWER_STATUS_PATTERN = /^(Correct|Incorrect)$/;
const CORRECT_CHOICE_PATTERN = / Correct$/;
const INCORRECT_CHOICE_PATTERN = / Incorrect$/;
// Match local Next and Vercel-promoted production chunk paths.
const NEXT_CHUNK_PATH =
  /\/_next\/static\/(?:immutable\/)?chunks\/.*\.js(?:\?.*)?$/;

// Wide layouts reduce continuous WebGL pressure; three widths keep normal motion.
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
    yield* seedAnalyticsConsent(page, "denied");
    const response = yield* Effect.promise(() =>
      page.goto("/en", { waitUntil: "domcontentloaded" })
    );
    yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  }
);

/**
 * Centers one control instantly. The page scrolls smoothly, so letting the
 * pointer action scroll races the animation and hits the sticky header.
 */
const centerControl = Effect.fn("NakafaE2E.centerControl")(function* (
  control: Locator
) {
  yield* Effect.promise(() =>
    control.evaluate((element) =>
      element.scrollIntoView({ behavior: "instant", block: "center" })
    )
  );
});

/** Clicks one centered control without a second, smooth scroll. */
const clickCentered = Effect.fn("NakafaE2E.clickCentered")(function* (
  control: Locator
) {
  yield* centerControl(control);
  yield* Effect.promise(() => control.click({ scroll: "none" }));
});

const expectNinaPageFlow = Effect.fn("NakafaE2E.expectNinaPageFlow")(function* (
  page: Page
) {
  const conversation = page.locator('[data-slot="nina-showcase"]');
  const reasoningTrigger = conversation.getByRole("button", {
    name: "Thought for a few seconds",
  });
  const activityTrigger = conversation.getByRole("button", {
    name: "Checking the calculations",
    exact: true,
  });
  const mathTrigger = conversation.getByRole("button", {
    name: "Calculating",
    exact: true,
  });

  yield* Effect.promise(() => expect(conversation).toHaveCount(1));
  yield* Effect.promise(() =>
    expect(
      conversation.getByText(NINA_ANSWER_TEXT, { exact: false })
    ).toBeVisible()
  );
  const reasoning = conversation.getByText(NINA_REASONING_TEXT, {
    exact: false,
  });
  yield* clickCentered(reasoningTrigger);
  yield* Effect.promise(() => expect(reasoning).toBeVisible());
  yield* clickCentered(reasoningTrigger);
  // The collapse moves every row below it, so wait before the next target.
  yield* Effect.promise(() => expect(reasoning).toBeHidden());
  yield* clickCentered(activityTrigger);
  yield* clickCentered(mathTrigger);
  yield* Effect.promise(() =>
    expect(mathTrigger).toHaveAttribute("aria-expanded", "true")
  );
  yield* clickCentered(activityTrigger);
  yield* Effect.promise(() => expect(mathTrigger).toBeHidden());

  // The marketing transcript belongs to the page, so wheel input must not be trapped.
  yield* centerControl(activityTrigger);
  yield* Effect.promise(() => activityTrigger.hover({ scroll: "none" }));
  const before = yield* Effect.promise(() =>
    page.evaluate(() => window.scrollY)
  );
  yield* Effect.promise(() => page.mouse.wheel(0, 400));
  yield* Effect.promise(() =>
    expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(before + 100)
  );
});

const expectFeaturedTryoutResponse = Effect.fn(
  "NakafaE2E.expectFeaturedTryoutResponse"
)(function* (page: Page) {
  const feature = page
    .getByRole("heading", {
      exact: true,
      name: FEATURED_TRYOUT_HEADING,
    })
    .locator("..");
  const response = feature.getByRole("radiogroup", { name: "Answer" });
  const choices = response.getByRole("radio");
  const status = feature.getByRole("status");
  const checkAnswer = feature.getByRole("button", { name: "Check answer" });
  const reset = feature.getByRole("button", { name: "Reset" });

  yield* Effect.promise(() => feature.scrollIntoViewIfNeeded());
  const choiceCount = yield* Effect.promise(() => choices.count());
  yield* Effect.sync(() => expect(choiceCount).toBe(5));
  yield* Effect.promise(() =>
    expect(
      response.getByRole("radio", { exact: true, name: "19" })
    ).toHaveCount(1)
  );

  for (let index = 0; index < choiceCount; index += 1) {
    yield* Effect.promise(() =>
      expect(choices.nth(index)).toHaveAccessibleName(NON_WHITESPACE_PATTERN)
    );
  }

  const math = response.getByTestId("katex");
  const annotations = math.locator("annotation");
  const mathCount = yield* Effect.promise(() => math.count());
  yield* Effect.promise(() => expect(annotations).toHaveCount(mathCount));
  for (let index = 0; index < mathCount; index += 1) {
    yield* Effect.promise(() =>
      expect(annotations.nth(index)).toHaveText(NON_WHITESPACE_PATTERN)
    );
  }

  yield* Effect.promise(() => expect(checkAnswer).toHaveCount(0));
  yield* Effect.promise(() => expect(reset).toHaveCount(0));

  const seedChoice = choices.first();
  yield* Effect.promise(() => seedChoice.click());
  yield* Effect.promise(() => expect(seedChoice).toBeChecked());
  yield* Effect.promise(() => expect(status).toHaveText(ANSWER_STATUS_PATTERN));

  const correctChoice = response.getByRole("radio", {
    name: CORRECT_CHOICE_PATTERN,
  });
  const incorrectChoices = response.getByRole("radio", {
    name: INCORRECT_CHOICE_PATTERN,
  });
  yield* Effect.promise(() => expect(correctChoice).toHaveCount(1));
  yield* Effect.promise(() =>
    expect(correctChoice).toHaveAccessibleName("19 Correct")
  );
  yield* Effect.promise(() =>
    expect(incorrectChoices).toHaveCount(choiceCount - 1)
  );

  const incorrectChoice = incorrectChoices.first();
  yield* Effect.promise(() => incorrectChoice.click());
  yield* Effect.promise(() => expect(incorrectChoice).toBeChecked());
  yield* Effect.promise(() =>
    expect(incorrectChoice).toHaveAccessibleName(INCORRECT_CHOICE_PATTERN)
  );
  yield* Effect.promise(() => expect(status).toHaveText("Incorrect"));
  yield* Effect.promise(() => expect(checkAnswer).toHaveCount(0));
  yield* Effect.promise(() => expect(reset).toHaveCount(0));

  yield* Effect.promise(() => correctChoice.click());
  yield* Effect.promise(() => expect(correctChoice).toBeChecked());
  yield* Effect.promise(() => expect(incorrectChoice).not.toBeChecked());
  yield* Effect.promise(() =>
    expect(correctChoice).toHaveAccessibleName(CORRECT_CHOICE_PATTERN)
  );
  yield* Effect.promise(() => expect(status).toHaveText("Correct"));
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
  yield* Effect.promise(() => page.evaluate(() => window.scrollTo(0, 0)));
  yield* Effect.promise(() => expect(canvas).toHaveCount(0));
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

const expectProjectileHydratedWhileDeferred = Effect.fn(
  "NakafaE2E.expectProjectileHydratedWhileDeferred"
)(function* (page: Page) {
  const highArc = page.getByRole("button", { name: "High Arc" });
  yield* Effect.promise(() =>
    expect
      .poll(async () => {
        await highArc.dispatchEvent("click");
        return await highArc.getAttribute("aria-pressed");
      })
      .toBe("true")
  );
  yield* expectProjectileDeferred(page);
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
                if (viewport.name === "desktop") {
                  yield* expectFeaturedTryoutResponse(page);
                }
                yield* expectNinaPageFlow(page);
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
              yield* expectProjectileHydratedWhileDeferred(page);
              yield* expectProjectileRecovery(page);
            })
          );
        })
    )
  );
});
