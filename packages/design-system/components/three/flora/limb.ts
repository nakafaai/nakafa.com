import { ridgedAt } from "@repo/design-system/components/three/field/noise";
import { Array as Arr, Option, Schema } from "effect";

/** One place in a plant, as x, y and z in metres of the scene. */
const PlaceSchema = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
type Place = typeof PlaceSchema.Type;

/**
 * One woody or green axis of a plant: a trunk, a branch, a twig, a stem or a
 * root. It follows `path`, is `base` thick where it starts and `tip` thick
 * where it ends, swells by `flare` where it leaves what it grew from (the
 * buttress of a trunk, the collar of a branch) and stands `furrow` of its
 * radius deep in ridges, as bark does. `arc` is the share of the way around
 * that is swept: 1 for a whole axis, a half for one cut open along its length.
 */
export const LimbSchema = Schema.Struct({
  arc: Schema.Finite,
  base: Schema.Finite,
  flare: Schema.Finite,
  furrow: Schema.Finite,
  path: Schema.Array(PlaceSchema),
  seed: Schema.Int,
  sides: Schema.Int,
  tip: Schema.Finite,
});
export type Limb = typeof LimbSchema.Type;

/** The triangles of a part of a plant, as flat arrays a buffer geometry reads. */
const MeshSchema = Schema.Struct({
  indices: Schema.Array(Schema.Int),
  normals: Schema.Array(Schema.Finite),
  positions: Schema.Array(Schema.Finite),
  uvs: Schema.Array(Schema.Finite),
});
export type Mesh = typeof MeshSchema.Type;

/** Where a path with no places is taken to lie. */
const ORIGIN: Place = [0, 0, 0];

/**
 * The place at `index` of a path, held to its two ends, so a step before the
 * first place or past the last one stays on the path.
 */
export function placeAt(path: readonly Place[], index: number): Place {
  return (
    Option.getOrUndefined(
      Arr.get(path, Math.min(path.length - 1, Math.max(0, index)))
    ) ?? ORIGIN
  );
}

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

/** The point `along` of the way (0 to 1) through four control points of a Catmull-Rom curve. */
function blend(a: number, b: number, c: number, d: number, along: number) {
  const square = along * along;
  const cube = square * along;
  return (
    0.5 *
    (2 * b +
      (c - a) * along +
      (2 * a - 5 * b + 4 * c - d) * square +
      (3 * b - a - 3 * c + d) * cube)
  );
}

/**
 * A smooth path through `points` with `steps` spans: a Catmull-Rom curve, so
 * an axis drawn through a few places bends like a grown thing with no
 * corner at any of them.
 */
export function smoothPath(points: readonly Place[], steps: number) {
  const last = points.length - 1;
  const at = (index: number) => placeAt(points, index);
  return Arr.makeBy(steps + 1, (step): Place => {
    const place = (step / steps) * last;
    const span = Math.min(last - 1, Math.floor(place));
    const along = place - span;
    const [a, b, c, d] = [at(span - 1), at(span), at(span + 1), at(span + 2)];
    return [
      blend(a[0], b[0], c[0], d[0], along),
      blend(a[1], b[1], c[1], d[1], along),
      blend(a[2], b[2], c[2], d[2], along),
    ];
  });
}

/** The direction an axis runs at each place of its path. */
function tangents(path: readonly Place[]) {
  return Arr.map(path, (_, index) => {
    const ahead = placeAt(path, index + 1);
    const behind = placeAt(path, index - 1);
    return unit([
      ahead[0] - behind[0],
      ahead[1] - behind[1],
      ahead[2] - behind[2],
    ]);
  });
}

/**
 * A direction across the axis at each place of its path that never spins
 * about it: each is the one before, laid flat against the new direction of
 * the axis, so the bark of a bent branch does not twist.
 */
