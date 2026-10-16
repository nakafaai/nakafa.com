import {
  createWorld,
  type Start,
  type World,
} from "@repo/design-system/components/pool/physics";
import { Mascot } from "@repo/mascot/code";
import { cast } from "@repo/mascot/seed";
import { type ThingName, ThingNameSchema } from "@repo/mascot/thing/name";
import { Array as Arr, Hash, Schema } from "effect";

/** One member of the pool: an animal of the cast, or one of Nina's things. */
const PoolMemberSchema = Schema.Union([
  Schema.Struct({
    key: Schema.String,
    kind: Schema.Literal("animal"),
    mascot: Mascot,
  }),
  Schema.Struct({
    key: Schema.String,
    kind: Schema.Literal("thing"),
    name: ThingNameSchema,
  }),
]);

/** One member of the pool. */
export type PoolMember = typeof PoolMemberSchema.Type;

/** The seed of the cast, so that the same animals come up on every visit. */
const SEED = "masuk";
/** How many animals the pool holds, and no animal appears twice. */
const ANIMAL_COUNT = 22;
/** Nina's things, in the order in which they lie among the animals. */
const THING_NAMES: readonly ThingName[] = [
  "book",
  "balls",
  "coffee",
  "bulb",
  "backpack",
  "pencil",
  "trophy",
  "globe",
];
/** The first thing lies at this place in the pool, and each next one lies this many places further on. */
const THING_FIRST = 2;
const THING_STEP = 4;
/** The radius of each animal in turn, by its place in the pool: animals come in six sizes. */
const ANIMAL_RADII: readonly number[] = [30, 38, 38, 46, 46, 56];
/** The radius of each thing. */
const THING_RADIUS = 27;
/** A box narrower than this, in pixels, draws every member smaller. */
const NARROW_WIDTH = 420;
/** The share of its size that a member keeps in a narrow box. */
const NARROW_SHARE = 0.72;
/** A hashed text becomes a fraction from zero up to one, in this many steps. */
const FRACTION_STEPS = 10_000;
/** The first sideways speed of a member spreads over this many pixels per second, around zero. */
const SPEED_SPREAD = 120;

/** An animal of the pool, keyed by its name. */
function animalMember(mascot: typeof Mascot.Type): PoolMember {
  return { key: `animal:${mascot.animal}`, kind: "animal", mascot };
}

/** One of Nina's things, keyed by its name. */
function thingMember(name: ThingName): PoolMember {
  return { key: `thing:${name}`, kind: "thing", name };
}

/**
 * Places a thing at its place among the members, as the pit does: the thing
 * with index `index` lies at place `THING_FIRST + index * THING_STEP`, or at the
 * end when the members run out first.
 */
function placeThing(
  members: readonly PoolMember[],
  thing: PoolMember,
  index: number
): PoolMember[] {
  const at = Math.min(members.length, THING_FIRST + index * THING_STEP);
  return Arr.appendAll(
    Arr.append(Arr.take(members, at), thing),
    Arr.drop(members, at)
  );
}

/** Every member of the pool, in the order that they lie: the animals of the cast, with Nina's things among them. */
export const POOL_MEMBERS: readonly PoolMember[] = Arr.reduce(
  THING_NAMES,
  Arr.map(cast(SEED, ANIMAL_COUNT), animalMember),
  (members, name, index) => placeThing(members, thingMember(name), index)
);

/** A text as a fraction from zero up to one, the same on every visit. */
function fractionOf(text: string) {
  return (Math.abs(Hash.string(text)) % FRACTION_STEPS) / FRACTION_STEPS;
}

/** Where a member starts across and above the box, and how fast it first moves sideways. */
function startOf(member: PoolMember, radius: number): Start {
  return {
    fx: fractionOf(`${member.key}#x`),
    fy: fractionOf(`${member.key}#y`),
    r: radius,
    vx: (fractionOf(`${member.key}#vx`) - 0.5) * SPEED_SPREAD,
  };
}

/** The radius of a member at its place: an animal takes one of six sizes, and a thing takes its own. */
function radiusOf(member: PoolMember, index: number) {
  return member.kind === "thing"
    ? THING_RADIUS
    : Arr.getUnsafe(ANIMAL_RADII, index % ANIMAL_RADII.length);
}

/** The pool as it starts in a box of this size: every member above the box, at its radius. */
export function poolWorld(width: number, height: number): World {
  const share = width < NARROW_WIDTH ? NARROW_SHARE : 1;
  return createWorld(
    width,
    height,
    Arr.map(POOL_MEMBERS, (member, index) =>
      startOf(member, radiusOf(member, index) * share)
    )
  );
}
