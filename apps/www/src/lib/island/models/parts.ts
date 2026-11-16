import { Array as Arr, Schema } from "effect";
import { SCALE } from "@/lib/island/scale";

/** A point or a direction: across, up, deep. */
const Vec = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
type Vec = typeof Vec.Type;

/** A color as red, green and blue from 0 to 1. */
const Rgb = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
type Rgb = typeof Rgb.Type;

/** One flat face of a model: its corners in order around its front, and its color. */
const Face = Schema.Struct({ color: Rgb, corners: Schema.Array(Vec) });
type Face = typeof Face.Type;

/** A color from its hex digits, such as `0xc8653a`. */
export function rgb(hex: number): Rgb {
  return [
    Math.floor(hex / 0x1_00_00) / 255,
    (Math.floor(hex / 0x1_00) % 0x1_00) / 255,
    (hex % 0x1_00) / 255,
  ];
}

/** Meters in blocks, so a model is measured as the world is (ADR 0047, D10 and D21). */
export function meters(value: number) {
  return value / SCALE.block;
}

/**
 * A box from `low` to `high`, its top shrunk toward its middle by `taper`
 * (0 keeps it square, 1 draws it to a point), drawn as six flat faces whose
 * corners run counter-clockwise seen from outside.
 */
export function box(low: Vec, high: Vec, color: Rgb, taper = 0) {
  const mid = [(low[0] + high[0]) / 2, (low[2] + high[2]) / 2] as const;
  const top = (x: number, z: number): Vec => [
    x + (mid[0] - x) * taper,
    high[1],
    z + (mid[1] - z) * taper,
  ];
  const [x0, y0, z0] = low;
  const [x1, , z1] = high;
  const b = [
    [x0, y0, z0],
    [x1, y0, z0],
    [x1, y0, z1],
    [x0, y0, z1],
  ] as const;
  const t = [top(x0, z0), top(x1, z0), top(x1, z1), top(x0, z1)] as const;
  const faces: readonly (readonly Vec[])[] = [
    [b[0], b[1], b[2], b[3]],
    [t[3], t[2], t[1], t[0]],
    [b[3], b[2], t[2], t[3]],
    [b[1], b[0], t[0], t[1]],
    [b[2], b[1], t[1], t[2]],
    [b[0], b[3], t[3], t[0]],
  ];
  return Arr.map(faces, (corners): Face => ({ color, corners }));
}

/** One cross-section of a loft: where along the body it stands (`z`), its half width, and its lowest and highest point. */
const Section = Schema.Struct({
  high: Schema.Finite,
  low: Schema.Finite,
  width: Schema.Finite,
  z: Schema.Finite,
});
type Section = typeof Section.Type;

/**
 * A body lofted through cross-sections along its length (ADR 0047, D21): four
 * sides from each section to the next, closed by a cap at either end, for
 * hulls that swell and taper, such as a whale's or a cow's.
 */
export function loft(sections: Arr.NonEmptyReadonlyArray<Section>, color: Rgb) {
  const corners = (s: Section) =>
    [
      [-s.width, s.low, s.z],
      [s.width, s.low, s.z],
      [s.width, s.high, s.z],
      [-s.width, s.high, s.z],
    ] as const;
  const sides = Arr.flatMap(
    Arr.zip(Arr.dropRight(sections, 1), Arr.drop(sections, 1)),
    ([from, to]) => {
      const [a, b] = [corners(from), corners(to)];
      return Arr.map(
        [
          [a[0], a[1], b[1], b[0]],
          [a[1], a[2], b[2], b[1]],
          [a[2], a[3], b[3], b[2]],
          [a[3], a[0], b[0], b[3]],
        ],
        (quad): Face => ({ color, corners: quad })
      );
    }
  );
  const first = corners(Arr.headNonEmpty(sections));
  const last = corners(Arr.lastNonEmpty(sections));
  return Arr.appendAll(sides, [
    { color, corners: [first[3], first[2], first[1], first[0]] },
    { color, corners: [last[0], last[1], last[2], last[3]] },
  ]);
}

/** Turns faces around the vertical axis through `pivot` by `angle`, counter-clockwise seen from above. */
export function turned(
  faces: readonly Face[],
  angle: number,
  pivot: Vec = [0, 0, 0]
) {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return Arr.map(faces, (face) => ({
    color: face.color,
    corners: Arr.map(face.corners, ([x, y, z]): Vec => {
      const [dx, dz] = [x - pivot[0], z - pivot[2]];
      return [
        pivot[0] + dx * cos + dz * sin,
        y,
        pivot[2] - dx * sin + dz * cos,
      ];
    }),
  }));
}

/** Tips faces forward around the across axis through `pivot` by `angle`, the top toward +z. */
export function tipped(
  faces: readonly Face[],
  angle: number,
  pivot: Vec = [0, 0, 0]
) {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return Arr.map(faces, (face) => ({
    color: face.color,
    corners: Arr.map(face.corners, ([x, y, z]): Vec => {
      const [dy, dz] = [y - pivot[1], z - pivot[2]];
      return [
        x,
        pivot[1] + dy * cos - dz * sin,
        pivot[2] + dy * sin + dz * cos,
      ];
    }),
  }));
}

/** Mirrors faces across the middle plane (x = 0), keeping each face's front outward. */
export function mirrored(faces: readonly Face[]) {
  return Arr.map(faces, (face) => ({
    color: face.color,
    corners: Arr.reverse(Arr.map(face.corners, ([x, y, z]): Vec => [-x, y, z])),
  }));
}

/** The outward direction of a face, from its first three corners. */
export function normalOf(corners: readonly Vec[]) {
  const [a, b, c] = corners;
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const n = [
    u[1] * v[2] - u[2] * v[1],
    u[2] * v[0] - u[0] * v[2],
    u[0] * v[1] - u[1] * v[0],
  ];
  const length = Math.hypot(n[0], n[1], n[2]);
  return length < 1e-9
    ? ([0, 0, 0] as const)
    : ([n[0] / length, n[1] / length, n[2] / length] as const);
}

/** How many numbers each corner of a drawn model holds: its place, its face's direction and its color. */
export const MODEL_STRIDE = 9;

/**
 * A model's faces as triangles for the GPU (ADR 0047, D21): every face fanned
 * from its first corner, each corner with its place, its face's direction
 * (so the face is lit flat and its edges outlined) and its color. Faces
 * folded to nothing are left out.
 */
export function flatten(faces: readonly Face[]) {
  const solid = Arr.filter(faces, (face) => {
    const [x, y, z] = normalOf(face.corners);
    return x !== 0 || y !== 0 || z !== 0;
  });
  const triangles = Arr.flatMap(solid, (face) => {
    const normal = normalOf(face.corners);
    return Arr.makeBy(face.corners.length - 2, (index) =>
      Arr.map(
        [face.corners[0], face.corners[index + 1], face.corners[index + 2]],
        (corner) => [...corner, ...normal, ...face.color]
      )
    );
  });
  return Float32Array.from(Arr.flatten(Arr.flatten(triangles)));
}

/** The box around a model: its lowest and highest corner. */
export function boundsOf(faces: readonly Face[]) {
  const corners = Arr.flatMap(faces, (face) => face.corners);
  const axis = (index: 0 | 1 | 2) => {
    const values = Arr.map(corners, (corner) => corner[index]);
    return [Math.min(...values), Math.max(...values)] as const;
  };
  return { x: axis(0), y: axis(1), z: axis(2) };
}

export type { Face };
