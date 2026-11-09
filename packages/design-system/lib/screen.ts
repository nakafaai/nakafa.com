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
