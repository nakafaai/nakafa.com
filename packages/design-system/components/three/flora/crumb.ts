import {
  chanceAt,
  fractalAt,
} from "@repo/design-system/components/three/field/noise";
import type { Mesh } from "@repo/design-system/components/three/flora/limb";
import { Array as Arr, Schema } from "effect";

/**
 * A bed of soil: how far it reaches from its middle, how high it is heaped
 * there, how many crumbs lie loose on it and which bed it is.
 */
const SoilSchema = Schema.Struct({
  count: Schema.Int,
  heap: Schema.Finite,
  radius: Schema.Finite,
  seed: Schema.Int,
});
export type Soil = typeof SoilSchema.Type;

/** How many rings and how many steps around the surface of a bed is laid out in. */
const RINGS = 20;
const AROUND = 48;

/**
 * How high the soil stands at one place of its bed: heaped at the middle,
 * falling to nothing at the rim, and lumpy all over, as raked soil is.
 */
export function soilHeight(soil: Soil, x: number, z: number) {
  const far = Math.min(1, Math.hypot(x, z) / soil.radius);
  const lumps =
    fractalAt(
      x / soil.radius / 2 + 0.5,
      z / soil.radius / 2 + 0.5,
      7,
      7,
      soil.seed
    ) - 0.5;
  return soil.heap * (1 - far * far) * (1 + 0.5 * lumps);
}

/**
 * The loose crumbs on a bed, as the numbers that place a leaf each (where it
 * lies, the way it points, the way it faces, its size and its tone), so
 * the crumbs draw as instances beside the plants. Each sits on the surface at
 * its own tilt, most of them small and a few large.
 */
export function growCrumbs(soil: Soil) {
  return Arr.flatMap(Arr.range(0, soil.count - 1), (index) => {
    const turn = chanceAt(index, 1, soil.seed) * 2 * Math.PI;
    const far = Math.sqrt(chanceAt(index, 2, soil.seed)) * soil.radius * 0.97;
    const x = Math.cos(turn) * far;
    const z = Math.sin(turn) * far;
    const spin = chanceAt(index, 3, soil.seed) * 2 * Math.PI;
    const tilt = chanceAt(index, 4, soil.seed) * 1.2 - 0.6;
    const size =
      soil.radius * (0.012 + 0.045 * chanceAt(index, 5, soil.seed) ** 3);
    return [
      x,
      soilHeight(soil, x, z) + size * 0.2,
      z,
      Math.cos(spin) * Math.cos(tilt),
      Math.sin(tilt),
      Math.sin(spin) * Math.cos(tilt),
      -Math.cos(spin) * Math.sin(tilt),
      Math.cos(tilt),
      -Math.sin(spin) * Math.sin(tilt),
      size,
      chanceAt(index, 6, soil.seed),
    ];
  });
}

/** The surface of a bed of soil as triangles: a disc heaped and lumped by `soilHeight`. */
export function moundMesh(soil: Soil): Mesh {
  const step = soil.radius / 60;
  const vertices = Arr.flatMap(Arr.range(0, RINGS), (ring) =>
    Arr.map(Arr.range(0, AROUND), (turn) => {
      const far = (ring / RINGS) * soil.radius;
      const angle = (turn / AROUND) * 2 * Math.PI;
      const x = Math.cos(angle) * far;
      const z = Math.sin(angle) * far;
      const slopeX =
        soilHeight(soil, x + step, z) - soilHeight(soil, x - step, z);
      const slopeZ =
        soilHeight(soil, x, z + step) - soilHeight(soil, x, z - step);
      const length = Math.hypot(slopeX, 2 * step, slopeZ);
      return {
        normal: [-slopeX / length, (2 * step) / length, -slopeZ / length],
        position: [x, soilHeight(soil, x, z), z],
        uv: [x / soil.radius / 2 + 0.5, z / soil.radius / 2 + 0.5],
      };
    })
  );
  const stride = AROUND + 1;
  return {
    indices: Arr.flatMap(Arr.range(0, RINGS - 1), (ring) =>
      Arr.flatMap(Arr.range(0, AROUND - 1), (turn) => {
        const corner = ring * stride + turn;
        const outer = corner + stride;
        return [corner, outer + 1, outer, corner, corner + 1, outer + 1];
      })
    ),
    normals: Arr.flatMap(vertices, (vertex) => vertex.normal),
    positions: Arr.flatMap(vertices, (vertex) => vertex.position),
    uvs: Arr.flatMap(vertices, (vertex) => vertex.uv),
  };
}
