import { type CDPSession, expect, test } from "@playwright/test";
import { Array as Arr, Duration, Effect, Option } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** Nina's place, where a lesson whose comments are empty shows her, at the bottom of the lesson. */
const PLACE = 'footer:has(#comments) [data-slot="empty-icon"]';
/** Her picture in that place: the still one a server drew, then the one her life draws in its stead. */
const NINA = `${PLACE} svg`;

/** How long the reader does nothing while the page is measured. */
const IDLE = Duration.seconds(3);

/**
 * The most of the main thread a page may keep busy while its reader does
 * nothing, on a phone four times slower than the test machine. Nina's life
 * takes an eighth of it at most; when her pace timed only her code and not the
 * paint her moves cost, the bottom of a lesson kept four fifths of it busy.
 */
const IDLE_SHARE = 0.5;

/**
 * Counts each change of Nina's picture from now, under `nakafaNinaMoves`. It watches her place, not the picture in it:
 * her still picture stays until the page has its reader and her life has loaded, and her life then draws a picture of
 * its own in the same place, so a watch on the first picture would count nothing once it is gone. Only a change inside
 * a picture counts, so the handover itself is no move.
 */
function watchNina(selector: string) {
  const moves = { count: 0 };
  Reflect.set(window, "nakafaNinaMoves", moves);
  const place = document.querySelector(selector);
  if (place !== null) {
    new MutationObserver((records) => {
      for (const record of records) {
        if (record.target instanceof SVGElement) {
          moves.count += 1;
        }
      }
    }).observe(place, { attributes: true, subtree: true });
  }
}

/** How many changes Nina's picture made since `watchNina`. */
const readMoves = () =>
  Number(
    Reflect.get(Reflect.get(window, "nakafaNinaMoves") ?? {}, "count") ?? 0
  );

/**
 * The main thread's busy seconds and the clock, as Chromium counts them. A
 * metric Chromium does not report fails the test.
 */
const readMetrics = Effect.fn("NakafaE2E.readIdleMetrics")(function* (
  cdp: CDPSession
) {
  const { metrics } = yield* Effect.promise(() =>
    cdp.send("Performance.getMetrics")
  );
  const read = (name: string) =>
    Arr.findFirst(metrics, (metric) => metric.name === name).pipe(
      Option.map((metric) => metric.value),
      Effect.fromOption,
      Effect.orDie
    );
  return { at: yield* read("Timestamp"), busy: yield* read("TaskDuration") };
});

test.describe("an idle lesson on a phone", () => {
  test.use({ viewport: { height: 844, width: 390 } });

  test("leaves the main thread free while Nina lives over its empty comments", async ({
    page,
  }) => {
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* seedAnalyticsConsent(page, "denied");
          const cdp = yield* Effect.promise(() =>
            page.context().newCDPSession(page)
          );
          yield* Effect.promise(() => cdp.send("Performance.enable"));
          yield* Effect.promise(() =>
            cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
          );
          yield* Effect.promise(async () => {
            await page.goto(pinnedRoutes.inverse.en);
            await page
              .locator("footer:has(#comments)")
              .scrollIntoViewIfNeeded();
            await expect(page.locator(NINA)).toBeVisible({
              timeout: readinessTimeoutMilliseconds,
            });
            await page.evaluate(watchNina, PLACE);
            // Her life starts once the page has settled.
            await expect
              .poll(() => page.evaluate(readMoves), {
                timeout: readinessTimeoutMilliseconds,
              })
              .toBeGreaterThan(0);
          });

          const before = yield* readMetrics(cdp);
          const movesBefore = yield* Effect.promise(() =>
            page.evaluate(readMoves)
          );
          yield* Effect.sleep(IDLE);
          const after = yield* readMetrics(cdp);
          const movesAfter = yield* Effect.promise(() =>
            page.evaluate(readMoves)
          );

          yield* Effect.sync(() => {
            expect(movesAfter).toBeGreaterThan(movesBefore);
            expect(
              (after.busy - before.busy) / (after.at - before.at)
            ).toBeLessThan(IDLE_SHARE);
          });
        })
      )
    );
  });
});
