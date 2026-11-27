import { Array as Arr } from "effect";

/**
 * A heap of a broken solid on the floor of a vessel: marble chips, zinc
 * granules or a powder. The pieces lie in a loose spiral about the middle
 * of the floor, each turned and squashed its own way, and the same heap is
 * drawn every time, so a lesson's picture never changes between visits.
 */

/** The golden angle, by which each piece is turned on from the last. */
const TURN = 2.4;

/**
 * Where each piece of a heap lies, how it is turned and how it is squashed.
 *
 * @param count - How many pieces there are
 * @param size - How large a piece is across, in metres
 */
export function heapOf(count: number, size: number) {
  return Arr.makeBy(Math.max(0, count), (index) => {
    const angle = index * TURN;
    const radius = 0.006 + ((index * 7) % 10) * 0.0028;
    return {
      at: [
        Math.cos(angle) * radius,
        size * 0.4,
        Math.sin(angle) * radius,
      ] as const,
      scale: [1, 0.72 + (index % 3) * 0.12, 0.85] as const,
      turn: [index * 1.3, index * 2.1, index * 0.7] as const,
    };
  });
}
