import { Array as Arr, Effect } from "effect";

/**
 * Completes once an element comes within `margin` of the screen, above or below
 * it, as a share of the screen's height such as `"50%"`. A part of a long page
 * waits here before it loads what the reader has not reached. The watcher stops
 * when the wait completes or is interrupted.
 */
export const untilNearScreen = (element: Element, margin: string) =>
  Effect.callback<void>((resume) => {
    const watcher = new IntersectionObserver(
      (entries) => {
        if (Arr.some(entries, ({ isIntersecting }) => isIntersecting)) {
          watcher.disconnect();
          resume(Effect.void);
        }
      },
      { rootMargin: `${margin} 0px` }
    );
    watcher.observe(element);
    return Effect.sync(() => watcher.disconnect());
  });

/**
 * Completes once an element stands wholly under the screen: a box that appears
 * or goes there moves nothing the reader sees. The browser reports the element's
 * place as soon as it is watched, so an element already under the screen
 * completes at once, and one on the screen or above it completes when the reader
 * scrolls it back under. The watcher stops when the wait completes or is
 * interrupted.
 */
export const untilBelowScreen = (element: Element) =>
  Effect.callback<void>((resume) => {
    const watcher = new IntersectionObserver((entries) => {
      if (
        Arr.some(
          entries,
          ({ boundingClientRect, isIntersecting }) =>
            !isIntersecting && boundingClientRect.top >= window.innerHeight
        )
      ) {
        watcher.disconnect();
        resume(Effect.void);
      }
    });
    watcher.observe(element);
    return Effect.sync(() => watcher.disconnect());
  });
