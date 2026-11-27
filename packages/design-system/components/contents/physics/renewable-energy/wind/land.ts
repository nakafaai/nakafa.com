import type { Site } from "@repo/design-system/components/contents/physics/renewable-energy/wind/site";
import { fractalAt } from "@repo/design-system/components/three/field/noise";
import { Array as Arr, Schema } from "effect";
import { BufferGeometry, Float32BufferAttribute } from "three";

/**
 * The land each site gives the turbine, in rotor radii with the turbine's
 * foot at the origin: the open floor of a valley between two ridges, the
 * crown of a hill above the plain, and a beach with the sea in front.
 */

/**
 * One rise of land seen from above as a round: level across its `plateau`
 * share of the `radius`, then falling by `drop` to its rim in a smooth
 * slope that `rough` breaks into hollows and spurs.
 */
const LandSchema = Schema.Struct({
  drop: Schema.Finite,
  plateau: Schema.Finite,
  radius: Schema.Finite,
  rough: Schema.Finite,
});
type Land = typeof LandSchema.Type;

/** Where a rise stands and what it is. */
const RiseSchema = Schema.Struct({
  at: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  land: LandSchema,
});

/** The open plain a site's rises stand on: level as far as the haze, where it fades as the stage's own ground does. */
const PLAIN = { drop: 0.02, plateau: 0.99, radius: 70, rough: 0 } as const;

/**
 * The rises of each site, around a turbine that always stands on the origin.
 * The hill and the valley end with the plain their rises stand on, whose
 * level the rises come down to and meet without a step.
 */
export const SITE_RISES = {
  coast: [
    {
      at: [-26.83, 0, -54.78],
      land: { drop: 0.45, plateau: 0.9887, radius: 62, rough: 0.03 },
    },
  ],
  hill: [
    {
      at: [0, 0, 0],
      land: { drop: 1.2, plateau: 0.05, radius: 7, rough: 0.03 },
    },
    { at: [0, -1.197, 0], land: PLAIN },
  ],
  valley: [
    {
      at: [-12, 4.69, -9],
      land: { drop: 4.7, plateau: 0, radius: 10, rough: 1.5 },
    },
    {
      at: [11, 6.09, -13],
      land: { drop: 6.1, plateau: 0, radius: 12, rough: 1.9 },
    },
    { at: [0, 0, 0], land: PLAIN },
  ],
} as const satisfies Record<Site, readonly (typeof RiseSchema.Type)[]>;

/** What lies under one site: what its land is made of, and the level of its sea. */
const PlaceSchema = Schema.Struct({
  ground: Schema.Literals(["grass", "sand"]),
  sea: Schema.optionalKey(Schema.Finite),
});

/**
 * What lies under each site: the grass of the hill and the valley, and the
 * sand of the coast with the sea that stands just below its beach. The
 * stage lays no ground of its own under any of them: the site's rises are
 * its land.
 */
export const SITE_GROUND = {
  coast: { ground: "sand", sea: -0.12 },
  hill: { ground: "grass" },
  valley: { ground: "grass" },
} as const satisfies Record<Site, typeof PlaceSchema.Type>;

/** The height of a rise at a place `x`, `z` from its middle, 0 on its plateau. */
export function landHeight(land: Land, x: number, z: number) {
  const share = Math.hypot(x, z) / land.radius;
  const slope = Math.min(
    1,
    Math.max(0, (share - land.plateau) / (1 - land.plateau))
  );
  const relief =
    fractalAt(
      x / (2 * land.radius) + 0.5,
      z / (2 * land.radius) + 0.5,
      5,
      5,
      23
    ) - 0.5;
  return (
    -land.drop * (0.5 - 0.5 * Math.cos(Math.PI * slope)) +
    land.rough * relief * Math.sin(Math.PI * slope)
  );
}

/** How many rings and spokes a rise is meshed with, and the share of the rings that mesh its plateau. */
const RINGS = 56;
const SPOKES = 128;
const LEVEL_RINGS = 0.25;

/**
 * How far out a ring lies, as a share of the radius: a quarter of the rings
 * cover the level plateau and the rest crowd onto the slope, where the
 * land turns.
 */
export function ringShare(land: Land, ring: number) {
  const share = ring / RINGS;
  return share < LEVEL_RINGS
    ? (land.plateau * share) / LEVEL_RINGS
    : land.plateau +
        ((1 - land.plateau) * (share - LEVEL_RINGS)) / (1 - LEVEL_RINGS);
}

/**
 * A rise as a mesh that looks up. Its texture is laid as the stage lays its
 * own ground's: once across a round `span` wide about the scene's middle,
 * so the rise and the ground round it are painted as one surface with no
 * seam where they meet.
 *
 * @param rise - Where the rise stands and what it is
 * @param span - The width of the stage's ground, in scene units
 */
export function landGeometry(
  { at, land }: typeof RiseSchema.Type,
  span: number
) {
  const row = SPOKES + 1;
  const spots = Arr.flatMap(Arr.range(0, RINGS), (ring) =>
    Arr.map(Arr.range(0, SPOKES), (spoke) => {
      const turn = (spoke / SPOKES) * 2 * Math.PI;
      const out = ringShare(land, ring) * land.radius;
      return [Math.cos(turn) * out, Math.sin(turn) * out] as const;
    })
  );
  const faces = Arr.flatMap(Arr.range(0, RINGS - 1), (ring) =>
    Arr.flatMap(Arr.range(0, SPOKES - 1), (spoke) => {
      const near = ring * row + spoke;
      const far = near + row;
      return [near, near + 1, far, near + 1, far + 1, far];
    })
  );
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(
      Arr.flatMap(spots, ([x, z]) => [x, landHeight(land, x, z), z]),
      3
    )
  );
  geometry.setAttribute(
    "uv",
    new Float32BufferAttribute(
      Arr.flatMap(spots, ([x, z]) => [
        (x + at[0]) / span + 0.5,
        0.5 - (z + at[2]) / span,
      ]),
      2
    )
  );
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}
