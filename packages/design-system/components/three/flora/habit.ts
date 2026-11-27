import {
  chanceAt,
  fractalAt,
} from "@repo/design-system/components/three/field/noise";
import type { Limb } from "@repo/design-system/components/three/flora/limb";
import {
  LimbSchema,
  placeAt,
  smoothPath,
} from "@repo/design-system/components/three/flora/limb";
import { Array as Arr, Schema } from "effect";

/**
 * How a woody plant grows, in the terms a botanist names it by: how tall it
 * stands and how thick its trunk is at the ground, how much of the trunk is
 * bare below the first branch (`crown`), how many branches each axis bears
 * (`forks`) through how many orders of branching, the angle a branch leaves
 * its parent at (`spread`), how long it is beside its parent (`reach`), how
 * strongly it turns to the light or droops (`lift`), how much every axis
 * wanders, and the leaves each last shoot carries and their length. `bolt`
 * is how late in its growth it gains its height: 1 for a plant that rises
 * steadily, more for one that sits as a rosette and then shoots up.
 */
const HabitSchema = Schema.Struct({
  bolt: Schema.Finite,
  crown: Schema.Finite,
  forks: Schema.Int,
  girth: Schema.Finite,
  height: Schema.Finite,
  leaf: Schema.Finite,
  leaves: Schema.Int,
  lift: Schema.Finite,
  orders: Schema.Int,
  reach: Schema.Finite,
  spread: Schema.Finite,
  wander: Schema.Finite,
});
type Habit = typeof HabitSchema.Type;

/** The woody plants a lab can name, each with the habit of the real one. */
export const HABITS = {
  /** A biennial herb: a rosette of large leaves at the ground in its first year, then one tall leafy stalk. */
  biennial: {
    bolt: 2.6,
    crown: 0,
    forks: 0,
    girth: 0.026,
    height: 1.24,
    leaf: 0.36,
    leaves: 18,
    lift: 0,
    orders: 0,
    reach: 0,
    spread: 0,
    wander: 0.12,
  },
  /** A spreading shade tree: a short bole, rising scaffold limbs, a domed crown. */
  broadleaf: {
    bolt: 1,
    crown: 0.38,
    forks: 5,
    girth: 0.07,
    height: 1.25,
    leaf: 0.112,
    leaves: 42,
    lift: 0.28,
    orders: 3,
    reach: 0.66,
    spread: 0.85,
    wander: 0.22,
  },
  /** An annual herb: one green stem that rises all season, a leaf at every node. */
  herb: {
    bolt: 1,
    crown: 0,
    forks: 0,
    girth: 0.028,
    height: 1.26,
    leaf: 0.33,
    leaves: 15,
    lift: 0,
    orders: 0,
    reach: 0,
    spread: 0,
    wander: 0.14,
  },
  /** A pine: one straight leader, whorls of level boughs that shorten upward, needles. */
  conifer: {
    bolt: 1,
    crown: 0.2,
    forks: 9,
    girth: 0.055,
    height: 1.5,
    leaf: 0.05,
    leaves: 46,
    lift: -0.12,
    orders: 2,
    reach: 0.42,
    spread: 1.35,
    wander: 0.08,
  },
  /** A young tree a few seasons old: a thin stem and a first few branches. */
  sapling: {
    bolt: 1,
    crown: 0.45,
    forks: 4,
    girth: 0.022,
    height: 0.62,
    leaf: 0.075,
    leaves: 9,
    lift: 0.4,
    orders: 2,
    reach: 0.55,
    spread: 0.8,
    wander: 0.2,
  },
  /** A shrub: many stems from the ground, branching low, leafy to the base. */
  shrub: {
    bolt: 1,
    crown: 0.08,
    forks: 6,
    girth: 0.02,
    height: 0.34,
    leaf: 0.06,
    leaves: 12,
    lift: 0.5,
    orders: 2,
    reach: 0.8,
    spread: 0.75,
    wander: 0.3,
  },
} satisfies Record<string, Habit>;

/** The golden angle, by which each next leaf or branch turns about its axis. */
const TURN = Math.PI * (3 - Math.sqrt(5));

/** How many numbers place one leaf: where it is, the way it points, the way its upper face looks, its size and its tone. */
export const LEAF_STRIDE = 11;

