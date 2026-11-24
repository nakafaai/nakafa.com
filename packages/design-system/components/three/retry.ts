import { Array as Arr, Duration, Effect, Option } from "effect";

/**
 * Backoff delays (in milliseconds) between failed WebGL context creation
 * attempts before showing the scene fallback. Two delays paired with the
 * initial attempt match `SCENE_STARTS = 3`.
 */
export const SCENE_RETRY_DELAYS = [150, 400] as const;

/**
 * Returns the backoff delay in milliseconds after a failed attempt (1-indexed),
 * or `Option.none()` once retries are exhausted.
 */
export function retryDelayMillis(attempt: number): Option.Option<number> {
  if (attempt < 1) {
    return Option.none();
  }
  return Arr.get(SCENE_RETRY_DELAYS, attempt - 1);
}

/**
 * Sleeps for the backoff delay matching `attempt` and returns `true`, or
 * immediately returns `false` when no retries remain.
 */
export const waitRetryDelay = Effect.fn("designSystem.three.waitRetryDelay")(
  function* (attempt: number) {
    const delay = retryDelayMillis(attempt);
    if (Option.isNone(delay)) {
      return false;
    }
    yield* Effect.sleep(Duration.millis(delay.value));
    return true;
  }
);