function sides(directions: readonly Place[]) {
  const first = placeAt(directions, 0);
  const start = unit(
    cross(first, Math.abs(first[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])
  );
  return Arr.scan(Arr.drop(directions, 1), start, (before, direction) => {
    const lean =
      before[0] * direction[0] +
      before[1] * direction[1] +
      before[2] * direction[2];
    return unit([
      before[0] - direction[0] * lean,
      before[1] - direction[1] * lean,
      before[2] - direction[2] * lean,
    ]);
  });
}

/**
 * The surface of one limb: a tube swept along its path whose radius tapers
 * from base to tip, swells at its collar and rises and falls in the ridges of
 * its bark. Its normals point straight out of the axis, so no seam shows where
 * the bark closes on itself, and its texture coordinates run once around and
 * once per girth along, so bark painted on it keeps its real size.
 */
export function limbMesh(limb: Limb): Mesh {
  const rings = limb.path.length;
  const directions = tangents(limb.path);
  const across = sides(directions);
  const spans = Arr.zipWith(
    Arr.drop(limb.path, 1),
    limb.path,
    (place, before) =>
      Math.hypot(
        place[0] - before[0],
        place[1] - before[1],
        place[2] - before[2]
      )
  );
  const lengths = Arr.scan(spans, 0, (sum, span) => sum + span);
  const total = Arr.lastNonEmpty(lengths);
  const girth = 2 * Math.PI * limb.base;
  const along = Math.max(1, Math.round((total / girth) * 3));
  const vertices = Arr.flatMap(Arr.range(0, rings - 1), (ring) => {
    const share = ring / (rings - 1);
    const place = placeAt(limb.path, ring);
    const side = placeAt(across, ring);
    const other = cross(placeAt(directions, ring), side);
    const taper = limb.base + (limb.tip - limb.base) * share ** 0.85;
    const collar = 1 + limb.flare * Math.exp(-share * 9);
    return Arr.map(Arr.range(0, limb.sides), (step) => {
      const around = step / limb.sides;
      const angle = (around - 0.5) * 2 * Math.PI * limb.arc;
      const out: Place = [
        Math.cos(angle) * side[0] + Math.sin(angle) * other[0],
        Math.cos(angle) * side[1] + Math.sin(angle) * other[1],
        Math.cos(angle) * side[2] + Math.sin(angle) * other[2],
      ];
      const ridge = ridgedAt(around % 1, share, 5, along, limb.seed) - 0.5;
      const buttress = Math.cos(angle * 4 + limb.seed) * (collar - 1) * 0.22;
      const radius = taper * (collar + buttress + limb.furrow * ridge);
      return {
        normal: out,
        position: [
          place[0] + out[0] * radius,
          place[1] + out[1] * radius,
          place[2] + out[2] * radius,
        ],
        uv: [around, Number(lengths[ring]) / girth],
      };
    });
  });
  const stride = limb.sides + 1;
  const indices = Arr.flatMap(Arr.range(0, rings - 2), (ring) =>
    Arr.flatMap(Arr.range(0, limb.sides - 1), (step) => {
      const corner = ring * stride + step;
      const above = corner + stride;
      return [corner, corner + 1, above, corner + 1, above + 1, above];
    })
  );
  return {
    indices,
    normals: Arr.flatMap(vertices, (vertex) => vertex.normal),
    positions: Arr.flatMap(vertices, (vertex) => vertex.position),
    uvs: Arr.flatMap(vertices, (vertex) => vertex.uv),
  };
}

/** Several meshes as one, so a whole plant's wood draws in one call. */
export function joinMeshes(meshes: readonly Mesh[]): Mesh {
  const starts = Arr.scan(
    meshes,
    0,
    (sum, mesh) => sum + mesh.positions.length / 3
  );
  return {
    indices: Arr.flatMap(meshes, (mesh, index) =>
      Arr.map(mesh.indices, (corner) => corner + Number(starts[index]))
    ),
    normals: Arr.flatMap(meshes, (mesh) => mesh.normals),
    positions: Arr.flatMap(meshes, (mesh) => mesh.positions),
    uvs: Arr.flatMap(meshes, (mesh) => mesh.uvs),
  };
}
