import { type ConsoleMessage, expect, type Page, test } from "@playwright/test";
import { THREE_RENDER_MARGIN } from "@repo/design-system/components/three/data/constants";
import { Effect } from "effect";
import {
  countCanvasFrames,
  expectCanvasToMove,
  expectFramesToAdvance,
  expectFramesToHold,
  PIXEL_READBACKS,
  patchWebGL,
  recordPixelReadbacks,
} from "@/e2e/support/canvas";
import { pinnedRoutes } from "@/e2e/support/corpus";
import {
  withObservedEvents,
  withObservedPageErrors,
} from "@/e2e/support/observe";
import { openRoute } from "@/e2e/support/route";
import { isKnownSceneDiagnostic, revealLineScene } from "@/e2e/support/scene";
import { SCENE_ACTIONS, lineSceneCards } from "@/e2e/support/selector";

/** three.js prefixes its own output, and Chromium names WebGL in its notices. */
const SCENE_DIAGNOSTIC = /THREE\.|WebGL/;

/** Observes unexplained three.js and WebGL notices for the page program. */
const withObservedSceneDiagnostics = Effect.fn(
  "NakafaE2E.withObservedSceneDiagnostics"
)(function* <A, E, R>(
  page: Page,
  use: Effect.Effect<A, E, R>
): Effect.fn.Return<A, E, R> {
  return yield* withObservedEvents(
    (record) => {
      const listener = (message: ConsoleMessage) => {
        const text = message.text();
        if (SCENE_DIAGNOSTIC.test(text) && !isKnownSceneDiagnostic(text)) {
          record(`${message.type()}: ${text}`);
        }
      };
      page.on("console", listener);
      return () => page.off("console", listener);
    },
    (diagnostics) =>
      use.pipe(
        Effect.tap(() =>
          Effect.map(diagnostics, (seen) => expect(seen).toEqual([]))
        )
      )
  );
});

/** Opens the pinned lesson and returns its deferred line-scene cards. */
const openLessonScenes = Effect.fn("NakafaE2E.openLessonScenes")(function* (
  page: Page
) {
  yield* openRoute(page, pinnedRoutes.material.en, "denied");

  const cards = lineSceneCards(page);
  const count = yield* Effect.promise(() => cards.count());
  yield* Effect.sync(() => expect(count).toBeGreaterThan(0));
  return { cards, count };
});

/**
 * Mounts and settles every deferred line scene of the pinned lesson, and
 * proves no page script read pixels back from a scene meanwhile.
 */
const renderLessonScenes = Effect.fn("NakafaE2E.renderLessonScenes")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.addInitScript(patchWebGL, recordPixelReadbacks)
  );
  const { cards, count } = yield* openLessonScenes(page);
  for (let index = 0; index < count; index += 1) {
    yield* revealLineScene(cards.nth(index));
  }
  const readbacks = yield* Effect.promise(() =>
    page.evaluate((key) => Reflect.get(window, key), PIXEL_READBACKS)
  );
  yield* Effect.sync(() => expect(readbacks).toEqual([]));
});

/** Proves a rotating scene stops far from the viewport and resumes in view. */
const pauseSceneAway = Effect.fn("NakafaE2E.pauseSceneAway")(function* (
  page: Page
) {
  yield* Effect.promise(() =>
    page.addInitScript(patchWebGL, countCanvasFrames)
  );
  const { cards } = yield* openLessonScenes(page);
  const card = cards.first();
  const canvas = yield* revealLineScene(card);
  const rotation = card
    .locator(SCENE_ACTIONS)
    .getByRole("button", { name: "Play" });

  // Automatic rotation draws every frame, like an animated lab.
  yield* Effect.promise(() => rotation.click());
  yield* Effect.promise(() =>
    expect(rotation).toHaveAttribute("aria-pressed", "true")
  );
  yield* expectFramesToAdvance(canvas);

  yield* Effect.promise(() =>
    page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight)
    )
  );
  const distance = yield* Effect.promise(() =>
    canvas.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return Math.max(-bounds.bottom, bounds.top - window.innerHeight);
    })
  );
  yield* Effect.sync(() =>
    expect(distance).toBeGreaterThan(THREE_RENDER_MARGIN)
  );
  yield* expectFramesToHold(canvas);

  yield* Effect.promise(() => canvas.scrollIntoViewIfNeeded());
  yield* expectFramesToAdvance(canvas);
  const resumed = yield* Effect.promise(() => canvas.screenshot());
  yield* expectCanvasToMove(canvas, resumed);
});

for (const width of [390, 1440]) {
  test.describe(`lesson scenes at ${width}px`, () => {
    test.use({ viewport: { height: 900, width } });

    test("render without unexplained three.js or WebGL notices", async ({
      page,
    }) => {
      await Effect.runPromise(
        withObservedPageErrors(
          page,
          withObservedSceneDiagnostics(page, renderLessonScenes(page))
        )
      );
    });

    test("pause far from the viewport and resume in view", async ({ page }) => {
      await Effect.runPromise(
        withObservedPageErrors(page, pauseSceneAway(page))
      );
    });
  });
}
