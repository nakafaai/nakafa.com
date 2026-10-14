import { expect, type Page, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { waitForCommittedAppRouter } from "@/e2e/support/navigation/readiness";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { appRoutes } from "@/e2e/support/route";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { touchViewport } from "@/e2e/support/viewport";

/** Pixels per second of the touch gesture that flings the surah. */
const FLING_SPEED = 12_000;

/** What each animation frame of a fling showed. */
const FlingFramesSchema = Schema.Struct({
  /** Frames on which the verse at the middle of the screen had no laid-out Arabic text. */
  blankFrames: Schema.Finite,
  /** Frames sampled from the first to the last one. */
  frames: Schema.Finite,
  /** Frames on which the document height differed from the frame before. */
  heightChanges: Schema.Finite,
  /** Whether the last frame sampled showed the end of the page. */
  reachedEnd: Schema.Boolean,
});

type FlingFrames = typeof FlingFramesSchema.Type;

/**
 * Samples every animation frame until the page has stayed at its end for half
 * a second. Each frame reads the document height and whether the verse at the
 * middle of the screen has its Arabic text laid out. It runs in the page, so
 * it uses no import.
 */
function sampleFlingFrames() {
  return new Promise<FlingFrames>((resolve) => {
    const startedAt = performance.now();
    let frames = 0;
    let blankFrames = 0;
    let heightChanges = 0;
    let reachedEnd = false;
    let lastHeight = -1;
    let lastTop = -1;
    let stillFrames = 0;

    const sample = () => {
      const height = document.documentElement.scrollHeight;
      if (lastHeight !== -1 && height !== lastHeight) {
        heightChanges += 1;
      }
      lastHeight = height;
      frames += 1;

      const middle = document.elementFromPoint(
        window.innerWidth / 2,
        window.innerHeight / 2
      );
      const arabic = middle
        ?.closest("[data-quran-verse]")
        ?.querySelector("[data-quran-arabic]");
      if (
        !(arabic instanceof HTMLElement) ||
        arabic.getBoundingClientRect().height === 0
      ) {
        blankFrames += 1;
      }

      const atEnd = window.innerHeight + window.scrollY >= height - 1;
      reachedEnd = atEnd;
      stillFrames = atEnd && window.scrollY === lastTop ? stillFrames + 1 : 0;
      lastTop = window.scrollY;

      if (stillFrames < 30 && performance.now() - startedAt < 100_000) {
        requestAnimationFrame(sample);
        return;
      }
      resolve({ blankFrames, frames, heightChanges, reachedEnd });
    };
    requestAnimationFrame(sample);
  });
}

/**
 * Flings a phone through a whole surah from its top to its end, the way a
 * finger does. Every animation frame of the fling must show the same document
 * height, and the verse at the middle of the screen must always be laid out.
 * A list that virtualizes its verses grows the page as the reader reaches
 * them, so the scroll bar moves under the finger.
 */
const verifySurahFling = Effect.fn("NakafaE2E.verifySurahFling")(function* (
  page: Page
) {
  yield* seedAnalyticsConsent(page, "denied");
  yield* Effect.promise(() => page.goto(appRoutes.quranSurah));
  yield* waitForCommittedAppRouter(
    page,
    appRoutes.quranSurah,
    appRoutes.quranSurah,
    readinessTimeoutMilliseconds
  );
  yield* Effect.promise(() => page.evaluate(() => document.fonts.ready));
  const height = yield* Effect.promise(() =>
    page.evaluate(() => document.documentElement.scrollHeight)
  );
  const session = yield* Effect.promise(() =>
    page.context().newCDPSession(page)
  );

  const sampling = page.evaluate(sampleFlingFrames);
  yield* Effect.promise(() =>
    session.send("Input.synthesizeScrollGesture", {
      gestureSourceType: "touch",
      preventFling: false,
      speed: FLING_SPEED,
      x: touchViewport.width / 2,
      y: touchViewport.height * 0.75,
      yDistance: -height,
    })
  );
  const frames = yield* Effect.promise(() => sampling);

  yield* Effect.sync(() => {
    expect(frames.frames).toBeGreaterThan(0);
    expect(frames.reachedEnd).toBe(true);
    expect(frames.heightChanges).toBe(0);
    expect(frames.blankFrames).toBe(0);
  });
});

test.describe("Phone surah fling", () => {
  test.use({
    hasTouch: touchViewport.hasTouch,
    viewport: { height: touchViewport.height, width: touchViewport.width },
  });

  test("keeps the page height and the middle verse still while a fling runs", async ({
    page,
  }) => {
    test.setTimeout(150_000);
    await Effect.runPromise(
      withObservedPageErrors(page, verifySurahFling(page))
    );
  });
});
