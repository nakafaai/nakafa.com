import { Array as Arr, Schema } from "effect";
import { SPECIES } from "@/lib/island/fauna/species";
import type { Land } from "@/lib/island/land/ground";
import { unitOf } from "@/lib/island/noise";
import { Ground, headingOf, roomOf, touches } from "@/lib/island/room";

/** The villagers who keep a day wherever the learner built homes (ADR 0047, D10 and D54). */
export const FOLK = ["cat", "rabbit", "bear"] as const;

/**
 * One creature that walks the land or floats on its water (ADR 0047, D8 and
 * D10; ADR 0050, W9): a hen, a villager or the learner's fox by its name, or
 * a species of the catalogue by its index; where it stands and where it is
 * going, how many steps it has taken, and how long it still rests before it
 * goes on.
 */
export const Animal = Schema.Struct({
  kind: Schema.Union([Schema.Literals(["hen", ...FOLK, "fox"]), Schema.Int]),
  rest: Schema.Finite,
  steps: Schema.Int,
  tx: Schema.Finite,
  tz: Schema.Finite,
  x: Schema.Finite,
  z: Schema.Finite,
});
export type Animal = typeof Animal.Type;

/**
 * An animal that lives in one cell of the land (ADR 0050, W9): the cell it
 * was found in by its key, the ground it keeps to, the spot its pack keeps
 * about (`hx`, `hz`), which pack of the cell it belongs to, how long it still
 * stands for the learner who stroked it, and the dice its own choices roll.
 */
export const Dweller = Schema.Struct({
  ...Animal.fields,
  cell: Schema.Finite,
  ground: Ground,
  hx: Schema.Finite,
  hz: Schema.Finite,
  pack: Schema.Int,
  pet: Schema.Finite,
  seed: Schema.Int,
});
export type Dweller = typeof Dweller.Type;

/** How fast the world's own bodies move, in blocks a second; the fox is the learner, who walks where they press. */
const PACE = {
  bear: 0.9,
  cat: 1.2,
  fox: 3.2,
  hen: 1.1,
  rabbit: 1.3,
} as const;

/** How fast an animal walks, in blocks a second: a species by its size, a small one slowly and a large one at a stroll. */
export function paceOf(kind: Animal["kind"]) {
  return typeof kind === "number"
    ? Math.min(1.6, 0.4 + SPECIES[kind].height)
    : PACE[kind];
}

/**
 * One animal after `dt` seconds (ADR 0047, D22): resting, walking toward its
 * goal at `pace` unless the step would leave its ground, enter what `blocked`
 * answers for or press into another body, or, once there, picking a new goal
 * within `spread` blocks of `home` that suits it, from its own dice and its
 * step count, and resting a moment first.
 */
export function wander(
  land: Land,
  animal: Dweller,
  step: {
    readonly blocked: (x: number, z: number, half: number) => boolean;
    readonly dt: number;
    readonly home: readonly [number, number];
    readonly others: readonly Animal[];
    readonly pace: number;
    readonly spread: number;
  }
): Dweller {
  if (animal.rest > 0) {
    return { ...animal, rest: Math.max(0, animal.rest - step.dt) };
  }
  const dx = animal.tx - animal.x;
  const dz = animal.tz - animal.z;
  const distance = Math.hypot(dx, dz);
  const reach = step.pace * step.dt;
  if (distance > reach) {
    const next = {
      ...animal,
      x: animal.x + (dx / distance) * reach,
      z: animal.z + (dz / distance) * reach,
    };
    // A step that moves it away from a body it already touches is allowed, so two bodies never lock together.
    const closer = (other: Animal) =>
      Math.hypot(next.x - other.x, next.z - other.z) <
      Math.hypot(animal.x - other.x, animal.z - other.z);
    const open =
      roomOf(
        land,
        animal,
        { x: next.x, yaw: headingOf(animal), z: next.z },
        step.blocked
      ) &&
      !Arr.some(
        step.others,
        (other) => other !== animal && closer(other) && touches(next, other)
      );
    return open
      ? next
      : {
          ...animal,
          rest: 0.6,
          steps: animal.steps + 1,
          tx: animal.x,
          tz: animal.z,
        };
  }
  const roll = (channel: number) => unitOf(animal.seed, animal.steps, channel);
  const goal = {
    x: step.home[0] + (roll(1) - 0.5) * 2 * step.spread,
    z: step.home[1] + (roll(2) - 0.5) * 2 * step.spread,
  };
  const yaw = Math.atan2(goal.x - animal.tx, goal.z - animal.tz);
  const fits = roomOf(land, animal, { ...goal, yaw }, step.blocked);
  return {
    ...animal,
    rest: 0.5 + roll(3) * 2.5,
    steps: animal.steps + 1,
    tx: fits ? goal.x : animal.tx,
    tz: fits ? goal.z : animal.tz,
    x: animal.tx,
    z: animal.tz,
  };
}
