import { expect, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";
import { waitUntilTakenOver } from "@/e2e/support/window";

/** The size of each layout shift that the page recorded. */
const Shifts = Schema.Array(Schema.Finite);

/** Records every layout shift that no input caused, from the first paint on. */
function recordShifts() {
  const shifts: number[] = [];
  Object.assign(window, { nakafaShifts: shifts });
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!("hadRecentInput" in entry && entry.hadRecentInput)) {
        shifts.push("value" in entry ? Number(entry.value) : 0);
      }
    }
  }).observe({ buffered: true, type: "layout-shift" });
}

/**
 * Moving to the next lesson draws nothing in a place it must leave. The body
 * of the new lesson arrives a moment after the page around it, so its
 * pagination and footer wait for it instead of standing in its place and being
 * pushed down. A phone four times slower than this machine makes the moment
 * long enough to see.
 */
test("the next lesson moves nothing while its body arrives", async ({
  page,
}) => {
  await page.setViewportSize({ height: 844, width: 390 });
  await Effect.runPromise(
    withObservedPageErrors(
      page,
      Effect.gen(function* () {
        yield* seedAnalyticsConsent(page, "denied");
        yield* Effect.promise(() => page.addInitScript(recordShifts));
        const cdp = yield* Effect.promise(() =>
          page.context().newCDPSession(page)
        );
        yield* Effect.promise(() =>
          cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 })
        );
        yield* Effect.promise(() => page.goto(pinnedRoutes.material.en));
        const next = page
          .getByRole("navigation", { name: "Pagination navigation" })
          .getByRole("link")
          .last();
        yield* Effect.promise(() => waitUntilTakenOver(next));
        yield* Effect.promise(() => next.scrollIntoViewIfNeeded());
        const href = yield* Effect.promise(() => next.getAttribute("href"));
        const target = new URL(href ?? "", page.url()).pathname;
        // Only the shifts after the press count, so the list starts empty here.
        yield* Effect.promise(() =>
          page.evaluate(() => {
            Reflect.get(window, "nakafaShifts").splice(0);
          })
        );
        yield* Effect.promise(() => next.click());
        yield* Effect.promise(() =>
          expect(page).toHaveURL((url) => url.pathname === target, {
            timeout: readinessTimeoutMilliseconds,
          })
        );
        yield* Effect.promise(() =>
          expect(page.locator("article").first()).not.toBeEmpty({
            timeout: readinessTimeoutMilliseconds,
          })
        );
        // The parts below the body settle within a moment of it.
        yield* Effect.promise(() => page.waitForTimeout(2000));
        const shifts = yield* Effect.promise(() =>
          page.evaluate(() => Reflect.get(window, "nakafaShifts"))
        ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(Shifts)));
        yield* Effect.sync(() => expect(shifts).toEqual([]));
      })
    )
  );
});
