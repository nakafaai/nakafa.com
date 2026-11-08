import type { ConsoleMessage, Page } from "@playwright/test";
import { Effect } from "effect";
import { withObservedEvents } from "@/e2e/support/observe";

/**
 * Chrome reports a preload the page never used three seconds after the
 * window's load event, or after the preload when it came later; the margin
 * covers the report's own way to the console.
 */
const UNUSED_PRELOAD_REPORTED_MILLISECONDS = 3500;
const UNUSED_PRELOAD_WARNING = "was preloaded using link preload but not used";

/**
 * Waits until Chrome would have reported every preload of the page that it
 * never used: `UNUSED_PRELOAD_REPORTED_MILLISECONDS` after the later of the
 * load event and the newest preload. The page serializes this function.
 */
function preloadsReported(reported: number) {
  const [navigation] = performance.getEntriesByType("navigation");
  if (
    !(navigation instanceof PerformanceNavigationTiming) ||
    navigation.loadEventEnd === 0
  ) {
    return false;
  }
  const preloads = performance
    .getEntriesByType("resource")
    .filter(
      (entry) =>
        entry instanceof PerformanceResourceTiming &&
        entry.initiatorType === "link"
    )
    .map((entry) => entry.startTime);
  return (
    performance.now() - Math.max(navigation.loadEventEnd, ...preloads) >=
    reported
  );
}

/**
 * Runs one page interaction, waits until Chrome would have reported a preload
 * the page never used, and returns those reports.
 */
export const collectUnusedPreloads = Effect.fn(
  "NakafaE2E.collectUnusedPreloads"
)(function* <A, E, R>(page: Page, interaction: Effect.Effect<A, E, R>) {
  return yield* withObservedEvents(
    (record) => {
      const listener = (message: ConsoleMessage) => {
        if (message.text().includes(UNUSED_PRELOAD_WARNING)) {
          record(message.text());
        }
      };
      page.on("console", listener);
      return () => page.off("console", listener);
    },
    (warnings) =>
      Effect.andThen(
        interaction,
        Effect.promise(() =>
          page.waitForFunction(
            preloadsReported,
            UNUSED_PRELOAD_REPORTED_MILLISECONDS,
            { polling: 100, timeout: 0 }
          )
        )
      ).pipe(Effect.andThen(warnings))
  );
});
