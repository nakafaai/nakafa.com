import { Array as Arr, Schema } from "effect";
import { SCALE } from "@/lib/island/scale";

/** A point or a direction: across, up, deep. */
const Vec = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
type Vec = typeof Vec.Type;

/** A color as red, green and blue from 0 to 1. */
const Rgb = Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]);
type Rgb = typeof Rgb.Type;

/**
 * How a part of a living body moves (ADR 0047, D48), which the body program
 * plays from the numbers `flatten` bakes into every corner, so a frame does
 * no work on the CPU:
 *
 * - `sway`: a wave that runs from head to tail across the body, the way a
 *   fish or a shark swims, growing toward the tail;
 * - `heave`: the same wave up and down, the way a whale or a dolphin beats
 *   its flukes;
 * - `stride`: a leg or an arm swinging forward and back about the height
 *   `pivot`, only while its body walks, a left limb half a cycle after its
 *   right twin;
 * - `flap`: a wing or a flipper rising and falling about the distance `pivot`
 *   from the middle;
 * - `bend`: the same wave as `sway`, only while the body walks, so a walking
 *   animal's spine flexes from side to side in step with its legs (D49);
 * - `lean`: a stalk rooted at the height `pivot` swaying in the current,
 *   more the higher up it, the sway climbing it as a wave, the way kelp,
 *   seagrass, a sea fan or an anemone's tentacles move (D50);
 * - `spin`: a wheel turning steadily about the front-to-back axis that runs
 *   through the model's middle at the height `pivot`, counter-clockwise seen
 *   from the front, the way a windmill's sails turn (ADR 0050, W2).
 *
 * `rate` is in radians a second, `phase` in radians, and `reach` the swing's
 * size: a share of the body's length for a wave, an angle in radians for a
 * stride, a flap or a lean, and nothing for a spin, which only turns. `waves`
 * is how many wavelengths run along the body, or up a leaning stalk a block of
 * its height.
 */
const Rig = Schema.Struct({
  mode: Schema.Literals([
    "sway",
    "heave",
    "stride",
    "flap",
    "bend",
    "lean",
    "spin",
  ]),
  phase: Schema.Finite,
  pivot: Schema.Finite,
  rate: Schema.Finite,
  reach: Schema.Finite,
  waves: Schema.Finite,
});
type Rig = typeof Rig.Type;

/** One flat face of a model: its corners in order around its front, its color, and how it moves, when it does. */
const Face = Schema.Struct({
  color: Rgb,
  corners: Schema.Array(Vec),
  rig: Schema.optional(Rig),
});
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

/** Tips faces forward around the across axis through `pivot` by `angle`, the top toward +z. */
export function tipped(
  faces: readonly Face[],
  angle: number,
  pivot: Vec = [0, 0, 0]
) {
  const [cos, sin] = [Math.cos(angle), Math.sin(angle)];
  return Arr.map(faces, (face) => ({
    ...face,
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
    ...face,
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

/** How many numbers each corner of a drawn model holds: its place, its face's direction, its color and its motion. */
export const MODEL_STRIDE = 13;

/** The motion numbers of a rigid corner: no reach, no phase, no rate, mode none. */
const STILL = [0, 0, 0, 0] as const;

/** The number the body program reads for each mode; 0 is a part that never moves. */
const MODES = {
  bend: 5,
  flap: 4,
  heave: 2,
  lean: 6,
  spin: 7,
  stride: 3,
  sway: 1,
} as const;

/**
 * The motion numbers of one corner (D48): how far it swings, its phase, its
 * rate and its mode. A wave's swing grows from a fifth of its reach at the
 * head to all of it at the tail and lags along the body by its `waves`; a
 * stride's grows with the depth below its pivot, a flap's with the distance
 * out from its pivot, a lean's with the height above its pivot. A spin has no
 * swing: its first number is the height of its axis instead, the same for
 * every corner, so the body program turns each corner about it.
 */
function motionOf(
  rig: Rig,
  [x, y, z]: Vec,
  [tail, head]: readonly [number, number]
) {
  const mode = MODES[rig.mode];
  if (rig.mode === "stride") {
    // A left limb steps half a cycle after its right twin, so a mirrored pair walks instead of hopping.
    const side = x < 0 ? Math.PI : 0;
    return [
      rig.reach * Math.max(0, rig.pivot - y),
      rig.phase + side,
      rig.rate,
      mode,
    ];
  }
  if (rig.mode === "flap") {
    return [
      rig.reach * Math.max(0, Math.abs(x) - rig.pivot),
      rig.phase,
      rig.rate,
      mode,
    ];
  }
  if (rig.mode === "spin") {
    return [rig.pivot, rig.phase, rig.rate, mode];
  }
  if (rig.mode === "lean") {
    const height = Math.max(0, y - rig.pivot);
    return [
      rig.reach * height,
      rig.phase + height * rig.waves * 2 * Math.PI,
      rig.rate,
      mode,
    ];
  }
  const length = head - tail;
  const back = length > 0 ? (head - z) / length : 0;
  const swing = rig.reach * length * (0.2 + 0.8 * back * back);
  return [swing, rig.phase + back * rig.waves * 2 * Math.PI, rig.rate, mode];
}

/** The faces that do not move yet, moving by `rig`, and the rest as they were: a body's trunk flexing around its own striding limbs (D49). */
export function flexed(faces: readonly Face[], rig: Rig): readonly Face[] {
  return Arr.map(faces, (face) =>
    face.rig === undefined ? { ...face, rig } : face
  );
}

/** The faces with every one moving by `rig` (D48). */
export function rigged(faces: readonly Face[], rig: Rig): readonly Face[] {
  return Arr.map(faces, (face) => ({ ...face, rig }));
}

/**
 * A model's faces as triangles for the GPU (ADR 0047, D21): every face fanned
 * from its first corner, each corner with its place, its face's direction
 * (so the face is lit flat and its edges outlined), its color and its motion
 * numbers (D48). Faces folded to nothing are left out.
 */
export function flatten(faces: readonly Face[]) {
  const solid = Arr.filter(faces, (face) => {
    const [x, y, z] = normalOf(face.corners);
    return x !== 0 || y !== 0 || z !== 0;
  });
  const { z: length } = boundsOf(faces);
  const triangles = Arr.flatMap(solid, (face) => {
    const normal = normalOf(face.corners);
    return Arr.makeBy(face.corners.length - 2, (index) =>
      Arr.map(
        [face.corners[0], face.corners[index + 1], face.corners[index + 2]],
        (corner) => [
          ...corner,
          ...normal,
          ...face.color,
          ...(face.rig === undefined
            ? STILL
            : motionOf(face.rig, corner, length)),
        ]
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

export type { Face, Rgb, Rig, Vec };
