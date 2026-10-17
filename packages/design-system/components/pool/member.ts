import type { Cover } from "@repo/design-system/components/pool/cover";
import type { Start } from "@repo/design-system/components/pool/place";
import { Mascot } from "@repo/mascot/code";
import { cast } from "@repo/mascot/seed";
import { type ThingName, ThingNameSchema } from "@repo/mascot/thing/name";
import { Array as Arr, Hash, Schema } from "effect";

/** One member of the pool: an animal of the cast, or one of Nina's things, with its radius before any growth. */
const PoolMemberSchema = Schema.Union([
  Schema.Struct({
    key: Schema.String,
    kind: Schema.Literal("animal"),
    mascot: Mascot,
    radius: Schema.Finite,
  }),
  Schema.Struct({
    key: Schema.String,
    kind: Schema.Literal("thing"),
    name: ThingNameSchema,
    radius: Schema.Finite,
  }),
]);

/** One member of the pool. */
export type PoolMember = typeof PoolMemberSchema.Type;

/** The seed of the cast, so that the same animals come up on every visit. */
const SEED = "masuk";
/**
 * The radius of each animal in turn, by its place in the pool, in pixels. Animals
 * come in six sizes, from 60 to 112 pixels across.
 */
export const ANIMAL_RADII: readonly number[] = [30, 38, 38, 46, 46, 56];
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
/** The radius of each thing. */
const THING_RADIUS = 27;
/** The area of all of Nina's things together, in square pixels: they cover part of every pool. */
export const THINGS_AREA =
  THING_NAMES.length * Math.PI * THING_RADIUS * THING_RADIUS;
/** A hashed text becomes a fraction from zero up to one, in this many steps. */
const FRACTION_STEPS = 10_000;
/** The first sideways speed of a member spreads over this many pixels per second, around zero. */
const SPEED_SPREAD = 120;

/** An animal of the pool, keyed by its name, with the radius of its place among the animals. */
function animalMember(mascot: typeof Mascot.Type, radius: number): PoolMember {
  return { key: `animal:${mascot.animal}`, kind: "animal", mascot, radius };
}

/** One of Nina's things, keyed by its name. */
function thingMember(name: ThingName): PoolMember {
  return {
    key: `thing:${name}`,
    kind: "thing",
    name,
    radius: THING_RADIUS,
  };
}

/**
 * Places a thing at its place among the members: the thing with index `index` lies
 * at place `THING_FIRST + index * THING_STEP`, or at the end when the members run
 * out first.
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

/**
 * Every member of a pool with this many animals, in the order that they lie: the
 * animals of the cast, with Nina's things among them. An animal takes one of six
 * sizes by its place among the animals. From 23 animals up, the things keep their
 * places, so a bigger pool only adds members at its end.
 */
export function poolMembers(animals: number): readonly PoolMember[] {
  const animalMembers = Arr.map(cast(SEED, animals), (mascot, place) =>
    animalMember(
      mascot,
      Arr.getUnsafe(ANIMAL_RADII, place % ANIMAL_RADII.length)
    )
  );
  return Arr.reduce(THING_NAMES, animalMembers, (members, name, index) =>
    placeThing(members, thingMember(name), index)
  );
}

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

/** The radius of a member in a pool with this scale: an animal grows with it, and a thing keeps its own radius. */
function radiusOf(member: PoolMember, scale: number) {
  return member.kind === "animal" ? member.radius * scale : member.radius;
}

/** Where every member of a pool with this cover starts: above the box, at its radius. */
export function poolStarts(cover: Cover): readonly Start[] {
  return Arr.map(poolMembers(cover.animals), (member) =>
    startOf(member, radiusOf(member, cover.scale))
  );
}
