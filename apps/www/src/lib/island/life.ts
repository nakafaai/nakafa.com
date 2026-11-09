import type { Placement } from "@repo/backend/confect/island/layout";
import { Array as Arr, Match, Option, Record } from "effect";
import { piecesOf } from "@/lib/island/pieces";
import { VOXELS_PER_CELL } from "@/lib/island/terrain";

/** Where smoke leaves a drawing with a chimney: the middle of the chimney's top, in its grid's voxels. */
const CHIMNEYS: Record.ReadonlyRecord<
  string,
  readonly [number, number, number]
> = {
  "house:1": [11, 20, 4],
};

/** Seconds a puff of smoke takes to rise and fade, and how many rise at once. */
const PUFF_LIFE = 3.6;
export const PUFFS_PER_CHIMNEY = 3;

/** How many frames a puff grows and fades through. */
const PUFF_FRAMES = 3;

/**
 * The world point where each chimney of a layout smokes: the chimney's top
 * turned and set the way the piece's mesh is, so the smoke stays on the
 * chimney at every turn of the house.
 */
export function chimneysOf(layout: readonly Placement[]) {
  return Arr.getSomes(
    Arr.map(piecesOf(layout), (piece) =>
      Option.map(Record.get(CHIMNEYS, piece.key), ([vx, vy, vz]) => {
        const [px, py, pz] = piece.pivot;
        const [cx, cy, cz] = piece.center;
        const x = (vx - px) / VOXELS_PER_CELL;
        const z = (vz - pz) / VOXELS_PER_CELL;
        const cos = Math.cos(piece.angle);
        const sin = Math.sin(piece.angle);
        return {
          x: cx + x * cos + z * sin,
          y: cy + (vy - py) / VOXELS_PER_CELL,
          z: cz - x * sin + z * cos,
        };
      })
    )
  );
}

/**
 * One puff of a chimney's smoke at a moment: it rises and drifts with the wind
 * over its life, growing through its frames, and the puffs of one chimney start
 * a third of a life apart.
 */
export function puffAt(
  chimney: ReturnType<typeof chimneysOf>[number],
  index: number,
  time: number
) {
  const age =
    ((time + (index * PUFF_LIFE) / PUFFS_PER_CHIMNEY) % PUFF_LIFE) / PUFF_LIFE;
  return {
    frame: Math.min(PUFF_FRAMES - 1, Math.floor(age * PUFF_FRAMES)),
    x: chimney.x + age * 0.3,
    y: chimney.y + age * 0.9,
    z: chimney.z,
  };
}

/** The places fireflies take round one plant, at most three. */
const FLY_SLOTS = [0, 1, 2] as const;

/** Fireflies around each grown tree, bush and bed of flowers, with where in its dance each starts. */
export function firefliesOf(layout: readonly Placement[]) {
  return Arr.flatMap(layout, (placement, at) => {
    const count = Match.value(placement.item).pipe(
      Match.whenOr("bush", "flowers", () => 1),
      Match.when("tree", () => (placement.stage >= 2 ? 3 : 0)),
      Match.orElse(() => 0)
    );
    return Arr.map(Arr.take(FLY_SLOTS, count), (index) => ({
      phase: (at * 0.37 + index * 0.29) % 1,
      x: placement.x + 0.5,
      y: placement.z + 0.4 + index * 0.35,
      z: placement.y + 0.5,
    }));
  });
}

/** A firefly at a moment: it wanders a little round its plant and blinks now and then. */
export function flyAt(
  fly: ReturnType<typeof firefliesOf>[number],
  time: number
) {
  const turn = fly.phase * Math.PI * 2;
  return {
    glowing: Math.sin(time * 2 + turn * 3) > -0.4,
    x: fly.x + 0.4 * Math.sin(time * 0.7 + turn),
    y: fly.y + 0.12 * Math.sin(time * 1.3 + turn * 2),
    z: fly.z + 0.4 * Math.cos(time * 0.5 + turn * 1.5),
  };
}
