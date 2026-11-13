/**
 * How long a decorative loop rests for each millisecond its frame took, which
 * leaves it an eighth of the main thread at most.
 */
const REST_PER_WORK = 7;

/**
 * Keeps one decorative loop to its share of the main thread on any device. A
 * fast device draws a frame in under two milliseconds, so it draws every frame.
 * A slow phone takes twenty, so it draws about six times a second, and the
 * reader's scroll and press find the thread free. The pace is measured and never
 * guessed from a device's name: a phone that is busy with something else slows
 * the loop down too. A page whose loops took every frame never went idle on a
 * slow phone at all.
 *
 * A drawing costs its whole frame: the loop's own code, then the style, layout
 * and paint that its changes cost the browser. Nina moves her SVG paths in about
 * a millisecond of code and pays several times that to paint them, so a pace
 * that timed only the code let her repaint every frame, and the bottom of a
 * lesson kept a phone's main thread four fifths busy while the reader did
 * nothing. So the rest starts once the frame has painted: a message posted while
 * the frame runs arrives after the browser has rendered it, and until then the
 * loop holds.
 */
export function createFramePace() {
  let nextAt = 0;
  return {
    /** Whether the loop may draw at this moment. */
    isDue: (now: number) => now >= nextAt,
    /** Rests the loop after a drawing that started at `startedAt`, by what its frame took once painted. */
    rest: (startedAt: number) => {
      nextAt = Number.POSITIVE_INFINITY;
      const painted = new MessageChannel();
      painted.port1.onmessage = () => {
        painted.port1.close();
        const endedAt = performance.now();
        nextAt = endedAt + (endedAt - startedAt) * REST_PER_WORK;
      };
      painted.port2.postMessage(undefined);
    },
  };
}
