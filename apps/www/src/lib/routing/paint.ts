import { Effect } from "effect";

/** How long a move waits for a frame, which a hidden page never draws. */
const FRAME_LIMIT = "100 millis";

/** The next frame, then the task after it, which runs once that frame has painted. */
const nextPaint = Effect.callback<void>((resume) => {
  const frame = requestAnimationFrame(() => resume(Effect.void));
  return Effect.sync(() => cancelAnimationFrame(frame));
}).pipe(Effect.andThen(Effect.sleep(0)));

/**
 * Lets the browser paint a press before the next page renders. A press runs the
 * router's loads in microtasks of its own task, and a preloaded page commits there
 * too, so a phone shows nothing until the whole page has rendered and the press
 * reads as a slow interaction. Waiting here hands the frame back first: the press
 * and the links that follow the address paint, then the page renders.
 */
export const paintFirst = () =>
  typeof document === "undefined"
    ? undefined
    : Effect.runPromise(
        nextPaint.pipe(Effect.raceFirst(Effect.sleep(FRAME_LIMIT)))
      );
