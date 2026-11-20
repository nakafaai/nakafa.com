import { Array as Arr, Option, Order } from "effect";
import type { Land } from "@/lib/island/land/ground";
import { standAt } from "@/lib/island/land/ground";
import { landHit } from "@/lib/island/land/ray";
import type { Animal, Dweller } from "@/lib/island/life";
import { shapeOf } from "@/lib/island/room";
import type { Scene } from "@/lib/island/scene";
import { PET } from "@/lib/island/wild";

/** A point in the world, or a direction in it: across, up, deep. */
type Vector = readonly [number, number, number];

/** How far a ray is followed when it meets no land, in blocks. */
const FAR = 520;

/** How much wider than its body an animal is to a finger, and the least a plant or a thing is, in blocks, so a small one is not missed. */
const GRIP = { animal: 0.35, least: 0.45, plant: 0.6 } as const;

/** The dot product of two directions. */
function dot(a: Vector, b: Vector) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * How far along a ray, in blocks, it passes nearest a body's rough capsule,
 * none when it misses it: the body stands from `foot` up `height` blocks, `radius` blocks
 * thick, and the ray passes when its nearest approach to that upright line
 * is closer than the radius, in front of the lens and no farther than
 * `limit`.
 */
export function reachTo(
  ray: { readonly direction: Vector; readonly origin: Vector },
  body: {
    readonly foot: Vector;
    readonly height: number;
    readonly radius: number;
  },
  limit: number
) {
  const length = Math.hypot(...ray.direction);
  const way: Vector = [
    ray.direction[0] / length,
    ray.direction[1] / length,
    ray.direction[2] / length,
  ];
  const from: Vector = [
    ray.origin[0] - body.foot[0],
    ray.origin[1] - body.foot[1],
    ray.origin[2] - body.foot[2],
  ];
  // The nearest approach of the ray to the upright line through the foot, the height on that line held to the body.
  const lean = way[1];
  const level = 1 - lean * lean;
  const along =
    level < 1e-9 ? 0 : Math.max(0, (lean * from[1] - dot(way, from)) / level);
  const up = Math.min(body.height, Math.max(0, from[1] + along * lean));
  const reach = Math.max(0, dot(way, [-from[0], up - from[1], -from[2]]));
  const gap = Math.hypot(
    from[0] + way[0] * reach,
    from[1] + way[1] * reach - up,
    from[2] + way[2] * reach
  );
  return gap <= body.radius && reach <= limit
    ? Option.some(reach)
    : Option.none();
}

/** The nearest of what a ray reached, none when it reached nothing. */
function nearestOf<Found extends { readonly reach: number }>(
  found: readonly Found[]
) {
  return Arr.head(
    Arr.sort(
      found,
      Order.mapInput(Order.Number, (hit: Found) => hit.reach)
    )
  );
}

/**
 * What a ray from the lens meets first among the bodies of the world (ADR
 * 0050, W6 and W9), none when it meets only land or sky: an animal the
 * learner may stroke, before anything else it passes; else the nearest wild
 * plant, to shake, or thing, each as it stands. Nothing behind the land the
 * ray meets first is found.
 */
export function touchAt(
  scene: Scene,
  land: Land,
  ray: { readonly direction: Vector; readonly origin: Vector }
) {
  const limit =
    Option.match(landHit(land, ray.origin, ray.direction), {
      onNone: () => FAR,
      onSome: (hit) =>
        Math.hypot(
          hit.x - ray.origin[0],
          hit.y - ray.origin[1],
          hit.z - ray.origin[2]
        ),
    }) + 1;
  const animals = Arr.flatMap(scene.herd, (animal) => {
    const shape = shapeOf(animal.kind);
    return Option.match(
      reachTo(
        ray,
        {
          foot: [animal.x, standAt(land, animal.x, animal.z), animal.z],
          height: shape.height,
          radius: Math.max(shape.half, shape.reach) + GRIP.animal,
        },
        limit
      ),
      {
        onNone: () => [],
        onSome: (reach) => [{ _tag: "animal", animal, reach } as const],
      }
    );
  });
  const standing = Arr.flatMap(
    Arr.fromIterable(scene.roots.chunks),
    ([, root]) =>
      Arr.flatMap(root.standing, (stood) =>
        Option.match(
          reachTo(
            ray,
            {
              foot: [stood.x, stood.y, stood.z],
              height: stood.height,
              radius: Math.max(GRIP.least, stood.radius * GRIP.plant),
            },
            limit
          ),
          {
            onNone: () => [],
            onSome: (reach) => [
              { ...stood.origin, reach, x: stood.x, y: stood.y, z: stood.z },
            ],
          }
        )
      )
  );
  return Option.orElse(nearestOf(animals), () => nearestOf(standing));
}

/**
 * The scene with one of its animals stroked (ADR 0050, W6): it stands still
 * and faces the fox for a moment before it goes on. An animal that is not of
 * the scene changes nothing.
 */
export function pettedOf(scene: Scene, animal: Animal): Scene {
  const stroke = (dweller: Dweller): Dweller =>
    dweller === animal ? { ...dweller, pet: PET } : dweller;
  return {
    ...scene,
    cells: Arr.map(scene.cells, (cell) => ({
      ...cell,
      dwellers: Arr.map(cell.dwellers, stroke),
      villagers: Arr.map(cell.villagers, (villager) => ({
        ...villager,
        body: stroke(villager.body),
      })),
    })),
    herd: Arr.map(scene.herd, stroke),
  };
}
