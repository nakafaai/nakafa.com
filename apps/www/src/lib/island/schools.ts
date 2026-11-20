import { Array as Arr, Match, Option, Result, Schema } from "effect";
import type { Dice } from "@/lib/island/fauna/cast";
import { CAST, castOf } from "@/lib/island/fauna/cast";
import type { Survey } from "@/lib/island/fauna/habitat";
import { SPECIES } from "@/lib/island/fauna/species";
import { ballAt, Hunt, scatterAt } from "@/lib/island/hunt";
import type { Land } from "@/lib/island/land/ground";
import { heightAt, surfaceAt } from "@/lib/island/land/ground";
import type { Model } from "@/lib/island/models/kinds";
import { schoolOf } from "@/lib/island/models/ocean";
import { unitOf } from "@/lib/island/noise";

/**
 * The fish of one cell of the land (ADR 0047, D24 and D50; ADR 0050, W9): a
 * school swimming a round `radius` blocks about a place, `depth` blocks under
 * the water's face `surface`, or walking the floor under it; a pair of
 * clownfish darting round an anemone; and the bait ball a reef shark hunts.
 */
export const School = Schema.Union([
  Schema.TaggedStruct("ring", {
    count: Schema.Int,
    depth: Schema.Finite,
    floor: Schema.Boolean,
    index: Schema.Int,
    radius: Schema.Finite,
    seed: Schema.Int,
    speed: Schema.Finite,
    start: Schema.Finite,
    surface: Schema.Finite,
    x: Schema.Finite,
    z: Schema.Finite,
  }),
  Schema.TaggedStruct("pair", {
    index: Schema.Int,
    order: Schema.Int,
    x: Schema.Finite,
    y: Schema.Finite,
    z: Schema.Finite,
  }),
  Schema.TaggedStruct("bait", { hunt: Hunt, index: Schema.Int }),
]);
export type School = typeof School.Type;

/** How many mackerel mill in a bait ball, and how fast they wheel round its middle, in radians a second. */
const BAIT = { count: 16, turn: 0.9 } as const;

/** How many anemones of a cell hold a pair of clownfish, and how many schools of its own a reef keeps. */
const REEF = { anemones: 3, schools: 3 } as const;

/** How many places of a habitat a cell must offer before fish are found there. */
const NEED = { few: 3, many: 24 } as const;

/** A fish's length in blocks, never so small it vanishes. */
function lengthOf(index: number) {
  return Math.max(0.12, SPECIES[index].height);
}

/** How many fish of a species swim together, by its length in blocks: shoals of small fish, a few big ones, a big one alone. */
function shoalOf(index: number) {
  return Math.min(9, Math.max(1, Math.round(2.4 / lengthOf(index))));
}

/** One fish as a drawn body, facing the way it swims. */
function fishBody(x: number, y: number, z: number, yaw: number) {
  return [x, y, z, yaw, 0, 0];
}

/** The height a fish of `length` keeps between the floor under it and the water's face, none where the water is too shallow for it. */
function heldDepth(
  land: Land,
  at: { readonly x: number; readonly y: number; readonly z: number },
  length: number,
  surface: number
) {
  const half = length / 4;
  const low = heightAt(land, at.x, at.z) + half + 0.1;
  const high = surface - 0.2 - half;
  return low > high
    ? Option.none()
    : Option.some(Math.min(high, Math.max(low, at.y)));
}

/**
 * One school on its round at `time`: its middle follows the round, each fish
 * keeping its place in the school a little ahead of or behind its
 * neighbours, the school breathing wider and closer as it goes. A fish with
 * no water under it is left out rather than drawn through the ground, and one
 * that walks the floor stands on it.
 */
