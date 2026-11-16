import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  type HullLines,
  hullGeometry,
} from "@repo/design-system/components/three/vessel/hull";
import { useEffect, useMemo } from "react";

/**
 * A ship's hull, faired from its lines: the bottom below the boot top in
 * antifouling paint, the topsides above it in the hull's own colour, both
 * painted steel with grime and wear, and the deck in deck paint. It lies
 * along +x with its keel amidships at zero, in scene units.
 *
 * @param lines - The hull's lines
 * @param boot - The height of the boot top, where the bottom paint meets the topsides
 * @param bottom - The antifouling colour below the boot top
 * @param topside - The hull's colour above the boot top
 * @param deck - The deck paint
 */
export function Hull({
  boot,
  bottom,
  deck,
  lines,
  topside,
}: {
  readonly boot: number;
  readonly bottom: string;
  readonly deck: string;
  readonly lines: HullLines;
  readonly topside: string;
}) {
  const geometries = useMemo(
    () => ({
      lower: hullGeometry(lines, 0, boot),
      upper: hullGeometry(lines, boot, Number.POSITIVE_INFINITY),
    }),
    [boot, lines]
  );

  useEffect(
    () => () => {
      geometries.lower.dispose();
      geometries.upper.dispose();
    },
    [geometries]
  );

  // The texture coordinates are in scene units of ten metres: one tile of grime spans about four metres.
  const plates: readonly [number, number] = [2.5, 2.5];

  return (
    <group>
      <mesh castShadow geometry={geometries.lower} receiveShadow>
        <SurfaceMaterial color={bottom} repeat={plates} surface="paint" />
      </mesh>
      <mesh castShadow geometry={geometries.upper} receiveShadow>
        <SurfaceMaterial
          attach="material-0"
          color={topside}
          repeat={plates}
          surface="paint"
        />
        <SurfaceMaterial
          attach="material-1"
          color={deck}
          repeat={plates}
          surface="paint"
        />
      </mesh>
    </group>
  );
}
