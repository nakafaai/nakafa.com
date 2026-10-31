import { Array as Arr, Duration, Effect, MutableRef } from "effect";

/** The longest a settled page waits for an idle moment after its load. */
const SETTLE_TIMEOUT = Duration.seconds(1);

/** How long a settled page that nobody touches holds its decoration back. */
const UNTOUCHED_WAIT = Duration.seconds(6);

/** The gestures that say a reader is on the page. */
const READER_GESTURES = [
  "keydown",
  "pointerdown",
  "pointermove",
  "scroll",
  "touchstart",
] as const;

/** Whether this document has already had its reader, so a later page starts its decoration at once. */
const readerSeen = MutableRef.make(false);

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

/** Completes at the reader's first gesture anywhere on the page. */
const untilGesture = Effect.callback<void>((resume) => {
  const gesture = () => resume(Effect.void);
  Arr.forEach(READER_GESTURES, (name) => {
    window.addEventListener(name, gesture, { capture: true, passive: true });
  });
  return Effect.sync(() => {
    Arr.forEach(READER_GESTURES, (name) => {
      window.removeEventListener(name, gesture, { capture: true });
    });
  });
});

/**
 * Completes once a settled page has its reader: at the first gesture, or after six
 * seconds without one, and then at the browser's next idle moment. A phone spends
 * those seconds on the page itself, and a picture that moves only for its own sake,
 * such as a page's particles, toys and Nina's life, waits here. The wait is longer
 * than the five quiet seconds that mark a page as interactive, so decoration never
 * counts as the page's own loading.
 */
export const untilPageRead = Effect.suspend(() =>
  MutableRef.get(readerSeen)
    ? Effect.void
    : untilPageSettled.pipe(
        Effect.andThen(
          Effect.raceFirst(untilGesture, Effect.sleep(UNTOUCHED_WAIT))
        ),
        Effect.andThen(untilIdle),
        Effect.andThen(Effect.sync(() => MutableRef.set(readerSeen, true)))
      )
);