function ringBodies(
  land: Land,
  ring: Extract<School, { _tag: "ring" }>,
  time: number
) {
  const length = lengthOf(ring.index);
  const angle = ring.start + (time * ring.speed) / ring.radius;
  const [cx, cz] = [Math.cos(angle), Math.sin(angle)];
  const way = ring.speed > 0 ? 1 : -1;
  const yaw = Math.atan2(-cz * way, cx * way);
  const breath = 1 + 0.15 * Math.sin(time * 0.7 + ring.start);
  const [c, s] = [Math.cos(yaw), Math.sin(yaw)];
  return Arr.filterMap(
    schoolOf(ring.count, length, ring.seed),
    (fish): Result.Result<number[], void> => {
      const [ox, oz] = [fish.at[0] * breath, fish.at[2] * breath];
      const x = ring.x + cx * ring.radius + ox * c + oz * s;
      const z = ring.z + cz * ring.radius - ox * s + oz * c;
      const y = ring.surface - ring.depth + fish.at[1];
      return Option.match(heldDepth(land, { x, y, z }, length, ring.surface), {
        onNone: () => Result.failVoid,
        onSome: (held) =>
          Result.succeed(
            fishBody(
              x,
              ring.floor ? heightAt(land, x, z) : held,
              z,
              yaw + (fish.lag - 0.5) * 0.3
            )
          ),
      });
    }
  );
}

/** A pair of clownfish at `time`: each keeping close over its anemone, darting round it in small loops, one each way. */
function pairBodies(pair: Extract<School, { _tag: "pair" }>, time: number) {
  return Arr.makeBy(2, (member) => {
    const way = member === 0 ? 1 : -1;
    const angle = way * time * 1.6 + pair.order + member * Math.PI;
    const loop = 0.16 + 0.05 * Math.sin(time * 0.8 + pair.order);
    return fishBody(
      pair.x + Math.cos(angle) * loop,
      pair.y + 0.3 + 0.05 * Math.sin(time * 2 + member),
      pair.z + Math.sin(angle) * loop,
      Math.atan2(-Math.sin(angle) * way, Math.cos(angle) * way)
    );
  });
}

/**
 * A bait ball at `time`: mackerel wheeling round its middle as a real bait
 * ball mills, bursting apart to either side of the reef shark's line when it
 * charges and closing up again after.
 */
