import { Duration, Effect } from "effect";

/**
 * The longest the baseline waits for an idle browser turn. A page that never
 * goes idle still starts the baseline once this has passed. Half a second is
 * past the first paint, so the analytics SDK stays off the paint's critical
 * path, and only a visit shorter than that goes uncounted.
 */
const IDLE_TIMEOUT = Duration.millis(500);

/**
 * Where the browser has no idle callback (Safari on iPhone and iPad), the
 * baseline starts after the same half second.
 */
const FALLBACK_DELAY = IDLE_TIMEOUT;

/**
 * Completes at the browser's next idle period, or at the timeout, whichever
 * comes first. Interrupting the wait cancels the pending idle callback. The
 * check runs when the effect runs, so importing this module never touches the
 * server's missing `window`.
 */
export const untilBrowserIdle = Effect.suspend(() => {
  if (!("requestIdleCallback" in window)) {
    return Effect.sleep(FALLBACK_DELAY);
  }
  return Effect.callback<void>((resume) => {
    const handle = window.requestIdleCallback(() => resume(Effect.void), {
      timeout: Duration.toMillis(IDLE_TIMEOUT),
    });
    return Effect.sync(() => window.cancelIdleCallback(handle));
  });
});
