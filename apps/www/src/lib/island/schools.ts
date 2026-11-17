import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Result } from "effect";
import { SPECIES } from "@/lib/island/fauna/species";
import { ballAt, scatterAt } from "@/lib/island/hunt";
import { schoolOf } from "@/lib/island/models/ocean";
import { unitOf } from "@/lib/island/noise";
import type { Spot } from "@/lib/island/reef";
import { outOf, shoreOf } from "@/lib/island/terrain";
import { seabedOf } from "@/lib/island/wild";
import { type Cells, SEA_LEVEL } from "@/lib/island/world";

/**
 * The reef's own residents (ADR 0047, D50), there every day whatever wild
 * visitors the day brings: a school of each species swimming its round over
 * the reef crest, `out` cells past the shore, at its own pace and depth.
 */
const ROUNDS = [
  { count: 8, depth: 1.2, key: "blue-tang", out: 8, speed: 1.1 },
  { count: 6, depth: 1.8, key: "snapper", out: 8.6, speed: -0.8 },
  { count: 5, depth: 0.9, key: "angelfish", out: 7.4, speed: 0.6 },
] as const;

/** How many clownfish keep to one anemone, and how many anemones hold a pair. */
const CLOWNS = { anemones: 10, pair: 2 } as const;

/** How many mackerel mill in the bait ball, and how fast they wheel round its middle, in radians a second. */
const BAIT = { count: 16, key: "mackerel", turn: 0.9 } as const;

/** The species index of the catalog for a key, none when the catalog has no such species. */
function speciesOf(key: string) {
  return Arr.findFirstIndex(SPECIES, (species) => species.key === key);
}

/** Each resident round with its species' index in the catalog. */
const RESIDENTS = Arr.getSomes(
  Arr.map(ROUNDS, (round) =>
    Option.map(speciesOf(round.key), (index) => ({ ...round, index }))
  )
);

/** A fish's length in blocks, never so small it vanishes. */
function lengthOf(index: number) {
  return Math.max(0.12, SPECIES[index].height);
}

/** One fish as a drawn body, facing the way it swims. */
function fishBody(x: number, y: number, z: number, yaw: number) {
  return [x, y, z, yaw, 0, 0];
}

/** Holds a fish of `length` between the sea floor under it and the surface, none where the water is too shallow for it. */
function heldDepth(
  cells: Cells,
  x: number,
  y: number,
  z: number,
  length: number
) {
  const half = length / 4;
  const low = Option.match(seabedOf(cells, x, z), {
    onNone: () => Number.NEGATIVE_INFINITY,
    onSome: (top) => top + half + 0.1,
  });
  const high = SEA_LEVEL - 0.2 - half;
  return low > high
    ? Option.none()
    : Option.some(Math.min(high, Math.max(low, y)));
}

/**
 * One resident school at `time`: its middle follows the reef crest round the
 * island, each fish keeping its place in the school a little ahead of or
 * behind its neighbours, the school breathing wider and closer as it goes.
 */
function roundBodies(
  cells: Cells,
  seed: number,
  size: number,
  round: (typeof RESIDENTS)[number],
  time: number
) {
  const index = round.index;
  const length = lengthOf(index);
  const reach = shoreOf(size);
  const angle =
    unitOf(seed + 50, index, 0, 0) * Math.PI * 2 + (time * round.speed) / reach;
  const [cx, cz] = [Math.cos(angle), Math.sin(angle)];
  const probe = [SPAN / 2 + cx * reach, SPAN / 2 + cz * reach] as const;
  // The crest follows the shore's own wobble, so the round is measured from the shore at this bearing, not from a circle.
  const radius = reach - outOf(seed, size, probe[0], probe[1]) + round.out;
  const middle = [SPAN / 2 + cx * radius, SPAN / 2 + cz * radius] as const;
  const way = round.speed > 0 ? 1 : -1;
  const yaw = Math.atan2(-cz * way, cx * way);
  const breath = 1 + 0.15 * Math.sin(time * 0.7 + index);
  const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
  return Arr.filterMap(
    schoolOf(round.count, length, index * 977 + seed),
    (fish): Result.Result<number[], void> => {
      const [ox, oy, oz] = [
        fish.at[0] * breath,
        fish.at[1],
        fish.at[2] * breath,
      ];
      const x = middle[0] + ox * c + oz * s;
      const z = middle[1] - ox * s + oz * c;
      return Option.match(
        heldDepth(cells, x, SEA_LEVEL - round.depth + oy, z, length),
        {
          onNone: () => Result.failVoid,
          onSome: (y) =>
            Result.succeed(fishBody(x, y, z, yaw + (fish.lag - 0.5) * 0.3)),
        }
      );
    }
  );
}

