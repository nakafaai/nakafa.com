import { Array as Arr, MutableHashMap, Option, Schema } from "effect";
import type { Land } from "@/lib/island/land/ground";
import { coverAt, depthAt, slopeAt } from "@/lib/island/land/ground";
import type { Animal } from "@/lib/island/life";
import type { Model } from "@/lib/island/models/kinds";
import { modelFaces } from "@/lib/island/models/kinds";
import { boundsOf } from "@/lib/island/models/parts";

/** Where a creature keeps its feet: on dry ground, on a beach's sand, afloat on water, or wading along a bank. */
export const Ground = Schema.Literals(["dry", "sand", "afloat", "bank"]);
export type Ground = typeof Ground.Type;

/** How steep ground may be before no creature stands on it: its rise over one block. */
const STEEP = 0.7;

/**
 * How deep water stands for each ground, in blocks: a floater needs `afloat`
 * under it, dry ground has no more than `dry` over it, sand is washed no
 * deeper than `wash`, and a wader keeps between `shore` over the water's face
 * and `wade` under it.
 */
const WATER = {
  afloat: 0.3,
  dry: 0.03,
  shore: -0.25,
  wade: 0.45,
  wash: 0.12,
} as const;

/** Whether a creature that keeps to `ground` can stand at a place of the land. */
export function suitsOf(land: Land, ground: Ground, x: number, z: number) {
  const depth = depthAt(land, x, z);
  if (ground === "afloat") {
    return depth > WATER.afloat;
  }
  if (ground === "bank") {
    return depth > WATER.shore && depth < WATER.wade;
  }
  if (slopeAt(land, x, z) > STEEP) {
    return false;
  }
  return ground === "sand"
    ? depth < WATER.wash && coverAt(land, x, z) === "sand"
    : depth <= WATER.dry;
}

/** The model an animal is drawn as: a body of the world's own by its name, or a species of the catalogue by its index. */
export function modelOf(kind: Animal["kind"]): Model {
  return typeof kind === "number"
    ? { _tag: "species", index: kind }
    : { _tag: "body", kind };
}

/** Every body's shape, measured once from its own model, so the room it takes is the room it is drawn in. */
const shapes = MutableHashMap.empty<
  Animal["kind"],
  { readonly half: number; readonly height: number; readonly reach: number }
>();

/** How much of the world a body takes (ADR 0047, D22): half its width, half its length, and its height, in blocks. */
export function shapeOf(kind: Animal["kind"]) {
  return Option.getOrElse(MutableHashMap.get(shapes, kind), () => {
    const bounds = boundsOf(modelFaces(modelOf(kind)));
    const shape = {
      half: (bounds.x[1] - bounds.x[0]) / 2,
      height: bounds.y[1] - bounds.y[0],
      reach: (bounds.z[1] - bounds.z[0]) / 2,
    };
    MutableHashMap.set(shapes, kind, shape);
    return shape;
  });
}

/**
 * The points a body's footprint is checked at, each with the body's half
 * width around it: its middle, and for a long body such as a cow its front
 * and back, along the way it faces.
 */
function pointsOf(kind: Animal["kind"], x: number, z: number, yaw: number) {
  const { half, reach } = shapeOf(kind);
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

/**
 * Whether a body fits at a place facing `yaw` (ADR 0047, D22): every point of
 * its footprint stands on the ground it keeps to, and none stands in what
 * `blocked` answers for: a trunk, a rock or a wall, asked with the body's half
 * width.
 */
export function roomOf(
  land: Land,
  body: { readonly ground: Ground; readonly kind: Animal["kind"] },
  place: { readonly x: number; readonly yaw: number; readonly z: number },
  blocked: (x: number, z: number, half: number) => boolean
) {
  const { half } = shapeOf(body.kind);
  return Arr.every(
    pointsOf(body.kind, place.x, place.z, place.yaw),
    ([x, z]) => suitsOf(land, body.ground, x, z) && !blocked(x, z, half)
  );
}

/** Whether two animals' footprints overlap, measured between their nearest points. */
export function touches(a: Animal, b: Animal) {
  const gap = shapeOf(a.kind).half + shapeOf(b.kind).half;
  return Arr.some(pointsOf(a.kind, a.x, a.z, headingOf(a)), ([ax, az]) =>
    Arr.some(
      pointsOf(b.kind, b.x, b.z, headingOf(b)),
      ([bx, bz]) => Math.hypot(ax - bx, az - bz) < gap
    )
  );
}
