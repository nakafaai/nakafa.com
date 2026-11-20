import { Array as Arr, Record as Rec } from "effect";
import type { Land } from "@/lib/island/land/ground";
import { standAt } from "@/lib/island/land/ground";
import type { Animal } from "@/lib/island/life";
import type { Model } from "@/lib/island/models/kinds";
import { modelKey } from "@/lib/island/models/kinds";
import { modelOf } from "@/lib/island/room";

/**
 * Numbers per drawn body: its place, the way it faces, how it moves where it
 * stands, and how far its nose tips up, in radians (D50). How it moves is
 * above zero for an animal, how high it bobs as it walks, and below zero for
 * a plant, minus one over its height in blocks, which is how far up it the
 * wind takes hold (ADR 0047, D32). The sun's shadow map casts every body's
 * shadow (D43).
 */
export const BODY_STRIDE = 6;

/** One animal as a drawn body: on its ground or afloat, facing its goal, bobbing while it walks. */
function animalBody(land: Land, animal: Animal) {
  const [dx, dz] = [animal.tx - animal.x, animal.tz - animal.z];
  const heading = Math.hypot(dx, dz) > 0.05;
  return [
    animal.x,
    standAt(land, animal.x, animal.z),
    animal.z,
    // At rest with nowhere to go, each animal keeps a heading of its own instead of all facing one way.
    heading
      ? Math.atan2(dx, dz)
      : (animal.x * 7.3 + animal.z * 3.1) % (2 * Math.PI),
    animal.rest <= 0 && heading ? 0.06 : 0,
    0,
  ];
}

/**
 * Every animal that walks the land or floats on its water as a drawn body
 * (ADR 0047, D21 and D25), by its model: each on its own ground, facing where
 * it goes. Each model comes with its bodies as one run of numbers,
 * `BODY_STRIDE` a body, for the painter to draw them all at once.
 */
export function animalBodies(land: Land, animals: readonly Animal[]) {
  return Arr.map(
    Rec.values(Arr.groupBy(animals, (animal) => String(animal.kind))),
    (group) =>
      [
        modelOf(Arr.headNonEmpty(group).kind),
        Float32Array.from(
          Arr.flatMap(group, (animal) => animalBody(land, animal))
        ),
      ] as const
  );
}

/**
 * Bodies with every model once (ADR 0047, D50): a model that comes in more
 * than one run, such as a species two cells of the land both hold, has its
 * runs joined, first to last, in the order they came.
 */
export function joined(bodies: readonly (readonly [Model, Float32Array])[]) {
  const groups = Arr.groupBy(bodies, ([model]) => modelKey(model));
  return Arr.map(Rec.values(groups), (group) => {
    // Most models come once; their runs pass through untouched, so a frame copies only what it must.
    if (group.length === 1) {
      return Arr.headNonEmpty(group);
    }
    const [model] = Arr.headNonEmpty(group);
    const places = new Float32Array(
      Arr.reduce(group, 0, (sum, [, data]) => sum + data.length)
    );
    let at = 0;
    for (const [, data] of group) {
      places.set(data, at);
      at += data.length;
    }
    return [model, places] as const;
  });
}
