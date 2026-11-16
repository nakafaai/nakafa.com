import type { Surface } from "@repo/design-system/components/three/surface/detail";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { Array as Arr } from "effect";
import { useEffect, useMemo } from "react";
import { CatmullRomCurve3, TubeGeometry, Vector3 } from "three";

/**
 * A round section run along a line of points: a rubber fender along a
 * hull's sheer, a steel cap rail along its deck edge, a cable or a hose.
 *
 * @param points - The line, in order
 * @param radius - The section's radius, in scene units
 * @param surface - What it is made of
 */
export function Strake({
  color,
  points,
  radius,
  surface,
}: {
  readonly color: string;
  readonly points: readonly (readonly [number, number, number])[];
  readonly radius: number;
  readonly surface: Surface;
}) {
  const geometry = useMemo(() => {
    const curve = new CatmullRomCurve3(
      Arr.map(points, ([x, y, z]) => new Vector3(x, y, z))
    );
    return new TubeGeometry(curve, points.length * 2, radius, 10, false);
  }, [points, radius]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh castShadow geometry={geometry} receiveShadow>
      <SurfaceMaterial color={color} repeat={[40, 1]} surface={surface} />
    </mesh>
  );
}
