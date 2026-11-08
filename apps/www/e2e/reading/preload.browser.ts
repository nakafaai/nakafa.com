import { expect, type Request, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { waitForQuiet } from "@/e2e/support/quiet";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The folder of the static answers that a page reads for another page's content. */
const STATIC_ANSWER = "/_data/";

/**
 * A reader who asked the browser to save data loads no neighbouring lesson
 * before they show intent: the page warms no link for them (`warmLinks` in
 * `lib/routing/warm.ts`, which warms the links on screen once a page settled for
 * every other reader), and the pagination loads the next lesson's content on
 * hover, focus or touch, never when the page is drawn.
 */
test("a lesson loads its next lesson for a reader who saves data only when they reach for it", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() =>
          page.addInitScript(() => {
            // A connection that asks to save data, which still tells of its changes.
            const connection = Object.assign(new EventTarget(), {
              downlink: 10,
              effectiveType: "4g",
              rtt: 50,
              saveData: true,
            });
            Object.defineProperty(navigator, "connection", {
              configurable: true,
              get: () => connection,
            });
          })
        );
        const answers = MutableList.make<string>();
        page.on("request", (request: Request) => {
          if (request.url().includes(STATIC_ANSWER)) {
            MutableList.append(answers, request.url());
          }
        });
        yield* Effect.promise(() => page.goto(pinnedRoutes.material.en));
        const next = page
          .getByRole("navigation", { name: "Pagination navigation" })
          .getByRole("link")
          .last();
        yield* Effect.promise(() => waitUntilTakenOver(next));
        yield* Effect.promise(() => next.scrollIntoViewIfNeeded());
        // A page drawn and scrolled to its end still asks for nothing more once it has gone quiet.
        yield* Effect.promise(() => waitForQuiet(page));
        yield* Effect.sync(() =>
          expect(MutableList.toArray(answers)).toEqual([])
        );

        yield* Effect.promise(() => next.hover());
        yield* Effect.promise(() =>
          expect
            .poll(() => MutableList.toArray(answers).length, {
              timeout: readinessTimeoutMilliseconds,
            })
            .toBeGreaterThan(0)
        );
      })
    )
  );
});
