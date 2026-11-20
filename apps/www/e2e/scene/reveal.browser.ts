import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";
import { Array as Arr, Effect, Option, Schema } from "effect";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { readCumulativeLayoutShift } from "@/e2e/support/layout";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { CARD, MATH_SCENE } from "@/e2e/support/selector";
import { revealTimeoutMilliseconds } from "@/e2e/support/timeout";

/** The page global that holds one sample of the watched card per frame. */
const SAMPLES = "nakafaSceneSamples";

/** The attribute the test puts on the card it watches. */
const WATCHED = "data-reveal-watch";

/** A lesson the acceptance runtime serves whose labs stand on the science stage. */
const LAB_ROUTE = "/en/subjects/physics/kinematics/stopping-distance";

/** The widths a reader meets most: a phone and a laptop. */
const WIDTHS = [390, 1440] as const;

/** One frame of the watched card. */
const SampleSchema = Schema.Struct({
  /** Distance, in pixels, from the spinner's middle to the frame's, while the spinner shows. */
  centred: Schema.NullOr(Schema.Finite),
  /** The card's height. */
  height: Schema.Finite,
  /** How far the visual's top stands below the card's top. */
  inset: Schema.Finite,
  /** Whether the frame shows the still, the spinner or the drawn canvas. */
  shown: Schema.Boolean,
  /** The scene's stage, or `still` before its canvas mounts. */
  state: Schema.String,
  /** The visual's height. */
  visual: Schema.Finite,
});
type Sample = typeof SampleSchema.Type;

/**
 * Samples the watched card on every frame, from the page's first script on:
 * its height, where its visual stands inside it, its scene's stage, whether
 * the frame shows anything (the still, the spinner or the drawn canvas) and
 * how far the spinner stands from the middle of the frame. A card far from the
 * viewport skips its contents (`content-auto-card`) and stands at a fallback
 * height, so its frames count from the first one the browser lays it out in.
 * The card's place in the page is not sampled: cards above it lay out as the
 * scroll reaches them, which moves it without the scene, and Chromium's layout
 * shift entries hold the page itself. The page serializes this function.
 */
function sampleScene({ key, watched }: { key: string; watched: string }) {
  const samples: Sample[] = [];
  Reflect.set(window, key, samples);
  const visible = (element: Element | null) =>
    element?.checkVisibility({
      opacityProperty: true,
      visibilityProperty: true,
    }) === true;
  const tick = () => {
    const card = document.querySelector(`[${watched}]`);
    const content = card?.querySelector('[data-slot="visual-card-body"]');
    if (card && content?.checkVisibility({ contentVisibilityAuto: true })) {
      const box = card.getBoundingClientRect();
      const body = content.getBoundingClientRect();
      const frame = card.querySelector("[data-scene-state]");
      const state = frame?.getAttribute("data-scene-state") ?? "still";
      const loading = card.querySelector('[data-slot="scene-loading"]');
      const spinner = loading?.querySelector('[data-slot="spinner"]') ?? null;
      const still = card.querySelector('[data-slot="scene-still"]');
      const canvas = card.querySelector("canvas");
      let centred: number | null = null;
      if (loading && spinner && visible(spinner)) {
        const mark = spinner.getBoundingClientRect();
        const area = loading.getBoundingClientRect();
        centred = Math.max(
          Math.abs(mark.x + mark.width / 2 - (area.x + area.width / 2)),
          Math.abs(mark.y + mark.height / 2 - (area.y + area.height / 2))
        );
      }
      samples.push({
        centred,
        height: box.height,
        inset: body.top - box.top,
        shown:
          visible(still) ||
          visible(spinner) ||
          (state === "drawn" && visible(canvas)),
        state,
        visual: body.height,
      });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** Reads the samples the page took of the watched card. */
const readSamples = (page: Page) =>
  Effect.promise(() =>
    page.evaluate((key) => Array.from(Reflect.get(window, key) ?? []), SAMPLES)
  ).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.Array(SampleSchema)))
  );

/** Moves the pointer over the card, as a reader's first gesture on the page. */
const moveOver = Effect.fn("NakafaE2E.moveOver")(function* (
  page: Page,
  card: Locator
) {
  const box = yield* Effect.promise(() => card.boundingBox());
  if (!box) {
    return;
  }
  yield* Effect.promise(() =>
    page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 4,
    })
  );
});

