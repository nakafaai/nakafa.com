import { Array as Arr, Duration, Effect, MutableRef } from "effect";

/** The longest a settled page waits for an idle moment after its load. */
const SETTLE_TIMEOUT = Duration.seconds(1);

/** How long a settled page that nobody touches holds its decoration back. */
const UNTOUCHED_WAIT = Duration.seconds(10);

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

/** Whether the reader made a gesture since this document first asked for them. */
const readerGestured = MutableRef.make(false);

/** Whether this document already listens for its reader's first gesture. */
const gestureListened = MutableRef.make(false);

/**
 * Listens, once for the document, for the reader's first gesture and keeps it. A
 * picture that a press mounts, as a sheet's does, asks for its reader after the
 * press, so it reads this record. The browser's `navigator.userActivation`
 * cannot stand in for it: a navigation the browser starts itself, from its
 * address bar, Lighthouse or Playwright, is active from the first frame, so every
 * page started its analytics and its decoration with its first paint.
 */
const listenForGesture = Effect.sync(() => {
  if (MutableRef.get(gestureListened)) {
    return;
  }
  MutableRef.set(gestureListened, true);
  const gesture = () => {
    MutableRef.set(readerGestured, true);
    Arr.forEach(READER_GESTURES, (name) => {
      window.removeEventListener(name, gesture, { capture: true });
    });
  };
  Arr.forEach(READER_GESTURES, (name) => {
    window.addEventListener(name, gesture, { capture: true, passive: true });
  });
});

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

/** Completes at the reader's first gesture anywhere on the page, and stops listening. */
const untilGesture = Effect.callback<void>((resume) => {
  const stop = () => {
    Arr.forEach(READER_GESTURES, (name) => {
      window.removeEventListener(name, gesture, { capture: true });
    });
  };
  const gesture = () => {
    stop();
    resume(Effect.void);
  };
  Arr.forEach(READER_GESTURES, (name) => {
    window.addEventListener(name, gesture, { capture: true, passive: true });
  });
  return Effect.sync(stop);
});

/**
 * Completes at the reader's first gesture, at once when they already made one since the document first asked or the
 * page already stands scrolled, and never on a page nobody touches. What only a reader's intent should load waits
 * here, such as a lesson's 3D scene, whose code is the largest part of the lesson's JavaScript: a crawler, Lighthouse
 * and a reader who never moves see its placeholder, and the first scroll, pointer move, touch or key brings it. A
 * page that stands scrolled when it first asks was scrolled by its reader before the app hydrated, or by the browser
 * restoring where they left it: a page that loads by itself starts at its top.
 */
export const untilReaderGesture = Effect.suspend(() =>
  MutableRef.get(readerGestured) || window.scrollY > 0
    ? Effect.void
    : listenForGesture.pipe(Effect.andThen(untilGesture))
);

/**
 * Completes once a settled page has its reader: at once when they already made a
 * gesture since the document first asked, else at the first gesture, or after ten
 * seconds without one, and then at the browser's next idle moment. A phone spends
 * those seconds on the page itself, and a picture that moves only for its own sake,
 * such as a page's particles, toys and Nina's life, waits here. A slow phone is still
 * hydrating and fetching a few seconds after the load, so the wait reaches well past
 * the five quiet seconds that mark a page as interactive after that: at six, the
 * particles landed inside the page's own loading and made half its blocking time.
 */
export const untilPageRead = Effect.suspend(() =>
  MutableRef.get(readerSeen)
    ? Effect.void
    : listenForGesture.pipe(
        Effect.andThen(untilPageSettled),
        Effect.andThen(
          Effect.suspend(() =>
            MutableRef.get(readerGestured)
              ? Effect.void
              : untilGesture.pipe(
                  Effect.timeoutOrElse({
                    duration: UNTOUCHED_WAIT,
                    orElse: () => Effect.void,
                  })
                )
          )
        ),
        Effect.andThen(untilIdle),
        Effect.andThen(Effect.sync(() => MutableRef.set(readerSeen, true)))
      )
);
