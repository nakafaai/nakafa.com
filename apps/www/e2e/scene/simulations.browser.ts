import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Effect } from "effect";
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
    route: "/en/subjects/chemistry/structure-matter/atom-shell",
    simulations: 5,
  },
  { route: "/en/subjects/biology/biodiversity/bacteria", simulations: 5 },
] as const;

/** A card that owns a simulation: a pooled WebGL scene frame or a p5 sketch canvas. */
const SIMULATION = `${CARD}:has([data-scene-state], canvas)`;

/**
 * Walks down a lesson so every simulation card enters view, verifies that
 * each one carries a title and a description in its header and renders a
 * non-empty canvas (reaching `data-scene-state="drawn"` for pooled 3D scenes),
 * while the LRU WebGL context pool keeps concurrent WebGL canvases bounded.
 */
const expectSimulations = Effect.fn("NakafaE2E.expectSimulations")(function* (
  page: Page,
  lesson: (typeof LESSONS)[number]
) {
  const response = yield* Effect.promise(() =>
    page.goto(lesson.route, { waitUntil: "domcontentloaded" })
  );
  yield* Effect.sync(() => expect(response?.ok()).toBe(true));

  // Walk down the page so lazy/content-visibility cards mount their simulation frames.
  yield* Effect.promise(() =>
    expect(async () => {
      await page.mouse.wheel(0, 700);
      expect(await page.locator(SIMULATION).count()).toBeGreaterThanOrEqual(
        lesson.simulations
      );
    }).toPass({ timeout: revealTimeoutMilliseconds * 2 })
  );

  const count = yield* Effect.promise(() => page.locator(SIMULATION).count());
  for (let index = 0; index < count; index += 1) {
    const card = page.locator(SIMULATION).nth(index);
    yield* Effect.promise(async () => {
      await card.scrollIntoViewIfNeeded();
      await expect(card.locator('[data-slot="card-title"]')).not.toBeEmpty();
      await expect(
        card.locator('[data-slot="card-description"]')
      ).not.toBeEmpty();
      const sceneFrame = card.locator("[data-scene-state]");
      if ((await sceneFrame.count()) > 0) {
        await expect(sceneFrame.first()).toHaveAttribute(
          "data-scene-state",
          "drawn",
          { timeout: revealTimeoutMilliseconds }
        );
      }
      const box = await card.locator("canvas").first().boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(100);
      expect(box?.height ?? 0).toBeGreaterThan(100);
      // Pooled WebGL contexts stay bounded at or below the desktop limit of 4.
      expect(
        await page.locator("[data-scene-state] canvas").count()
      ).toBeLessThanOrEqual(4);
    });
  }
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
