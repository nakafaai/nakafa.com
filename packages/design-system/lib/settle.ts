import { Duration, Effect } from "effect";

/** The longest a settled page waits for an idle moment after its load. */
const SETTLE_TIMEOUT = Duration.seconds(1);

/** Completes once the window's load event has fired. */
const untilPageLoaded = Effect.suspend(() =>
  document.readyState === "complete"
    ? Effect.void
    : Effect.callback<void>((resume) => {
        const loaded = () => resume(Effect.void);
        window.addEventListener("load", loaded, { once: true });
        return Effect.sync(() => window.removeEventListener("load", loaded));
      })
);

/** Completes at the browser's next idle moment, or at once where it has no idle callback. */
const untilIdle = Effect.suspend(() =>
  "requestIdleCallback" in window
    ? Effect.callback<void>((resume) => {
        const handle = window.requestIdleCallback(() => resume(Effect.void), {
          timeout: Duration.toMillis(SETTLE_TIMEOUT),
        });
        return Effect.sync(() => window.cancelIdleCallback(handle));
      })
    : Effect.void
);

/**
 * Completes once the page has loaded and the browser has an idle moment after
 * it, or a second after the load on a page that never goes idle. Motion that no
 * first frame needs, such as a page's toys, waits for it and never competes
 * with the page's own loading. Interrupting the wait removes what it listens to.
 */
export const untilPageSettled = Effect.andThen(untilPageLoaded, untilIdle);
