import { expect, type Request, test } from "@playwright/test";
import { Effect, MutableList } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The folder of the static answers that a page reads for another page's content. */
const STATIC_ANSWER = "/_data/";

/**
 * A lesson loads no neighbouring lesson before the reader shows intent: its
 * pagination loads the next lesson's content on hover, focus or touch, never
 * when the page is drawn.
 */
test("a lesson loads its next lesson only when the reader reaches for it", async ({
  page,
}) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
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
        // A page drawn and scrolled to its end still asks for nothing more.
        yield* Effect.promise(() => page.waitForTimeout(2000));
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