/** The clownfish of the reef: a pair keeping close over each of the first anemones, darting round it in small loops. */
function clownBodies(spots: readonly Spot[], time: number) {
  const anemones = Arr.take(
    Arr.filter(spots, (spot) => spot.kind === "anemone"),
    CLOWNS.anemones
  );
  return Arr.flatMap(anemones, (spot, order) =>
    Arr.makeBy(CLOWNS.pair, (member) => {
      const way = member === 0 ? 1 : -1;
      const angle = way * time * 1.6 + order + member * Math.PI;
      const loop = 0.16 + 0.05 * Math.sin(time * 0.8 + order);
      return fishBody(
        spot.x + Math.cos(angle) * loop,
        spot.y + 0.3 + 0.05 * Math.sin(time * 2 + member),
        spot.z + Math.sin(angle) * loop,
        Math.atan2(-Math.sin(angle) * way, Math.cos(angle) * way)
      );
    })
  );
}

/**
 * The bait ball at `time`: mackerel wheeling round its middle as a real bait
 * ball mills, bursting apart to either side of the reef shark's line when it
 * charges and closing up again after.
 */
function baitBodies(seed: number, index: number, time: number) {
  const ball = ballAt(seed, time);
  const scatter = scatterAt(seed, time);
  const turn = time * BAIT.turn;
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  return Arr.map(
    schoolOf(BAIT.count, lengthOf(index), seed * 7 + 5),
    (fish) => {
      const px = fish.at[0] * c - fish.at[2] * s;
      const pz = fish.at[0] * s + fish.at[2] * c;
      const side = px * scatter.across.x + pz * scatter.across.z >= 0 ? 1 : -1;
      const spread = 1 + scatter.burst * 0.5;
      return fishBody(
        ball.x + px * spread + scatter.across.x * side * scatter.burst * 1.4,
        ball.y + fish.at[1],
        ball.z + pz * spread + scatter.across.z * side * scatter.burst * 1.4,
        Math.atan2(-pz, px)
      );
    }
  );
}

/**
 * The reef's residents at `time` as drawn bodies (ADR 0047, D50), one
 * species a model with its bodies as one run of numbers: the crest's
 * schools, the clownfish over their anemones, and the bait ball the reef
 * shark hunts. A species the day also brings as a visitor comes twice, and
 * the painter's list joins the two.
 */
export function schoolBodies(
  cells: Cells,
  seed: number,
  size: number,
  spots: readonly Spot[],
  time: number
) {
  const rounds = Arr.map(RESIDENTS, (round) => ({
    index: round.index,
    places: roundBodies(cells, seed, size, round, time),
  }));
  const extras = Arr.getSomes([
    Option.map(speciesOf("clownfish"), (index) => ({
      index,
      places: clownBodies(spots, time),
    })),
    Option.map(speciesOf(BAIT.key), (index) => ({
      index,
      places: baitBodies(seed, index, time),
    })),
  ]);
  return Arr.map([...rounds, ...extras], ({ index, places }) => {
    const model = { _tag: "species", index } as const;
    return [model, Float32Array.from(Arr.flatten(places))] as const;
  });
}