function baitBodies(bait: Extract<School, { _tag: "bait" }>, time: number) {
  const ball = ballAt(bait.hunt, time);
  const scatter = scatterAt(bait.hunt, time);
  const turn = time * BAIT.turn;
  const [c, s] = [Math.cos(turn), Math.sin(turn)];
  return Arr.map(
    schoolOf(BAIT.count, lengthOf(bait.index), bait.hunt.seed * 7 + 5),
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
 * The fish of a cell at `time` as drawn bodies (ADR 0047, D50), each school
 * with its species' model and its bodies as one run of numbers.
 */
export function schoolBodies(
  land: Land,
  schools: readonly School[],
  time: number
) {
  return Arr.map(schools, (school) => {
    const model: Model = { _tag: "species", index: school.index };
    const places = Match.valueTags(school, {
      bait: (bait) => baitBodies(bait, time),
      pair: (pair) => pairBodies(pair, time),
      ring: (ring) => ringBodies(land, ring, time),
    });
    return [model, Float32Array.from(Arr.flatten(places))] as const;
  });
}

/** The bait ball of a hunt, none when the catalogue has no mackerel. */
export function baitOf(hunt: Hunt): Option.Option<School> {
  return Option.map(
    Arr.head(CAST.mackerel),
    (index): School => ({ _tag: "bait", hunt, index })
  );
}

/** A school of a role's species on a round about a place, none when the role has none. */
function ringOf(
  land: Land,
  role: keyof typeof CAST,
  dice: Dice,
  turn: number,
  round: {
    readonly depth: number;
    readonly lone: boolean;
    readonly radius: number;
    readonly slot: number;
    readonly x: number;
    readonly z: number;
  }
) {
  return Option.map(castOf(role, dice, turn), (index): School => {
    const roll = unitOf(dice.seed + 431, dice.gx, round.slot, dice.gz);
    return {
      _tag: "ring",
      count: round.lone ? 1 : shoalOf(index),
      depth: round.depth,
      floor: SPECIES[index].family === "crab",
      index,
      radius: round.radius,
      seed: Math.floor(roll * 1_000_000),
      speed: (roll < 0.5 ? -1 : 1) * Math.min(1.4, 0.5 + lengthOf(index)),
      start: roll * Math.PI * 2,
      surface: surfaceAt(land, round.x, round.z),
      x: round.x,
      z: round.z,
    };
  });
}

/** One coral of a cell's reef: where it grows, and whether it is an anemone a clownfish would hold. */
const Coral = Schema.Struct({
  anemone: Schema.Boolean,
  x: Schema.Finite,
  y: Schema.Finite,
  z: Schema.Finite,
});

/** The fish that live over a cell's corals every day (D50): a school of each reef species round a coral of its own, a pair of clownfish over each of the first anemones, and a turtle gliding over them all. */
function reefOf(
  land: Land,
  dice: Dice,
  corals: readonly (typeof Coral.Type)[]
) {
  const schools = Arr.map(
    Arr.take(corals, REEF.schools),
    (coral, slot): Option.Option<School> =>
      ringOf(land, "reef", dice, slot, {
        depth: 0.9 + slot * 0.3,
        lone: false,
        radius: 2.4 + slot * 0.7,
        slot,
        x: coral.x,
        z: coral.z,
      })
  );
  const pairs = Arr.map(
    Arr.take(
      Arr.filter(corals, (coral) => coral.anemone),
      REEF.anemones
    ),
    (coral, order): Option.Option<School> =>
      Option.map(Arr.head(CAST.clown), (index) => ({
        _tag: "pair",
        index,
        order,
        x: coral.x,
        y: coral.y,
        z: coral.z,
      }))
  );
  const turtle = Option.flatMap(Arr.head(corals), (coral) =>
    ringOf(land, "turtles", dice, 0, {
      depth: 0.8,
      lone: true,
      radius: 4.5,
      slot: 7,
      x: coral.x,
      z: coral.z,
    })
  );
  return [...schools, ...pairs, turtle];
}

/**
 * The fish one cell of the land holds (ADR 0050, W9), by the seed, the cell
 * and the day: in fresh water a shoal of a river fish that lives there and
 * one the day brings; over the cell's corals the reef's own schools,
 * clownfish and a turtle, and in its shallows a lurker of the day; and in the
 * open sea a shoal that lives there and another the day brings, so the sea is
 * never empty.
 */
export function schoolsOf(
  land: Land,
  survey: Survey,
  dice: Dice,
  corals: Parameters<typeof reefOf>[2]
): readonly School[] {
  const at = (
    spots: Survey["sea"],
    need: number,
    slot: number,
    role: keyof typeof CAST,
    round: {
      readonly depth: number;
      readonly lone: boolean;
      readonly radius: number;
    },
    turn: number
  ) =>
    Option.flatMap(
      spots.length >= need ? Arr.get(spots, slot) : Option.none(),
      (spot) =>
        ringOf(land, role, dice, turn, {
          ...round,
          slot: slot + 11,
          x: spot.x,
          z: spot.z,
        })
    );
  const pond = { depth: 0.5, lone: false, radius: 1.6 };
  const open = { depth: 2, lone: false, radius: 7 };
  return Arr.getSomes([
    at(survey.fresh, NEED.few, 0, "fresh", pond, 0),
    at(survey.fresh, NEED.many, 9, "fresh", pond, dice.day),
    ...reefOf(land, dice, corals),
    at(
      survey.shallows,
      NEED.few,
      1,
      "lurkers",
      { depth: 1.2, lone: true, radius: 3 },
      dice.day
    ),
    at(survey.sea, NEED.few, 2, "pelagic", open, 0),
    at(survey.sea, NEED.many, 14, "pelagic", { ...open, depth: 3 }, dice.day),
  ]);
}
