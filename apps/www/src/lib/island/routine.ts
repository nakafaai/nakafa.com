import { SPAN } from "@repo/backend/confect/island/world";
import { Array as Arr, Option } from "effect";
import { type Animal, FOLK, SPEED, suitsOf, wander } from "@/lib/island/life";
import { unitOf } from "@/lib/island/noise";
import { SPOTS } from "@/lib/island/village";
import type { Cells } from "@/lib/island/world";

/**
 * The hours of a villager's day (ADR 0047, D54): it wakes and leaves home,
 * goes to work, comes back to the well for the evening, and goes home to
 * sleep. Each villager keeps the hours a little apart from the others, by
 * `stagger` hours each, so they never move as one.
 */
const DAY = { home: 22, stagger: 0.4, wake: 6, work: 9, rest: 17 } as const;

/** How near its spot, in cells, a villager counts as there. */
const NEAR = 0.6;

/** The four columns beside a column, across and deep. */
const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Which of the village's folk an animal is, by its place in the village's list; none for any other creature. */
export function folkIndex(kind: Animal["kind"]) {
  return Arr.findFirstIndex(FOLK, (folk) => folk === kind);
}

/** The part of the day it is for villager `index` at `hour`: asleep at home, by the well, or at work. */
function partOf(index: number, hour: number) {
  const shifted = (hour - index * DAY.stagger + 24) % 24;
  if (shifted < DAY.wake || shifted >= DAY.home) {
    return "home";
  }
  return shifted >= DAY.work && shifted < DAY.rest ? "work" : "plaza";
}

/** Where villager `index` is bound at `hour`, as a path cell, and whether it sleeps there. */
export function spotOf(index: number, hour: number) {
  const part = partOf(index, hour);
  const homes = SPOTS.homes[index];
  const [x, z] = part === "home" ? homes : SPOTS[part][index];
  return { asleep: part === "home", x, z };
}

/** Whether a creature is a villager asleep in its cottage at `hour`: bound home and at its doorstep, so it is inside and not drawn. */
export function isAsleep(animal: Animal, hour: number) {
  return Option.match(folkIndex(animal.kind), {
    onNone: () => false,
    onSome: (index) => {
      const spot = spotOf(index, hour);
      return (
        spot.asleep &&
        Math.hypot(animal.x - spot.x - 0.5, animal.z - spot.z - 0.5) <= NEAR
      );
    },
  });
}

/**
 * The next path cell from (x, z) on the shortest way along the village's
 * paths to (tx, tz): every path column is reached back from the goal one
 * step at a time, and of the columns beside (x, z) the one nearest the goal
 * comes next. None when no path leads there, as when the learner has built
 * over it.
 */
export function stepToward(
  cells: Cells,
  [x, z]: readonly [number, number],
  [tx, tz]: readonly [number, number]
) {
  const steps = new Int16Array(SPAN * SPAN).fill(-1);
  const isPath = (cx: number, cz: number) =>
    cx >= 0 &&
    cx < SPAN &&
    cz >= 0 &&
    cz < SPAN &&
    suitsOf("cat", cells, cx + 0.5, cz + 0.5);
  if (!isPath(tx, tz)) {
    return Option.none();
  }
  // Each column enters the queue once, so a queue as long as the world holds every one.
  const queue = new Int32Array(SPAN * SPAN);
  let length = 1;
  queue[0] = tz * SPAN + tx;
  steps[queue[0]] = 0;
  for (let read = 0; read < length; read += 1) {
    const index = queue[read];
    const [cx, cz] = [index % SPAN, Math.floor(index / SPAN)];
    for (const [dx, dz] of SIDES) {
      const next = (cz + dz) * SPAN + cx + dx;
      if (isPath(cx + dx, cz + dz) && steps[next] < 0) {
        steps[next] = steps[index] + 1;
        queue[length] = next;
        length += 1;
      }
    }
  }
  const options = Arr.filter(
    Arr.map(SIDES, ([dx, dz]) => [x + dx, z + dz] as const),
    ([cx, cz]) => isPath(cx, cz) && steps[cz * SPAN + cx] >= 0
  );
  return Arr.match(options, {
    onEmpty: () => Option.none(),
    onNonEmpty: (found) =>
      Option.some(
        Arr.reduce(found, Arr.headNonEmpty(found), (best, cell) =>
          steps[cell[1] * SPAN + cell[0]] < steps[best[1] * SPAN + best[0]]
            ? cell
            : best
        )
      ),
  });
}

/**
 * Villager `index` after `dt` seconds of its day at `hour` (D54): walking or
 * resting as any creature does, and each time it reaches where it was going,
 * taking the next cell of the village's paths toward the spot its hour binds
 * it to. There it lingers, or, bound home, waits on its doorstep, inside,
 * until morning. Where no path leads to its spot it
 * wanders as the other creatures do.
 */
export function keepDay(
  cells: Cells,
  animal: Animal,
  { hour, index }: { readonly hour: number; readonly index: number },
  seed: number,
  dt: number,
  others: readonly Animal[] = []
): Animal {
  const toward = Math.hypot(animal.tx - animal.x, animal.tz - animal.z);
  if (animal.rest > 0 || toward > SPEED[animal.kind] * dt) {
    return wander(cells, animal, seed, index, dt, others);
  }
  // It reaches where it was going, then takes its next step.
  const here = { ...animal, x: animal.tx, z: animal.tz };
  const spot = spotOf(index, hour);
  const away = Math.hypot(here.x - spot.x - 0.5, here.z - spot.z - 0.5);
  const roll = (channel: number) =>
    unitOf(seed + 70 + index, animal.steps, channel);
  if (away <= NEAR) {
    // At its spot it lingers, looking about: a sleeper till morning, anyone else till its hour moves it on.
    return {
      ...here,
      rest: spot.asleep ? 1 : 1.5 + roll(1) * 3,
      steps: here.steps + 1,
    };
  }
  const cell = [Math.floor(here.x), Math.floor(here.z)] as const;
  return Option.match(stepToward(cells, cell, [spot.x, spot.z]), {
    onNone: () => wander(cells, animal, seed, index, dt, others),
    onSome: ([nx, nz]) => ({
      ...here,
      steps: here.steps + 1,
      tx: nx + 0.5,
      tz: nz + 0.5,
    }),
  });
}
