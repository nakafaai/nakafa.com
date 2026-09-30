import type { ConsoleMessage, Page } from "@playwright/test";
import { Duration, Effect } from "effect";

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
  const warnings: string[] = [];
  const record = (message: ConsoleMessage) => {
    if (message.text().includes(UNUSED_PRELOAD_WARNING)) {
      warnings.push(message.text());
    }
  };
  yield* Effect.acquireUseRelease(
    Effect.sync(() => page.on("console", record)),
    () => Effect.andThen(interaction, Effect.sleep(UNUSED_PRELOAD_SETTLE)),
    () => Effect.sync(() => page.off("console", record))
  );
  return warnings;
});
