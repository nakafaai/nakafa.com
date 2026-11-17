import { idOf } from "@repo/backend/confect/island/blocks";
import { SPAN } from "@repo/backend/confect/island/world";
import {
  Array as Arr,
  Option,
  Order,
  Record as Rec,
  Result,
  Schema,
} from "effect";
import { LOOKS, ReefKind } from "@/lib/island/models/reef";
import { smoothOf, unitOf } from "@/lib/island/noise";
import { columnOf, DEEP, outOf } from "@/lib/island/terrain";
import { blockAt, type Cells, SEA_LEVEL } from "@/lib/island/world";

const SAND = idOf("sand");
const WATER = idOf("water");

/** Where the water's surface lies, where a lily pad floats. */
const SURFACE = SEA_LEVEL - 0.125;

/**
 * The reef's zones out from the shore (ADR 0047, D50), in cells past it, as
 * the sea floor's shelves lie (D43): a shelf of seagrass meadows and small
 * corals two blocks down, the reef crest on the step down to four, where
 * life is richest, and a fringe of kelp forest over the deep beyond it.
 */
const ZONES = { crest: 7, deep: 9, fringe: 15, shelf: 3 } as const;

/**
 * How many cells past the world's own cells the reef reaches. Out there the
 * sea floor is the deep plane the painter lays round the world, where the
 * kelp forest of the deep fringe grows.
 */
const BEYOND = 16;

/** One rooted or floating life of the reef: its kind and look, the floor or surface it stands on, and the way it is turned. */
const Spot = Schema.Struct({
  kind: ReefKind,
  look: Schema.Int,
  x: Schema.Finite,
  y: Schema.Finite,
  yaw: Schema.Finite,
  z: Schema.Finite,
});
type Spot = typeof Spot.Type;

/** A kind picked by a roll from a table of shares, in order, none when the roll passes them all. */
function pickOf(
  roll: number,
  table: readonly (readonly [ReefKind, number])[]
): Option.Option<ReefKind> {
  const reach = (index: number) =>
    Arr.reduce(Arr.take(table, index + 1), 0, (sum, [, share]) => sum + share);
  return Option.map(
    Arr.findFirst(
      Arr.map(table, ([kind], index) => ({ kind, reach: reach(index) })),
      (row) => roll < row.reach
    ),
    (row) => row.kind
  );
}

/** What grows on the deep fringe: patches of kelp forest, and a sponge or a fan between them. */
function fringeKind(seed: number, x: number, z: number, roll: number) {
  const forest = smoothOf(seed + 46, x, z, 7) > 0.5;
  return forest
    ? pickOf(roll, [["kelp", 0.26]])
    : pickOf(roll, [
        ["sponge", 0.04],
        ["fan", 0.03],
      ]);
}

/** What grows on a column of the world's own cells `out` cells past the shore, by its zone and the patch of floor it lies in. */
function kindAt(seed: number, x: number, z: number, out: number) {
  const roll = unitOf(seed + 44, x, 0, z);
  if (out < 0) {
    return pickOf(roll, [["lily", 0.42]]);
  }
  // The shoal nearer the shore than the shelf has no water over its sand, so nothing grows there and no column reaches here from it.
  if (out < ZONES.crest) {
    // The shelf lies in patches: seagrass meadows, and gardens of small corals between them.
    const meadow = smoothOf(seed + 45, x, z, 6) > 0.55;
    return meadow
      ? pickOf(roll, [["seagrass", 0.75]])
      : pickOf(roll, [
          ["brain", 0.07],
          ["branching", 0.07],
          ["anemone", 0.05],
          ["seagrass", 0.08],
        ]);
  }
  if (out < ZONES.deep) {
    return pickOf(roll, [
      ["table", 0.17],
      ["branching", 0.18],
      ["fan", 0.13],
      ["sponge", 0.1],
      ["brain", 0.08],
      ["anemone", 0.04],
    ]);
  }
  return out < ZONES.fringe ? fringeKind(seed, x, z, roll) : Option.none();
}