/** One place or direction, as x, y and z. */
const PlaceSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
type Place = typeof PlaceSchema.Type;

/** A vector scaled to length 1. */
function unit([x, y, z]: Place): Place {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

/** The cross product of two vectors. */
function cross(a: Place, b: Place): Place {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** The direction that leaves `heading` at `angle` from it, turned `around` its axis. */
function leave(heading: Place, angle: number, around: number): Place {
  const side = unit(cross(heading, [0.31, 0.2, 0.93]));
  const other = cross(heading, side);
  const out: Place = [
    Math.cos(around) * side[0] + Math.sin(around) * other[0],
    Math.cos(around) * side[1] + Math.sin(around) * other[1],
    Math.cos(around) * side[2] + Math.sin(around) * other[2],
  ];
  return unit([
    heading[0] * Math.cos(angle) + out[0] * Math.sin(angle),
    heading[1] * Math.cos(angle) + out[1] * Math.sin(angle),
    heading[2] * Math.cos(angle) + out[2] * Math.sin(angle),
  ]);
}

/** The numbers that place one leaf that points along `heading` with its upper face to the sky. */
function leafAt(place: Place, heading: Place, size: number, tone: number) {
  const face = unit(cross(cross(heading, [0.07, 1, 0.05]), heading));
  return [...place, ...heading, ...face, size, tone];
}

/** How many spans the centreline of an axis is laid out in before it is smoothed. */
const SPANS = 6;

/** One axis of a plant as it grows: where it starts, the way it heads, its length, thickness, order and name. */
const ShootSchema = Schema.Struct({
  heading: PlaceSchema,
  id: Schema.Int,
  length: Schema.Finite,
  order: Schema.Int,
  radius: Schema.Finite,
  start: PlaceSchema,
});
type Shoot = typeof ShootSchema.Type;

/** What has grown: every woody axis, the numbers of every leaf and where the first axis ends. */
const GrowthSchema = Schema.Struct({
  leaves: Schema.Array(Schema.Finite),
  limbs: Schema.Array(LimbSchema),
  tip: PlaceSchema,
});
type Growth = typeof GrowthSchema.Type;

/** Grows one axis and everything it bears. */
function grow(habit: Habit, seed: number, shoot: Shoot): Growth {
  const last = shoot.order === habit.orders;
  const stride = shoot.length / SPANS;
  const knots = Arr.scan(
    Arr.range(1, SPANS),
    { heading: shoot.heading, place: shoot.start },
    (knot, span) => {
      const sway = (salt: number) =>
        (chanceAt(shoot.id, span * 3 + salt, seed) - 0.5) * habit.wander;
      const heading = unit([
        knot.heading[0] + sway(0),
        knot.heading[1] + sway(1) + habit.lift * 0.3 * Math.sign(shoot.order),
        knot.heading[2] + sway(2),
      ]);
      return {
        heading,
        place: [
          knot.place[0] + heading[0] * stride,
          knot.place[1] + heading[1] * stride,
          knot.place[2] + heading[2] * stride,
        ] satisfies Place,
      };
    }
  );
  const path = smoothPath(
    Arr.map(knots, (knot) => knot.place),
    SPANS * 3
  );
  const tip = shoot.radius * (last ? 0.2 : 0.5);
  const limb: Limb = {
    arc: 1,
    base: shoot.radius,
    flare: shoot.order === 0 ? 0.85 : 0.45,
    furrow: 0.3,
    path,
    seed: seed + shoot.id,
    sides: Math.max(6, 14 - shoot.order * 3),
    tip,
  };
  const headings = Arr.map(knots, (knot) => knot.heading);
  const headingAt = (share: number) =>
    placeAt(headings, Math.round(share * SPANS));
  const end = placeAt(path, path.length - 1);
  if (last) {
    const leaves = Arr.flatMap(Arr.range(0, habit.leaves - 1), (index) => {
      const share = 0.15 + (0.85 * (index + 0.5)) / habit.leaves;
      const toss = chanceAt(shoot.id, index, seed + 17);
      const heading = leave(headingAt(share), 0.9 + toss * 0.5, index * TURN);
      const place = placeAt(path, Math.round(share * SPANS * 3));
      return leafAt(
        place,
        unit([heading[0], heading[1] - 0.25, heading[2]]),
        habit.leaf * (0.7 + 0.6 * toss),
        chanceAt(shoot.id, index, seed + 29)
      );
    });
    return { leaves, limbs: [limb], tip: end };
  }
  const from = shoot.order === 0 ? habit.crown : 0.3;
  const grown = Arr.map(Arr.range(0, habit.forks - 1), (fork) => {
    const toss = chanceAt(shoot.id, fork, seed + 41);
    const share = from + ((1 - from) * (fork + 0.7)) / habit.forks;
    const heading = leave(
      headingAt(share),
      habit.spread * (0.8 + 0.4 * toss),
      fork * TURN + shoot.id
    );
    return grow(habit, seed, {
      heading: unit([heading[0], heading[1] + habit.lift, heading[2]]),
      id: shoot.id * habit.forks + fork + 1,
      length:
        shoot.length * habit.reach * (0.75 + 0.5 * toss) * (1.2 - 0.5 * share),
      order: shoot.order + 1,
      radius: (shoot.radius + (tip - shoot.radius) * share ** 0.85) * 0.62,
      start: placeAt(path, Math.round(share * SPANS * 3)),
    });
  });
  return {
    leaves: Arr.flatMap(grown, (part) => part.leaves),
    limbs: [limb, ...Arr.flatMap(grown, (part) => part.limbs)],
    tip: end,
  };
}

/**
 * A habit as it is at one `stage` of its growth, from a seedling (near 0) to
 * full grown (1): shorter, thinner, with fewer and smaller leaves, so the
 * same plant can be drawn at every point of its growth curve.
 */
export function stageHabit(habit: Habit, stage: number): Habit {
  const held = Math.min(1, Math.max(0.03, stage));
  return {
    ...habit,
    girth: habit.girth * (0.3 + 0.7 * held),
    height: habit.height * held ** habit.bolt,
    leaf: habit.leaf * (0.45 + 0.55 * held),
    leaves: Math.max(2, Math.round(habit.leaves * held ** 0.8)),
  };
}

/**
 * A whole plant of one habit, rooted at the origin: its trunk and every
 * branch as limbs to sweep, its leaves as `LEAF_STRIDE` numbers each, and
 * the place of its growing tip. The same habit and seed always grow the same
 * plant.
 */
export function growHabit(habit: Habit, seed: number): Growth {
  return grow(habit, seed, {
    heading: [0, 1, 0],
    id: 0,
    length: habit.height,
    order: 0,
    radius: habit.girth,
    start: [0, 0, 0],
  });
}

/**
 * A sward: `count` blades of grass over a disc `radius` wide, as
 * `LEAF_STRIDE` numbers each. The blades stand in tufts of unequal height and
 * lean every way, as a meadow does, and they shorten to nothing at the rim, so
 * the sward has no edge against the ground around it.
 */
export function growSward({
  blade,
  count,
  radius,
  seed,
}: {
  readonly blade: number;
  readonly count: number;
  readonly radius: number;
  readonly seed: number;
}) {
  return Arr.flatMap(Arr.range(0, count - 1), (index) => {
    const turn = chanceAt(index, 1, seed) * 2 * Math.PI;
    const far = Math.sqrt(chanceAt(index, 2, seed)) * radius;
    const x = Math.cos(turn) * far;
    const z = Math.sin(turn) * far;
    const tuft = fractalAt(
      x / radius / 2 + 0.5,
      z / radius / 2 + 0.5,
      9,
      9,
      seed
    );
    const lean = chanceAt(index, 3, seed) * 2 * Math.PI;
    const tilt = 0.15 + chanceAt(index, 4, seed) * 0.5;
    const heading = unit([Math.cos(lean) * tilt, 1, Math.sin(lean) * tilt]);
    const face = unit(cross([-Math.sin(lean), 0, Math.cos(lean)], heading));
    return [
      x,
      0,
      z,
      ...heading,
      ...face,
      blade *
        (0.35 + 1.3 * tuft * tuft + 0.3 * chanceAt(index, 5, seed)) *
        (1 - (far / radius) ** 3),
      chanceAt(index, 6, seed),
    ];
  });
}
