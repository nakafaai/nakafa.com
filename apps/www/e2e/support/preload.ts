import type { ConsoleMessage, Page } from "@playwright/test";
import { Duration, Effect } from "effect";
import { withObservedEvents } from "@/e2e/support/observe";

// Chrome reports a preload the page never used a few seconds after loading.
const UNUSED_PRELOAD_SETTLE = Duration.millis(5000);
const UNUSED_PRELOAD_WARNING = "was preloaded using link preload but not used";

/**
 * Runs one page interaction, waits until Chrome would report a preload the
 * page never used, and returns those reports.
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
      Effect.andThen(interaction, Effect.sleep(UNUSED_PRELOAD_SETTLE)).pipe(
        Effect.as(warnings)
      )
  );
});
