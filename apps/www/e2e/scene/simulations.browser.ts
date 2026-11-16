import { expect, type Page, test } from "@playwright/test";
import { Effect } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { CARD } from "@/e2e/support/selector";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/**
 * The three lessons that each carry five real-world simulations, with how many
 * simulation cards each shows: physics, chemistry and biology.
 */
const LESSONS = [
  {
    route: "/en/subjects/physics/kinematics/stopping-distance",
    simulations: 5,
  },
  {
    route: "/en/subjects/chemistry/basic-chemistry-laws/mass-conservation-law",
    simulations: 5,
  },
  { route: "/en/subjects/biology/biodiversity/bacteria", simulations: 5 },
] as const;

/** A card that draws a simulation: a WebGL scene or a p5 sketch, both on a canvas. */
const SIMULATION = `${CARD}:has(canvas)`;

/**
 * Walks down a lesson until every simulation card has drawn its canvas, and
 * checks that each one carries a title and a description in its header.
 */
const expectSimulations = Effect.fn("NakafaE2E.expectSimulations")(function* (
  page: Page,
  lesson: (typeof LESSONS)[number]
) {
  yield* seedAnalyticsConsent(page, "denied");
  const response = yield* Effect.promise(() =>
    page.goto(lesson.route, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));
  // Each card loads its scene only as it nears the screen, so walk the page.
  yield* Effect.promise(() =>
    expect(async () => {
      await page.mouse.wheel(0, 700);
      expect(await page.locator(SIMULATION).count()).toBeGreaterThanOrEqual(
        lesson.simulations
      );
    }).toPass({ timeout: revealTimeoutMilliseconds * 2 })
  );
  const cards = yield* Effect.promise(() => page.locator(SIMULATION).all());
  yield* Effect.forEach(cards, (card) =>
    Effect.promise(async () => {
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('[data-slot="card-title"]')).not.toBeEmpty();
      await expect(
        card.locator('[data-slot="card-description"]')
      ).not.toBeEmpty();
      const box = await card.locator("canvas").first().boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(100);
      expect(box?.height ?? 0).toBeGreaterThan(100);
    })
  );
});

for (const width of [390, 1440] as const) {
  test.describe(`lesson simulations at ${width} px`, () => {
    test.use({ viewport: { height: 900, width } });

    for (const lesson of LESSONS) {
      test(`${lesson.route} draws ${lesson.simulations} simulations with a title and a description`, async ({
        page,
      }) => {
        test.setTimeout(revealTimeoutMilliseconds * 4);
        await Effect.runPromise(
          withObservedPageErrors(page, expectSimulations(page, lesson))
        );
      });
    }
  });
}