/** Whether (x, z) is a column of the world's own cells, which the learner can change. */
function isOwn(x: number, z: number) {
  return x >= 0 && x < SPAN && z >= 0 && z < SPAN;
}

/**
 * What grows on a column and the floor it stands on, none where nothing
 * does. In the world's own cells that is the shelf the column lies on, none
 * where the learner has changed its floor or the water over it; past them,
 * where only the deep plane lies, it is the deep fringe's life on that plane
 * anywhere the reef would reach.
 */
function growthAt(
  cells: Cells,
  seed: number,
  size: number,
  x: number,
  z: number
) {
  const out = outOf(seed, size, x, z);
  if (!isOwn(x, z)) {
    const reaches = out >= ZONES.shelf && out < ZONES.fringe;
    return reaches
      ? Option.map(
          fringeKind(seed, x, z, unitOf(seed + 44, x, 0, z)),
          (kind) => ({ floor: SEA_LEVEL - DEEP, kind })
        )
      : Option.none();
  }
  const column = columnOf(seed, size, x, z);
  const untouched =
    !column.land &&
    blockAt(cells, x, column.top, z) === SAND &&
    blockAt(cells, x, column.top + 1, z) === WATER;
  return untouched
    ? Option.map(kindAt(seed, x, z, out), (kind) => ({
        floor: column.top + 1,
        kind,
      }))
    : Option.none();
}

/**
 * The life on one column, placed and turned. A sea fan stands square to the
 * current, as every fan of a reef does; anything else is turned its own way.
 */
function spotAt(
  cells: Cells,
  seed: number,
  size: number,
  x: number,
  z: number
): Option.Option<Spot> {
  return Option.map(growthAt(cells, seed, size, x, z), ({ floor, kind }) => {
    const turn = unitOf(seed + 47, x, 1, z);
    return {
      kind,
      look: Math.floor(unitOf(seed + 48, x, 2, z) * LOOKS),
      x: x + 0.3 + unitOf(seed + 49, x, 3, z) * 0.4,
      y: kind === "lily" ? SURFACE : floor,
      yaw: kind === "fan" ? (turn - 0.5) * 0.5 : turn * Math.PI * 2,
      z: z + 0.3 + unitOf(seed + 49, x, 4, z) * 0.4,
    };
  });
}

/**
 * Everything rooted on the island's sea floor and floating on its pond
 * (ADR 0047, D50): seagrass meadows and small corals on the shelf, the reef
 * crest's table and staghorn corals, sea fans, sponges and anemones on the
 * step, kelp forests on the deep fringe, out past the world's own cells too,
 * and lily pads on the pond. It is read from the world's cells, so it changes
 * only by an edit.
 */
export function reefOf(cells: Cells, seed: number, size: number) {
  const span = SPAN + BEYOND * 2;
  return Arr.flatMap(
    Arr.makeBy(span, (z) => z - BEYOND),
    (z) =>
      Arr.filterMap(
        Arr.makeBy(span, (x) => x - BEYOND),
        (x) =>
          Option.match(spotAt(cells, seed, size, x, z), {
            onNone: () => Result.failVoid,
            onSome: (spot) => Result.succeed(spot),
          })
      )
  );
}

/**
 * The reef as drawn bodies: one model a kind and look, with its bodies as one
 * run of numbers, `BODY_STRIDE` a body, so a whole meadow draws in one call.
 */
export function reefBodies(spots: readonly Spot[]) {
  const groups = Arr.sort(
    Rec.values(Arr.groupBy(spots, (spot) => `${spot.kind}-${spot.look}`)),
    Order.mapInput(Order.String, (group: Arr.NonEmptyReadonlyArray<Spot>) => {
      const first = Arr.headNonEmpty(group);
      return `${first.kind}-${first.look}`;
    })
  );
  return Arr.map(groups, (group) => {
    const first = Arr.headNonEmpty(group);
    const model = { _tag: "reef", kind: first.kind, look: first.look } as const;
    const places = Arr.flatMap(group, (spot) => [
      spot.x,
      spot.y,
      spot.z,
      spot.yaw,
      0,
      0,
    ]);
    return [model, Float32Array.from(places)] as const;
  });
}

export type { Spot };