/**
 * Watches one scene card from before its scene loads until it is drawn, and
 * holds it to the reveal the owner asked for: the card keeps one size and its
 * visual one place inside it, the frame never shows nothing, the spinner
 * stands in the middle of the frame while the scene loads, and the scene ends
 * drawn, not failed.
 */
const expectSteadyReveal = Effect.fn("NakafaE2E.expectSteadyReveal")(function* (
  page: Page,
  card: Locator
) {
  // Watch the card first: the scroll that brings it near is a gesture that may load it.
  yield* Effect.promise(() =>
    card.evaluate((element, watched) => {
      element.setAttribute(watched, "");
    }, WATCHED)
  );
  yield* Effect.promise(() => card.scrollIntoViewIfNeeded());
  yield* moveOver(page, card);
  yield* Effect.promise(() =>
    expect(card.locator("[data-scene-state]")).toHaveAttribute(
      "data-scene-state",
      "drawn",
      { timeout: revealTimeoutMilliseconds }
    )
  );
  const samples = yield* readSamples(page);
  const first = Option.getOrNull(Arr.head(samples));
  yield* Effect.sync(() => {
    expect(samples.length, "frames sampled").toBeGreaterThan(0);
    expect(
      Arr.filter(samples, (sample) => !sample.shown),
      "frames that showed nothing"
    ).toEqual([]);
    expect(
      Arr.filter(
        samples,
        (sample) =>
          first !== null &&
          (Math.abs(sample.height - first.height) > 0.5 ||
            Math.abs(sample.inset - first.inset) > 0.5 ||
            Math.abs(sample.visual - first.visual) > 0.5)
      ),
      "frames where the card changed size or its visual moved inside it"
    ).toEqual([]);
    expect(
      Arr.filter(
        samples,
        (sample) => sample.centred !== null && sample.centred > 1
      ),
      "frames where the spinner stood off the middle"
    ).toEqual([]);
    expect(
      Arr.some(samples, (sample) => sample.centred !== null),
      "the spinner showed while the scene loaded"
    ).toBe(true);
    expect(
      Arr.filter(samples, (sample) => sample.state === "failed"),
      "frames that said the scene failed"
    ).toEqual([]);
  });
});

for (const width of WIDTHS) {
  test.describe(`scene reveal at ${width} px`, () => {
    test.use({ viewport: { height: 900, width } });

    test.beforeEach(async ({ page }) => {
      await page.addInitScript(sampleScene, { key: SAMPLES, watched: WATCHED });
    });

    test("a MathVisual swaps its still for its scene in place, with a centred spinner between", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* openRoute(page, pinnedRoutes.material.en);
            const card = page
              .locator(CARD)
              .filter({ has: page.locator(MATH_SCENE) })
              .first();
            yield* expectSteadyReveal(page, card);
          })
        )
      );
    });

    test("a lab on the science stage loads behind a centred spinner and appears in place", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          Effect.gen(function* () {
            yield* openRoute(page, LAB_ROUTE);
            // The last lab stands far below the first screen, so it has not loaded before the test watches it.
            const card = page
              .locator(CARD)
              .filter({ has: page.locator("[data-scene-state]") })
              .filter({ hasNot: page.locator(MATH_SCENE) })
              .last();
            yield* expectSteadyReveal(page, card);
          })
        )
      );
    });

    // Chromium reports layout shift entries; in the other engines the frame samples above hold the card in place.
    test("loading a scene moves nothing on the page", async ({ page }) => {
      await Effect.runPromise(
        Effect.gen(function* () {
          yield* openRoute(page, pinnedRoutes.material.en);
          const card = page
            .locator(CARD)
            .filter({ has: page.locator(MATH_SCENE) })
            .first();
          yield* Effect.promise(() => card.scrollIntoViewIfNeeded());
          yield* moveOver(page, card);
          yield* Effect.promise(() =>
            expect(card.locator("[data-scene-state]")).toHaveAttribute(
              "data-scene-state",
              "drawn",
              { timeout: revealTimeoutMilliseconds }
            )
          );
          const shift = yield* readCumulativeLayoutShift(page);
          yield* Effect.sync(() => expect(shift).toBe(0));
        })
      );
    });
  });
}
