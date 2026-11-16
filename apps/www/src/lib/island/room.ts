import { HEIGHT } from "@repo/backend/confect/island/world";
import { Array as Arr, Option, Record as Rec } from "effect";
import type { Animal } from "@/lib/island/life";
import { KIND, LOOK } from "@/lib/island/look";
import { BodyKind, bodyFaces } from "@/lib/island/models/kinds";
import { boundsOf } from "@/lib/island/models/parts";
import { isPassable } from "@/lib/island/plants";
import { blockAt, type Cells } from "@/lib/island/world";

/** How much of the world a body takes (ADR 0047, D22): half its width, half its length, and its height, in blocks. */
function shapeOf(kind: BodyKind) {
  const bounds = boundsOf(bodyFaces(kind));
  return {
    half: (bounds.x[1] - bounds.x[0]) / 2,
    height: bounds.y[1] - bounds.y[0],
    reach: (bounds.z[1] - bounds.z[0]) / 2,
  };
}

/** Every body's shape, measured once from its own model, so the room it takes is the room it is drawn in. */
const SHAPES = Rec.fromEntries(
  Arr.map(BodyKind.literals, (kind) => [kind, shapeOf(kind)] as const)
);

/**
 * The points a body's footprint is checked at, each with the body's half
 * width around it: its middle, and for a long body such as a cow its front
 * and back, along the way it faces.
 */
function pointsOf(kind: Animal["kind"], x: number, z: number, yaw: number) {
  const { half, reach } = SHAPES[kind];
  const along = Math.max(0, reach - half);
  if (along < 0.05) {
    return [[x, z] as const];
  }
  const [dx, dz] = [Math.sin(yaw) * along, Math.cos(yaw) * along];
  return [
    [x, z] as const,
    [x + dx, z + dz] as const,
    [x - dx, z - dz] as const,
  ];
}

/** The way an animal faces: toward its goal, or straight ahead when it stands on it. */
export function headingOf(animal: Animal) {
  const [dx, dz] = [animal.tx - animal.x, animal.tz - animal.z];
  return Math.hypot(dx, dz) > 0.05 ? Math.atan2(dx, dz) : 0;
}

/** The first open cell above a column's ground, plants being no ground, none over an empty column. */
export function floorOf(cells: Cells, x: number, z: number) {
  for (let y = HEIGHT - 1; y >= 0; y -= 1) {
    const kind = LOOK.kinds[blockAt(cells, Math.floor(x), y, Math.floor(z))];
    if (kind !== KIND.air && kind !== KIND.cross) {
      return Option.some(y + 1);
    }
  }
  return Option.none();
}

/** Whether a column is free from `floor` up for `height` blocks: air or plants low enough to push aside, nothing a body would pass through. */
function openAbove(
  cells: Cells,
  x: number,
  z: number,
  floor: number,
  height: number
) {
  return Arr.every(
    Arr.makeBy(Math.ceil(height), (step) => floor + step),
    (y) => isPassable(blockAt(cells, Math.floor(x), y, Math.floor(z)))
  );
}

/**
 * Whether an animal fits at (x, z) facing `yaw` (ADR 0047, D22): every point
 * of its footprint, its half width around, stands on the same floor as its
 * middle, with room above for its whole height, and that floor is `floor`
 * when one is given, so a walker never climbs a step or a wall. A plant under
 * a knee is pushed aside; a taller plant, a wall, a step or a roof is not.
 */
export function roomOf(
  cells: Cells,
  kind: Animal["kind"],
  x: number,
  z: number,
  yaw: number,
  floor: Option.Option<number> = Option.none()
) {
  const { half, height } = SHAPES[kind];
  return Option.match(floorOf(cells, x, z), {
    onNone: () => false,
    onSome: (middle) =>
      Option.getOrElse(
        Option.map(floor, (wanted) => wanted === middle),
        () => true
      ) &&
      Arr.every(pointsOf(kind, x, z, yaw), ([px, pz]) =>
        Arr.every(
          [
            [px - half, pz - half],
            [px + half, pz - half],
            [px - half, pz + half],
            [px + half, pz + half],
          ] as const,
          ([cx, cz]) =>
            Option.exists(floorOf(cells, cx, cz), (at) => at === middle) &&
            openAbove(cells, cx, cz, middle, height)
        )
      ),
  });
}

/** Whether two animals' footprints overlap, measured between their nearest points. */
export function touches(a: Animal, b: Animal) {
  const gap = SHAPES[a.kind].half + SHAPES[b.kind].half;
  return Arr.some(pointsOf(a.kind, a.x, a.z, headingOf(a)), ([ax, az]) =>
    Arr.some(
      pointsOf(b.kind, b.x, b.z, headingOf(b)),
      ([bx, bz]) => Math.hypot(ax - bx, az - bz) < gap
    )
  );
}
