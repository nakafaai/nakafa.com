import { Array as Arr, Option } from "effect";
import { bodiesOf, joined, seaBodies } from "@/lib/island/bodies";
import type { Animal } from "@/lib/island/life";
import { herdOf, wander } from "@/lib/island/life";
import { plantBodies } from "@/lib/island/plants";
import { reefBodies, reefOf } from "@/lib/island/reef";
import { folkIndex, isAsleep, keepDay } from "@/lib/island/routine";
import { schoolBodies } from "@/lib/island/schools";
import { roam, wildBodies, wildOf } from "@/lib/island/wild";
import type { Cells } from "@/lib/island/world";

/** What of the scene the world's cells decide: its plants and its reef, read again only when an edit changes them. */
function rootedOf(cells: Cells, seed: number, size: number) {
  const reef = reefOf(cells, seed, size);
  return { cells, corals: reefBodies(reef), plants: plantBodies(cells), reef };
}

/**
 * Everything alive on a learner's island that the world draws as bodies
 * (ADR 0047, D53), the same on the home page as in the game: the herd and the
 * villagers on their ground, the wild visitors the day `day` brings, the
 * plants, and the reef, with the seed and the footprint that place them.
 */
export function sceneOf(cells: Cells, seed: number, size: number, day: number) {
  return {
    ...rootedOf(cells, seed, size),
    herd: herdOf(cells, seed, size),
    seed,
    size,
    wild: wildOf(cells, seed, size, day),
  };
}
export type Scene = ReturnType<typeof sceneOf>;

/** The scene over the world's new cells after an edit: its plants and its reef read again, its creatures where they were. */
export function rerootedOf(scene: Scene, cells: Cells): Scene {
  return { ...scene, ...rootedOf(cells, scene.seed, scene.size) };
}

/**
 * The scene `dt` seconds on at `hour`: each villager keeping its day (D54),
 * each other animal of the herd wandering, all among the rest and among
 * `others` (the learner's fox), and each wild visitor roaming.
 */
export function livedOf(
  scene: Scene,
  dt: number,
  hour: number,
  others: readonly Animal[] = []
): Scene {
  const everyone = Arr.appendAll(scene.herd, others);
  return {
    ...scene,
    herd: Arr.map(scene.herd, (animal, order) =>
      Option.match(folkIndex(animal.kind), {
        onNone: () =>
          wander(scene.cells, animal, scene.seed, order, dt, everyone),
        onSome: (index) =>
          keepDay(
            scene.cells,
            animal,
            { hour, index },
            scene.seed,
            dt,
            everyone
          ),
      })
    ),
    wild: Arr.map(scene.wild, (creature) =>
      roam(scene.cells, creature, scene.seed, dt)
    ),
  };
}

/**
 * Every body of the scene at `time` seconds and `hour`, each model once
 * (D50): the herd with `extra` animals among it (the learner's fox), but for
 * a villager asleep in its cottage (D54), the whale and the open sea's
 * swimmers, the wild visitors, the reef's residents, the plants and the reef.
 */
export function sceneBodies(
  scene: Scene,
  time: number,
  hour: number,
  extra: readonly Animal[] = []
) {
  const awake = Arr.filter(scene.herd, (animal) => !isAsleep(animal, hour));
  return joined([
    ...bodiesOf(scene.cells, Arr.appendAll(awake, extra), time),
    ...seaBodies(scene.seed, time),
    ...wildBodies(scene.cells, scene.wild, scene.size, time),
    ...schoolBodies(scene.cells, scene.seed, scene.size, scene.reef, time),
    ...scene.plants,
    ...scene.corals,
  ]);
}
