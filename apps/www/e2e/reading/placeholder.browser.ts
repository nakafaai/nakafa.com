import { expect, test } from "@playwright/test";
import { Effect, Schema } from "effect";
import { seedAnalyticsConsent } from "@/e2e/support/consent";
import { pinnedRoutes } from "@/e2e/support/corpus";
import { withObservedPageErrors } from "@/e2e/support/observe";
import { readinessTimeoutMilliseconds } from "@/e2e/support/timeout";

/** What one code block reports: the height it stands in at before it draws, and the height it draws at. */
const CodeHeights = Schema.Array(
  Schema.Struct({ drawn: Schema.Finite, standIn: Schema.String })
);

/**
 * A code block the reader has not reached yet is skipped and stands in at the
 * height of its lines, so the page under it never moves once it draws. The
 * check reads each block's stand-in height, then draws every block and reads
 * the height each takes.
 */
for (const width of [390, 1440]) {
  test(`every code block of a page stands in at the height it draws at, at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ height: 900, width });
    await Effect.runPromise(
      withObservedPageErrors(
        page,
        Effect.gen(function* () {
          yield* seedAnalyticsConsent(page, "denied");
          yield* Effect.promise(() => page.goto(pinnedRoutes.code.en));
          const blocks = page.locator(".content-auto-code");
          yield* Effect.promise(() =>
            expect(blocks.first()).toBeAttached({
              timeout: readinessTimeoutMilliseconds,
            })
          );
          const heights = yield* Effect.promise(() =>
            blocks.evaluateAll(async (elements) => {
              const standIns = elements.map(
                (element) => getComputedStyle(element).containIntrinsicHeight
              );
              // Every block draws, and two frames later each has its own height.
              for (const element of elements) {
                if (element instanceof HTMLElement) {
                  element.style.contentVisibility = "visible";
                }
              }
              await new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve))
              );
              return elements.map((element, index) => ({
                drawn: Math.round(element.getBoundingClientRect().height),
                standIn: standIns[index],
              }));
            })
          ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(CodeHeights)));
          yield* Effect.sync(() => {
            expect(heights.length).toBeGreaterThan(0);
            for (const { drawn, standIn } of heights) {
              expect(standIn).toBe(`auto ${drawn}px`);
            }
          });
        })
      )
    );
  });
}
