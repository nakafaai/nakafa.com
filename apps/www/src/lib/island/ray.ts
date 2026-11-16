import { HEIGHT, SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { KIND, LOOK } from "@/lib/island/look";
import { blockAt, type Cells } from "@/lib/island/world";

/** A point or a direction in the world. */
type Vector = readonly [number, number, number];

/** The three axes, x, y and z. */
const AXES = [0, 1, 2] as const;

/** The far corner of the world's box. */
const HIGH: Vector = [SPAN, HEIGHT, SPAN];

/**
 * Where a ray enters and leaves the world's box, as distances along it, and the
 * axis of the face it enters through (-1 when it starts inside); none when it
 * misses the box (the slab test).
 */
export function clipToWorld(origin: Vector, direction: Vector) {
  let enter = 0;
  let exit = Number.POSITIVE_INFINITY;
  let side = -1;
  for (const axis of AXES) {
    if (direction[axis] === 0) {
      if (origin[axis] < 0 || origin[axis] > HIGH[axis]) {
        return Option.none();
      }
      continue;
    }
    const a = -origin[axis] / direction[axis];
    const b = (HIGH[axis] - origin[axis]) / direction[axis];
    if (Math.min(a, b) > enter) {
      enter = Math.min(a, b);
      side = axis;
    }
    exit = Math.min(exit, Math.max(a, b));
  }
  return enter <= exit ? Option.some({ enter, exit, side }) : Option.none();
}

/** The axis whose next boundary is nearest. */
function nearestAxis(next: readonly number[]) {
  if (next[0] < next[1]) {
    return next[0] < next[2] ? 0 : 2;
  }
  return next[1] < next[2] ? 1 : 2;
}

/**
 * The first block a ray from `origin` along `direction` meets (ADR 0047, D5):
 * the cell it hit, and the cell in front of the face it entered through, where
 * a new block goes. Water counts as a hit, so a block placed on the sea sits on
 * its surface. Cells are walked one boundary at a time (Amanatides and Woo), so
 * a ray never skips a corner.
 */
export function castRay(cells: Cells, origin: Vector, direction: Vector) {
  return Option.flatMap(
    clipToWorld(origin, direction),
    ({ enter, exit, side }) => {
      const start = Arr.map(
        AXES,
        (axis) => origin[axis] + direction[axis] * enter
      );
      const step = Arr.map(AXES, (axis) => Math.sign(direction[axis]));
      const cell = Arr.map(AXES, (axis) =>
        Math.min(Math.floor(start[axis]), HIGH[axis] - 1)
      );
      const delta = Arr.map(AXES, (axis) => Math.abs(1 / direction[axis]));
      const next = Arr.map(AXES, (axis) => {
        const boundary = step[axis] > 0 ? cell[axis] + 1 : cell[axis];
        return step[axis] === 0
          ? Number.POSITIVE_INFINITY
          : enter + (boundary - start[axis]) / direction[axis];
      });
      let previous: Vector = [
        cell[0] - (side === 0 ? step[0] : 0),
        cell[1] - (side === 1 ? step[1] : 0),
        cell[2] - (side === 2 ? step[2] : 0),
      ];
      let travelled = enter;
      while (travelled <= exit) {
        const here: Vector = [cell[0], cell[1], cell[2]];
        const block = blockAt(cells, ...here);
        if (LOOK.kinds[block] !== KIND.air) {
          return Option.some({ block, hit: here, place: previous });
        }
        previous = here;
        const axis = nearestAxis(next);
        cell[axis] += step[axis];
        travelled = next[axis];
        next[axis] += delta[axis];
      }
      return Option.none();
    }
  );
}
