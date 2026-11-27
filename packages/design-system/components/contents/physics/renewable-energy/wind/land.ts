import type { Site } from "@repo/design-system/components/contents/physics/renewable-energy/wind/site";
import { fractalAt } from "@repo/design-system/components/three/field/noise";
import { Schema } from "effect";
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

/** The rises of each site, around a turbine that always stands on the origin. */
export const SITE_RISES = {
  coast: [
    {
      at: [-16.9, 0, -34.5],
      land: { drop: 0.6, plateau: 0.975, radius: 40, rough: 0.04 },
    },
  ],
  hill: [
    {
      at: [0, 0, 0],
      land: { drop: 1.2, plateau: 0.05, radius: 7, rough: 0.16 },
    },
  ],
  valley: [
    {
      at: [-12, 4.6, -9],
      land: { drop: 4.7, plateau: 0, radius: 10, rough: 1.5 },
    },
    {
      at: [11, 6, -13],
      land: { drop: 6.1, plateau: 0, radius: 12, rough: 1.9 },
    },
  ],
} as const satisfies Record<Site, readonly (typeof RiseSchema.Type)[]>;

/**
 * What the stage lays under each site: the valley's floor at the turbine's
 * foot, the plain below the hill's crown, and nothing under the coast, where
 * the sea stands just below the beach.
 */
export const SITE_GROUND = {
  coast: { floor: undefined, ground: "sand", sea: -0.14 },
  hill: { floor: -1.15, ground: "grass", sea: undefined },
  valley: { floor: 0, ground: "grass", sea: undefined },
} as const satisfies Record<
  Site,
  {
    readonly floor: number | undefined;
    readonly ground: "grass" | "sand";
    readonly sea: number | undefined;
  }
>;

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
 * A rise as a mesh that looks up, its texture laid once across its whole
 * width so a ground texture can repeat over it at its real size.
 */
export function landGeometry(land: Land) {
  const positions: number[] = [];
  const places: number[] = [];
  const faces: number[] = [];
  const row = SPOKES + 1;
  for (let ring = 0; ring <= RINGS; ring += 1) {
    for (let spoke = 0; spoke <= SPOKES; spoke += 1) {
      const turn = (spoke / SPOKES) * 2 * Math.PI;
      const x = Math.cos(turn) * ringShare(land, ring) * land.radius;
      const z = Math.sin(turn) * ringShare(land, ring) * land.radius;
      positions.push(x, landHeight(land, x, z), z);
      places.push(x / (2 * land.radius) + 0.5, z / (2 * land.radius) + 0.5);
    }
  }
  for (let ring = 0; ring < RINGS; ring += 1) {
    for (let spoke = 0; spoke < SPOKES; spoke += 1) {
      const near = ring * row + spoke;
      const far = near + row;
      faces.push(near, near + 1, far, near + 1, far + 1, far);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(places, 2));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}
