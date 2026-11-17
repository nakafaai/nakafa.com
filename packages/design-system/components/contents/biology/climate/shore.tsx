import { groundAt } from "@repo/design-system/components/contents/biology/climate/sea";
import { valueNoise } from "@repo/design-system/components/contents/simulation/grain";
import { ECOLOGY_COLORS } from "@repo/design-system/lib/material/ecology";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { Array as Arr } from "effect";
import { useEffect, useLayoutEffect, useMemo } from "react";
import { BufferAttribute, Color, PlaneGeometry } from "three";

/**
 * The land runs from 150 m out under the sea to 130 m inland, past the
 * camera, and 320 m along the coast, wider than the sea, so the water never
 * shows an edge against the land.
 */
const LAND = { inland: 130, length: 320, sea: -150 } as const;

/** Where the dry beach gives way to grass, in metres inland of today's high tide. */
const GRASS_LINE = 19;

/** A number eased from 0 at `from` to 1 at `to`. */
function ease(from: number, to: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** Two octaves of smooth noise in [0, 1) at a point, in cells of `size` metres. */
function patches(x: number, z: number, size: number) {
  return (
    valueNoise(x / size, z / size, 256) * 0.65 +
    valueNoise((x / size) * 2.7, (z / size) * 2.7, 256) * 0.35
  );
}

/**
 * The height of the land at a point: the beach's even slope, wind ripples on
 * the sand, and hummocks in the grass that grow inland, so the village's
 * stilts and the palms stand on ground the model reads as its slope.
 */
export function landAt(x: number, z: number) {
  const ripple = (valueNoise(x * 1.4, z * 0.35, 256) - 0.5) * 0.03;
  const hummock = (patches(x, z, 9) - 0.5) * 0.7 * ease(14, 46, x);
  return groundAt(x) + ripple + hummock;
}

/**
 * The coast's ground: a gently sloping beach whose sand is dark and wet up to
 * where the waves run, with a line of washed-up wrack at their reach, pale
 * and dry above it, then tropical grass in sun and shade inland. The water
 * meets it at the model's shoreline. Behind a sea wall that holds the sea,
 * the sand stays as it is at today's high tide.
 */
export function Shore({
  level,
  reach,
  wave,
}: {
  readonly level: number;
  readonly reach: number | undefined;
  readonly wave: number;
}) {
  const geometry = useMemo(() => {
    const plane = new PlaneGeometry(
      LAND.inland - LAND.sea,
      LAND.length,
      224,
      128
    );
    plane.rotateX(-Math.PI / 2);
    plane.translate((LAND.inland + LAND.sea) / 2, 0, 0);
    const positions = plane.getAttribute("position");
    Arr.forEach(Arr.range(0, positions.count - 1), (index) => {
      positions.setY(
        index,
        landAt(positions.getX(index), positions.getZ(index))
      );
    });
    plane.computeVertexNormals();
    plane.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(positions.count * 3), 3)
    );
    return plane;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useLayoutEffect(() => {
    const positions = geometry.getAttribute("position");
    const colors = geometry.getAttribute("color");
    const palette = {
      dry: new Color(MACHINE_COLORS.sand),
      lush: new Color(ECOLOGY_COLORS.grassLush),
      mud: new Color(ECOLOGY_COLORS.mud),
      sun: new Color(ECOLOGY_COLORS.grassSun),
      wet: new Color(ECOLOGY_COLORS.sandWet),
    };
    const run = 0.2 + wave * 0.6;
    const paint = new Color();
    Arr.forEach(Arr.range(0, positions.count - 1), (index) => {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const sea = reach !== undefined && x > reach ? 0 : level;
      const above = positions.getY(index) - sea;
      const grain = patches(x, z, 4);
      paint
        .copy(palette.dry)
        .lerp(palette.wet, 1 - ease(run - 0.05, run + 0.2, above));
      paint.lerp(palette.mud, ease(-0.4, -3, above) * 0.7);
      paint.lerp(
        palette.mud,
        (1 - ease(0, 0.12, Math.abs(above - run - 0.08))) * 0.35
      );
      const grass = ease(
        GRASS_LINE - 3,
        GRASS_LINE + 3,
        x + (patches(x, z, 6) - 0.5) * 9
      );
      const meadow = palette.lush
        .clone()
        .lerp(palette.sun, ease(0.35, 0.7, patches(x + 40, z, 14)))
        .multiplyScalar(0.82 + grain * 0.3);
      paint.lerp(meadow, grass).multiplyScalar(0.94 + grain * 0.12);
      colors.setXYZ(index, paint.r, paint.g, paint.b);
    });
    colors.needsUpdate = true;
  }, [geometry, level, reach, wave]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial roughness={0.93} vertexColors />
    </mesh>
  );
}
