/**
 * How long a decorative loop rests for each millisecond its frame took, which
 * leaves it an eighth of the main thread at most.
 */
const REST_PER_WORK = 7;

/**
 * Keeps one decorative loop to its share of the main thread on any device. A
 * fast device draws a frame in under a millisecond, so it draws every frame on
 * 60 Hz and 120 Hz screens alike. A slow phone takes twenty, so it draws about
 * six times a second, and the reader's scroll and press find the thread free.
 * The pace is measured and never guessed from a device's name: a phone that is
 * busy with something else slows the loop down too.
 *
 * A drawing costs its whole frame: the loop's own code, then the style, layout
 * and paint that its changes cost the browser. The rest starts once the frame
 * has painted, reusing one MessageChannel across frames so pacing allocates
 * nothing per frame. Call `stop()` when a loop ends to close the channel.
 */
export function createFramePace() {
  let nextAt = 0;
  let started = 0;
  let channel: MessageChannel | undefined;

  function ensureChannel() {
    if (channel !== undefined) {
      return channel;
    }
    const created = new MessageChannel();
    created.port1.onmessage = () => {
      const endedAt = performance.now();
      nextAt = endedAt + Math.max(0, endedAt - started) * REST_PER_WORK;
    };
    channel = created;
    return created;
  }

  return {
    /** Whether the loop may draw at this moment. */
    isDue: (now: number) => now >= nextAt,
    /** Rests the loop after a drawing that started at `startedAt`, by what its frame took once painted. */
    rest: (startedAt: number) => {
      nextAt = Number.POSITIVE_INFINITY;
      started = startedAt;
      ensureChannel().port2.postMessage(undefined);
    },
    /** Closes the reused pacing channel when the loop stops or unmounts. */
    stop: () => {
      if (channel === undefined) {
        return;
      }
      channel.port1.onmessage = null;
      channel.port1.close();
      channel.port2.close();
      channel = undefined;
      nextAt = 0;
    },
  };
}
