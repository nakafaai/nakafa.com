import { useThree } from "@react-three/fiber";
import {
  gridMesh,
  type MeshGrid,
  meshGeometry,
} from "@repo/design-system/lib/geometry/mesh";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { useEffect, useMemo } from "react";
import {
  type ColorRepresentation,
  DoubleSide,
  MeshStandardMaterial,
  Plane,
  Vector3,
} from "three";

/** The six planes that keep a surface inside its frame box. */
function frameClipping(min: Point3, max: Point3) {
  return [
    new Plane(new Vector3(1, 0, 0), -min.x),
    new Plane(new Vector3(-1, 0, 0), max.x),
    new Plane(new Vector3(0, 1, 0), -min.y),
    new Plane(new Vector3(0, -1, 0), max.y),
    new Plane(new Vector3(0, 0, 1), -min.z),
    new Plane(new Vector3(0, 0, -1), max.z),
  ];
}

/**
 * Draws a sampled surface, z = f(x, y), a parametric patch, or a solid of
 * revolution, as one lit mesh cut to its frame, with holes where it is
 * undefined.
 */
export function Surface({
  color,
  grid,
  max,
  min,
}: {
  readonly color: ColorRepresentation;
  readonly grid: MeshGrid;
  readonly max: Point3;
  readonly min: Point3;
}) {
  const gl = useThree((state) => state.gl);
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);
  const geometry = useMemo(() => meshGeometry(gridMesh(grid)), [grid]);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        clippingPlanes: frameClipping(min, max),
        color,
        metalness: 0.05,
        opacity: 0.92,
        roughness: 0.55,
        side: DoubleSide,
        transparent: true,
      }),
    [color, max, min]
  );
  return <mesh geometry={geometry} material={material} />;
}
