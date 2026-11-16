import { SPAN } from "@repo/backend/confect/island/world";
import { HashSet, MutableHashSet } from "effect";
import { KIND, LOOK } from "@/lib/island/look";
import { type Cells, CHUNK, CHUNKS } from "@/lib/island/world";

/** The six neighbours of a cell, as steps of its index. */
const STEPS = [1, -1, SPAN, -SPAN, SPAN * SPAN, -SPAN * SPAN] as const;

/**
 * The lamp light of every cell, from 0 to 15 (ADR 0047, D3): each glowing block
 * lights its own cell, and light spreads one step at a time through every cell
 * a solid block does not fill, one level dimmer with each step, the way a
 * lantern lights a room and stops at its walls.
 */
export function glowOf(cells: Cells) {
  const glow = new Uint8Array(cells.length);
  const queue = new Int32Array(cells.length);
  let head = 0;
  let tail = 0;
  for (let cell = 0; cell < cells.length; cell += 1) {
    const level = LOOK.glows[cells[cell]];
    if (level > 0) {
      glow[cell] = level;
      queue[tail] = cell;
      tail += 1;
    }
  }
  while (head < tail) {
    const cell = queue[head];
    head += 1;
    const next = glow[cell] - 1;
    if (next <= 0) {
      continue;
    }
    const x = cell % SPAN;
    const z = Math.floor(cell / SPAN) % SPAN;
    for (const step of STEPS) {
      const target = cell + step;
      const wraps =
        (step === 1 && x === SPAN - 1) ||
        (step === -1 && x === 0) ||
        (step === SPAN && z === SPAN - 1) ||
        (step === -SPAN && z === 0);
      if (
        wraps ||
        target < 0 ||
        target >= cells.length ||
        LOOK.kinds[cells[target]] === KIND.solid ||
        glow[target] >= next
      ) {
        continue;
      }
      glow[target] = next;
      queue[tail] = target;
      tail += 1;
    }
  }
  return glow;
}

/** The chunks, by index, whose lamp light differs between two lightings of the same world. */
export function changedChunks(before: Uint8Array, after: Uint8Array) {
  const changed = MutableHashSet.empty<number>();
  for (let cell = 0; cell < after.length; cell += 1) {
    if (before[cell] !== after[cell]) {
      const x = cell % SPAN;
      const z = Math.floor(cell / SPAN) % SPAN;
      MutableHashSet.add(
        changed,
        Math.floor(z / CHUNK) * CHUNKS + Math.floor(x / CHUNK)
      );
    }
  }
  return HashSet.fromIterable(changed);
}
